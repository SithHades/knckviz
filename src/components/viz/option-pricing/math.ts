export interface Point {
    x: number; // time step
    y: number; // price
}

export const generateGBMPaths = (
    S0: number,
    mu: number,
    sigma: number,
    T: number,
    steps: number,
    numPaths: number
): Point[][] => {
    const dt = T / steps;
    const paths: Point[][] = [];

    for (let i = 0; i < numPaths; i++) {
        const path: Point[] = [{ x: 0, y: S0 }];
        let currentPrice = S0;

        for (let j = 1; j <= steps; j++) {
            // Using Box-Muller transform for normal distribution
            const u1 = Math.random();
            const u2 = Math.random();
            const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

            // Exponential form: S_t = S_{t-1} * exp((mu - 0.5 * sigma^2) * dt + sigma * sqrt(dt) * z)
            const drift = (mu - 0.5 * sigma * sigma) * dt;
            const diffusion = sigma * Math.sqrt(dt) * z;
            currentPrice = currentPrice * Math.exp(drift + diffusion);

            path.push({ x: j, y: currentPrice });
        }
        paths.push(path);
    }
    return paths;
};

export const calculateOptionPrice = (
    paths: Point[][],
    K: number,
    r: number,
    T: number
): number => {
    // European Call Option
    // Payoff = max(S_T - K, 0)
    // Price = exp(-rT) * E[Payoff]

    let sumPayoff = 0;
    const n = paths.length;

    for(let i=0; i<n; i++) {
        const finalPrice = paths[i][paths[i].length - 1].y;
        sumPayoff += Math.max(finalPrice - K, 0);
    }

    return Math.exp(-r * T) * (sumPayoff / n);
}
