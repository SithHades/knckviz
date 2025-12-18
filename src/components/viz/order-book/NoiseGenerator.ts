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

  public setVolatility(vol: number) {
      this.volatility = vol;
  }

  public generateOrder(timestamp: number): Order {
    // 1. Determine side randomly
    const side: Side = Math.random() > 0.5 ? 'BID' : 'ASK';

    // 2. Decide if Market or Limit
    // 5% chance of Market Order to ensure liquidity/movement
    const type: OrderType = Math.random() < 0.05 ? 'MARKET' : 'LIMIT';

    // 3. Determine price
    // We allow crossing the spread occasionally
    // Gaussian-like noise
    const u = 1 - Math.random();
    const v = Math.random();
    const z = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
    // z is standard normal distribution

    const noise = z * (this.volatility * 0.5);

    let price = this.midPrice + noise;

    // Bias towards side
    // If BID, we prefer lower prices, but allow crossing
    // If ASK, we prefer higher prices
    if (side === 'BID') {
        price -= (this.volatility * 0.2); // slight bias down
    } else {
        price += (this.volatility * 0.2); // slight bias up
    }

    price = Math.round(price * 100) / 100;
    if (price <= 0) price = 0.01;

    // 4. Volume
    const volume = Math.floor(Math.random() * 5) + 1;

    return {
      id: Math.random().toString(36).substr(2, 9),
      price,
      volume,
      type,
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
