import type { Order, Side, OrderType, Owner } from './types';

export class NoiseGenerator {
  private midPrice: number;
  private volatility: number;

  constructor(initialPrice: number, volatility: number = 2.0) {
    this.midPrice = initialPrice;
    this.volatility = volatility;
  }

  public setMidPrice(price: number) {
      this.midPrice = price;
  }

  public generateOrder(timestamp: number): Order {
    // 1. Determine side randomly
    const side: Side = Math.random() > 0.5 ? 'BID' : 'ASK';

    // 2. Determine price based on midPrice and volatility
    // Use a normal distribution approximation or just simple random offset
    const offset = (Math.random() - 0.5) * this.volatility * 2; // e.g. -2 to +2
    // If it's a BID, we generally want it slightly lower than mid, ASK slightly higher, but noise can cross
    // To make it look like a spread, Bids are usually < mid, Asks > mid.
    // Let's add a "spread" bias.
    const spreadHalf = this.volatility * 0.5;

    let price: number;
    if (side === 'BID') {
        price = this.midPrice - Math.abs(offset) - (Math.random() * spreadHalf);
    } else {
        price = this.midPrice + Math.abs(offset) + (Math.random() * spreadHalf);
    }

    // Round to 2 decimal places
    price = Math.round(price * 100) / 100;
    if (price <= 0) price = 0.01;

    // 3. Volume
    const volume = Math.floor(Math.random() * 10) + 1; // 1 to 10

    return {
      id: Math.random().toString(36).substr(2, 9),
      price,
      volume,
      type: 'LIMIT',
      side,
      owner: 'NOISE',
      timestamp
    };
  }

  // Optional: Random Walk for the "True Value" or "Fair Price" driver?
  // The prompt says "Price Logic: Use a Random Walk or Mean Reversion... to decide where the next noise orders are placed".
  public updateFairPrice() {
      const change = (Math.random() - 0.5) * 0.5; // Small random walk step
      this.midPrice += change;
      return this.midPrice;
  }
}
