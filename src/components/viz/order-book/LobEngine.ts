import type { Order, Side, Trade, LobState } from './types';

export class LobEngine {
  private bids: Order[] = [];
  private asks: Order[] = [];
  private trades: Trade[] = [];
  private lastPrice: number = 100; // Default starting price

  constructor(initialPrice: number = 100) {
    this.lastPrice = initialPrice;
  }

  // Helper to generate IDs
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  public addOrder(order: Order): Trade[] {
    const newTrades: Trade[] = [];

    if (order.type === 'MARKET') {
        // Market orders execute immediately against the best available price
        this.executeMarketOrder(order, newTrades);
    } else {
        // Limit orders are added to the book and then we check for matches
        if (order.side === 'BID') {
            this.insertBid(order);
        } else {
            this.insertAsk(order);
        }
        this.matchOrders(newTrades);
    }

    // Update trade history (keep last 50 for visualization efficiency if needed,
    // but here we just append. The consumer can slice.)
    this.trades.push(...newTrades);
    if (newTrades.length > 0) {
        this.lastPrice = newTrades[newTrades.length - 1].price;
    }

    return newTrades;
  }

  private executeMarketOrder(order: Order, trades: Trade[]) {
      let volumeToFill = order.volume;

      if (order.side === 'BID') {
          // Buy from lowest Asks
          while (volumeToFill > 0 && this.asks.length > 0) {
              const bestAsk = this.asks[0];
              const tradeVolume = Math.min(volumeToFill, bestAsk.volume);
              const tradePrice = bestAsk.price;

              trades.push({
                  id: this.generateId(),
                  price: tradePrice,
                  volume: tradeVolume,
                  timestamp: Date.now(),
                  buyerOwner: order.owner,
                  sellerOwner: bestAsk.owner
              });

              volumeToFill -= tradeVolume;
              bestAsk.volume -= tradeVolume;

              if (bestAsk.volume <= 0) {
                  this.asks.shift(); // Remove filled ask
              }
          }
      } else {
          // Sell to highest Bids
          while (volumeToFill > 0 && this.bids.length > 0) {
              const bestBid = this.bids[0];
              const tradeVolume = Math.min(volumeToFill, bestBid.volume);
              const tradePrice = bestBid.price;

               trades.push({
                  id: this.generateId(),
                  price: tradePrice,
                  volume: tradeVolume,
                  timestamp: Date.now(),
                  buyerOwner: bestBid.owner,
                  sellerOwner: order.owner
              });

              volumeToFill -= tradeVolume;
              bestBid.volume -= tradeVolume;

              if (bestBid.volume <= 0) {
                  this.bids.shift(); // Remove filled bid
              }
          }
      }
  }

  private insertBid(order: Order) {
    // Bids: Descending order (Highest price first)
    // Using binary search for insertion could be faster, but linear is fine for < 1000 orders
    let inserted = false;
    for (let i = 0; i < this.bids.length; i++) {
      if (order.price > this.bids[i].price) {
        this.bids.splice(i, 0, order);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      this.bids.push(order);
    }
  }

  private insertAsk(order: Order) {
    // Asks: Ascending order (Lowest price first)
    let inserted = false;
    for (let i = 0; i < this.asks.length; i++) {
      if (order.price < this.asks[i].price) {
        this.asks.splice(i, 0, order);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      this.asks.push(order);
    }
  }

  private matchOrders(trades: Trade[]) {
    // While Best Bid >= Best Ask
    while (this.bids.length > 0 && this.asks.length > 0) {
      const bestBid = this.bids[0];
      const bestAsk = this.asks[0];

      if (bestBid.price >= bestAsk.price) {
        const tradeVolume = Math.min(bestBid.volume, bestAsk.volume);
        const tradePrice = bestBid.timestamp < bestAsk.timestamp ? bestBid.price : bestAsk.price;
        // Or usually the price of the order that was there first (Maker).
        // If the incoming order crosses the spread, it takes the Maker's price.
        // Here, we effectively assume the one already in the book is the Maker.
        // Since we insert then match, the one already at index 0 is the maker?
        // Actually, if we just inserted a Bid that crosses the spread, it becomes bids[0] (or close).
        // Let's stick to: Price is determined by the resting order (the one that was already in the book).
        // If both are new? (Unlikely in sequential processing).
        // Simplified: Use the average or the price of the one that arrived earlier?
        // Let's use the price of the 'resting' order. If I just added a Bid and it matches an Ask, the Ask was resting.
        // But how do I know which one was resting without checking timestamps?
        // Let's use bestAsk.price if the incoming was a Bid, and bestBid.price if incoming was Ask.
        // But here `matchOrders` is called after insertion.
        // Let's use the price of the order with the earlier timestamp.
        const price = bestBid.timestamp < bestAsk.timestamp ? bestBid.price : bestAsk.price;

        trades.push({
          id: this.generateId(),
          price: price,
          volume: tradeVolume,
          timestamp: Date.now(),
          buyerOwner: bestBid.owner,
          sellerOwner: bestAsk.owner
        });

        bestBid.volume -= tradeVolume;
        bestAsk.volume -= tradeVolume;

        if (bestBid.volume <= 0) {
          this.bids.shift();
        }
        if (bestAsk.volume <= 0) {
          this.asks.shift();
        }
      } else {
        break;
      }
    }
  }

  public getState(): LobState {
    return {
      bids: [...this.bids],
      asks: [...this.asks],
      trades: [...this.trades],
      lastPrice: this.lastPrice
    };
  }

  public getBestBid(): number | null {
      return this.bids.length > 0 ? this.bids[0].price : null;
  }

  public getBestAsk(): number | null {
      return this.asks.length > 0 ? this.asks[0].price : null;
  }

  public cleanup(maxOrders: number = 500) {
      // Remove orders far from the spread to keep performance high
      // Keep top N bids and asks
      if (this.bids.length > maxOrders) {
          this.bids = this.bids.slice(0, maxOrders);
      }
      if (this.asks.length > maxOrders) {
          this.asks = this.asks.slice(0, maxOrders);
      }
  }

  public cancelAllAgentOrders(ownerId?: string) {
      if (ownerId) {
          this.bids = this.bids.filter(o => o.owner !== ownerId);
          this.asks = this.asks.filter(o => o.owner !== ownerId);
      } else {
          // Fallback or clear all non-noise? Better be safe and only clear specific agents.
          // For now, let's assume if no ID provided, we don't clear anything to be safe,
          // OR we clear 'AGENT' for backward compatibility if we kept it.
          // But we moved to string owners.
      }
  }
}
