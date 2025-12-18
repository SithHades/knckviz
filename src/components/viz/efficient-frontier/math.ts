
export interface Asset {
  id: string;
  name: string;
  meanReturn: number; // Annualized return (e.g., 0.10 for 10%)
  volatility: number; // Annualized standard deviation (e.g., 0.15 for 15%)
}

export interface PortfolioPoint {
  weights: number[];
  return: number;
  risk: number; // Standard deviation
  sharpe: number;
}

// Generates N random weights that sum to 1.0
export function generateRandomWeights(n: number): number[] {
  const weights = Array.from({ length: n }, () => Math.random());
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => w / sum);
}

// Calculates portfolio return: Rp = w^T * mu
export function calculatePortfolioReturn(weights: number[], returns: number[]): number {
  return weights.reduce((sum, w, i) => sum + w * returns[i], 0);
}

// Calculates portfolio volatility (risk): sigma_p = sqrt(w^T * Sigma * w)
// Sigma is the covariance matrix (N x N), flattened or accessed row-wise
export function calculatePortfolioVolatility(weights: number[], covarianceMatrix: number[][]): number {
  let variance = 0;
  for (let i = 0; i < weights.length; i++) {
    for (let j = 0; j < weights.length; j++) {
      variance += weights[i] * weights[j] * covarianceMatrix[i][j];
    }
  }
  return Math.sqrt(variance);
}

// Helper to construct covariance matrix from volatilities and correlation matrix
// Sigma_ij = rho_ij * sigma_i * sigma_j
export function buildCovarianceMatrix(
  assets: Asset[],
  correlations: number[][] // N x N matrix of correlation coefficients (-1 to 1)
): number[][] {
  const n = assets.length;
  const matrix: number[][] = Array(n)
    .fill(0)
    .map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const rho = correlations[i][j];
      const sigmaI = assets[i].volatility;
      const sigmaJ = assets[j].volatility;
      matrix[i][j] = rho * sigmaI * sigmaJ;
    }
  }
  return matrix;
}

// Monte Carlo simulation batch generator
export function generatePortfolioBatch(
  count: number,
  assets: Asset[],
  covarianceMatrix: number[][],
  riskFreeRate: number = 0.02
): PortfolioPoint[] {
  const points: PortfolioPoint[] = [];
  const returns = assets.map((a) => a.meanReturn);

  for (let i = 0; i < count; i++) {
    const weights = generateRandomWeights(assets.length);
    const pReturn = calculatePortfolioReturn(weights, returns);
    const pRisk = calculatePortfolioVolatility(weights, covarianceMatrix);
    const sharpe = (pReturn - riskFreeRate) / pRisk;

    points.push({
      weights,
      return: pReturn,
      risk: pRisk,
      sharpe,
    });
  }

  return points;
}
