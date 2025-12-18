import type { LobEngine } from './LobEngine';
import type { Order, Side } from './types';

export class Agent {
  public inventory: number = 0;
  public cash: number = 10000; // Starting simulated cash
  public initialCash: number = 10000;

  // Basic heuristic params
  private riskAversion: number = 0.1;
  private spreadMultiplier: number = 1.0;

  constructor() {}

  public getUnrealizedPnL(currentPrice: number): number {
    const inventoryValue = this.inventory * currentPrice;
    const totalValue = this.cash + inventoryValue;
    return totalValue - this.initialCash;
  }

  private lastTradeIndex: number = 0;

  public updatePortfolio(trades: import('./types').Trade[]) {
      // Only process new trades
      const newTrades = trades.slice(this.lastTradeIndex);
      if (newTrades.length === 0) return;

      for (const trade of newTrades) {
          if (trade.buyerOwner === 'AGENT') {
              this.inventory += trade.volume;
              this.cash -= trade.price * trade.volume;
          }
          if (trade.sellerOwner === 'AGENT') {
              this.inventory -= trade.volume;
              this.cash += trade.price * trade.volume;
          }
      }
      this.lastTradeIndex = trades.length;
  }

  public decide(lob: LobEngine, timestamp: number) {
    const bestBid = lob.getBestBid();
    const bestAsk = lob.getBestAsk();

    if (!bestBid || !bestAsk) return;

    const midPrice = (bestBid + bestAsk) / 2;
    const spread = bestAsk - bestBid;

    // Simple Market Maker Logic:
    // Place orders around the mid price, adjusted by inventory risk.
    // If we have positive inventory (long), we want to sell, so we lower our ask to attract buyers
    // and lower our bid to avoid buying more.

    // Target price shift based on inventory
    const inventoryRisk = this.inventory * this.riskAversion;
    const targetBid = midPrice - (spread / 2) * this.spreadMultiplier - inventoryRisk;
    const targetAsk = midPrice + (spread / 2) * this.spreadMultiplier - inventoryRisk;

    // Rounding
    const bidPrice = Math.round(targetBid * 100) / 100;
    const askPrice = Math.round(targetAsk * 100) / 100;

    // Cancel existing orders to reposition (Simplified for MVP: Cancel All then Post)
    lob.cancelAllAgentOrders();

    // Post Bid
    lob.addOrder({
        id: `agent-bid-${timestamp}`,
        price: bidPrice,
        volume: 1, // Fixed volume for now
        type: 'LIMIT',
        side: 'BID',
        owner: 'AGENT',
        timestamp
    });

    // Post Ask
    lob.addOrder({
        id: `agent-ask-${timestamp}`,
        price: askPrice,
        volume: 1,
        type: 'LIMIT',
        side: 'ASK',
        owner: 'AGENT',
        timestamp
    });
  }
}
