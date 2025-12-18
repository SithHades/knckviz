import type { LobEngine } from './LobEngine';
import type { Trade } from './types';

export interface AgentConfig {
    id: string;
    name: string;
    type: string;
    color: string;
    initialCash?: number;
}

export abstract class BaseAgent {
  public id: string;
  public name: string;
  public color: string;
  public inventory: number = 0;
  public cash: number = 10000;
  public initialCash: number = 10000;
  protected lastTradeIndex: number = 0;

  constructor(config: AgentConfig) {
      this.id = config.id;
      this.name = config.name;
      this.color = config.color;
      if (config.initialCash) {
          this.cash = config.initialCash;
          this.initialCash = config.initialCash;
      }
  }

  public getUnrealizedPnL(currentPrice: number): number {
    const inventoryValue = this.inventory * currentPrice;
    const totalValue = this.cash + inventoryValue;
    return totalValue - this.initialCash;
  }

  public updatePortfolio(trades: Trade[]) {
      const newTrades = trades.slice(this.lastTradeIndex);
      if (newTrades.length === 0) return;

      for (const trade of newTrades) {
          if (trade.buyerOwner === this.id) {
              this.inventory += trade.volume;
              this.cash -= trade.price * trade.volume;
          }
          if (trade.sellerOwner === this.id) {
              this.inventory -= trade.volume;
              this.cash += trade.price * trade.volume;
          }
      }
      this.lastTradeIndex = trades.length;
  }

  public reset() {
      this.inventory = 0;
      this.cash = this.initialCash;
      this.lastTradeIndex = 0;
  }

  abstract decide(lob: LobEngine, timestamp: number): void;
}

// 1. The Standard Market Maker (Inventory-sensitive)
export class NaiveMarketMaker extends BaseAgent {
    private riskAversion: number = 0.1;
    private spreadMultiplier: number = 1.0;

    constructor(config: AgentConfig) {
        super(config);
    }

    public decide(lob: LobEngine, timestamp: number) {
        const bestBid = lob.getBestBid();
        const bestAsk = lob.getBestAsk();

        if (!bestBid || !bestAsk) return;

        const midPrice = (bestBid + bestAsk) / 2;
        const spread = Math.max(0.05, bestAsk - bestBid);

        const inventoryRisk = this.inventory * this.riskAversion;
        // Shift midpoint based on inventory to discourage taking more of the same side
        const targetBid = midPrice - (spread / 2) * this.spreadMultiplier - inventoryRisk;
        const targetAsk = midPrice + (spread / 2) * this.spreadMultiplier - inventoryRisk;

        const bidPrice = Math.round(targetBid * 100) / 100;
        const askPrice = Math.round(targetAsk * 100) / 100;

        lob.cancelAllAgentOrders(this.id);

        if (bidPrice > 0) {
            lob.addOrder({
                id: `${this.id}-bid-${timestamp}`,
                price: bidPrice,
                volume: 1,
                type: 'LIMIT',
                side: 'BID',
                owner: this.id,
                timestamp
            });
        }

        if (askPrice > 0) {
            lob.addOrder({
                id: `${this.id}-ask-${timestamp}`,
                price: askPrice,
                volume: 1,
                type: 'LIMIT',
                side: 'ASK',
                owner: this.id,
                timestamp
            });
        }
    }
}

// 2. Trend Following Agent
// Buys if price is going up, Sells if price is going down.
// Acts more like a taker or places aggressive limit orders.
export class TrendFollower extends BaseAgent {
    private lastPrice: number = 100;
    private momentum: number = 0; // Simple exp moving average of returns

    constructor(config: AgentConfig) {
        super(config);
    }

    public decide(lob: LobEngine, timestamp: number) {
        const bestBid = lob.getBestBid();
        const bestAsk = lob.getBestAsk();
        if (!bestBid || !bestAsk) return;
        const midPrice = (bestBid + bestAsk) / 2;

        // Update momentum
        const ret = midPrice - this.lastPrice;
        this.momentum = this.momentum * 0.9 + ret * 0.1;
        this.lastPrice = midPrice;

        lob.cancelAllAgentOrders(this.id);

        // If strong momentum, place orders
        if (Math.abs(this.momentum) > 0.05) {
             if (this.momentum > 0) {
                 // Bullish - Buy
                 // Place Limit Buy slightly below best ask to get filled or sit at top of book
                 lob.addOrder({
                    id: `${this.id}-bid-${timestamp}`,
                    price: bestBid + 0.01,
                    volume: 2,
                    type: 'LIMIT',
                    side: 'BID',
                    owner: this.id,
                    timestamp
                });
             } else {
                 // Bearish - Sell
                 lob.addOrder({
                    id: `${this.id}-ask-${timestamp}`,
                    price: bestAsk - 0.01,
                    volume: 2,
                    type: 'LIMIT',
                    side: 'ASK',
                    owner: this.id,
                    timestamp
                });
             }
        }
    }
}

// 3. Wide Stance / Liquidity Provider
// Provides depth but stays away from the touch. Profits from mean reversion/volatility.
export class DeepMarketMaker extends BaseAgent {
    constructor(config: AgentConfig) {
        super(config);
    }

    public decide(lob: LobEngine, timestamp: number) {
        const bestBid = lob.getBestBid();
        const bestAsk = lob.getBestAsk();

        if (!bestBid || !bestAsk) return;

        const midPrice = (bestBid + bestAsk) / 2;
        const spread = bestAsk - bestBid;
        // Wide spread: 3x the market spread or at least a fixed amount
        const mySpread = Math.max(spread * 3, 2.0);

        const bidPrice = Math.round((midPrice - mySpread / 2) * 100) / 100;
        const askPrice = Math.round((midPrice + mySpread / 2) * 100) / 100;

        lob.cancelAllAgentOrders(this.id);

        lob.addOrder({
            id: `${this.id}-bid-${timestamp}`,
            price: bidPrice,
            volume: 5, // Larger volume
            type: 'LIMIT',
            side: 'BID',
            owner: this.id,
            timestamp
        });

        lob.addOrder({
            id: `${this.id}-ask-${timestamp}`,
            price: askPrice,
            volume: 5,
            type: 'LIMIT',
            side: 'ASK',
            owner: this.id,
            timestamp
        });
    }
}
