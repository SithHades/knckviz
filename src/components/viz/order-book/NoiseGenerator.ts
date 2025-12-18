import type { Order, Side, OrderType, Owner, MarketRegime } from './types';

export class NoiseGenerator {
  private midPrice: number;
  private volatility: number;
  private regime: MarketRegime = 'STABLE';
  private regimeDuration: number = 0;
  private currentTrend: number = 0; // -1 to 1

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

  public setRegime(regime: MarketRegime) {
      this.regime = regime;
      this.regimeDuration = 0;
      // Initialize trend based on regime
      if (regime === 'UPTREND') this.currentTrend = 0.5;
      else if (regime === 'DOWNTREND') this.currentTrend = -0.5;
      else this.currentTrend = 0;
  }

  public generateOrder(timestamp: number): Order {
    // 1. Determine side randomly, biased by trend
    // If Uptrend, more Buy orders or higher prices?
    // Let's bias the side selection slightly.
    let bidProb = 0.5;
    if (this.regime === 'UPTREND') bidProb = 0.6;
    if (this.regime === 'DOWNTREND') bidProb = 0.4;

    const side: Side = Math.random() < bidProb ? 'BID' : 'ASK';

    // 2. Decide if Market or Limit
    // 5% chance of Market Order to ensure liquidity/movement
    // In VOLATILE, maybe more market orders?
    let marketProb = 0.05;
    if (this.regime === 'VOLATILE') marketProb = 0.15;

    const type: OrderType = Math.random() < marketProb ? 'MARKET' : 'LIMIT';

    // 3. Determine price
    // We allow crossing the spread occasionally
    // Gaussian-like noise
    const u = 1 - Math.random();
    const v = Math.random();
    const z = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
    // z is standard normal distribution

    let currentVol = this.volatility;
    if (this.regime === 'VOLATILE') currentVol *= 2.5;

    const noise = z * (currentVol * 0.5);

    let price = this.midPrice + noise;

    // Bias towards side
    // If BID, we prefer lower prices, but allow crossing
    // If ASK, we prefer higher prices
    // In trends, we might place orders closer to the trend direction
    if (side === 'BID') {
        price -= (currentVol * 0.2); // slight bias down normally
    } else {
        price += (currentVol * 0.2); // slight bias up normally
    }

    price = Math.round(price * 100) / 100;
    if (price <= 0) price = 0.01;

    // 4. Volume
    let volume = Math.floor(Math.random() * 5) + 1;
    if (this.regime === 'VOLATILE') volume = Math.floor(Math.random() * 10) + 1;

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

  // Called periodically to drift the "fair price"
  public updateFairPrice() {
      let change = (Math.random() - 0.5) * 0.5; // Base random walk

      // Apply Regime Bias
      if (this.regime === 'UPTREND') {
          change += 0.2; // Constant upward drift
      } else if (this.regime === 'DOWNTREND') {
          change -= 0.2; // Constant downward drift
      } else if (this.regime === 'VOLATILE') {
          change *= 5.0; // Larger jumps
      }

      this.midPrice += change;
      if (this.midPrice < 1) this.midPrice = 1;

      return this.midPrice;
  }
}
