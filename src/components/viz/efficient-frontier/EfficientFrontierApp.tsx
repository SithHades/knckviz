
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  type Asset,
  type PortfolioPoint,
  generateRandomWeights,
  calculatePortfolioReturn,
  calculatePortfolioVolatility,
  buildCovarianceMatrix
} from './math';
import { CanvasRenderer } from './CanvasRenderer';
import { Controls } from './Controls';

const DEFAULT_ASSETS: Asset[] = [
  { id: 'stocks', name: 'US Stocks', meanReturn: 0.10, volatility: 0.16 },
  { id: 'bonds', name: 'Treasury Bonds', meanReturn: 0.04, volatility: 0.05 },
  { id: 'gold', name: 'Gold', meanReturn: 0.06, volatility: 0.18 },
  { id: 'emerging', name: 'Emerging Mkts', meanReturn: 0.12, volatility: 0.22 },
];

const POINT_COUNT = 3000;

export const EfficientFrontierApp: React.FC = () => {
  const [assets] = useState<Asset[]>(DEFAULT_ASSETS);
  // Flattened upper triangle correlations? Or full matrix?
  // Let's store full matrix for easier math, but UI only updates parts.
  const [correlations, setCorrelations] = useState<number[][]>(() => {
    const n = DEFAULT_ASSETS.length;
    const matrix = Array(n).fill(0).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) matrix[i][i] = 1.0;
    return matrix;
  });

  // We keep stable weights to allow "morphing" when correlation changes
  const [weightsList, setWeightsList] = useState<number[][]>([]);
  const [points, setPoints] = useState<PortfolioPoint[]>([]);

  // Initialize weights once
  useEffect(() => {
    const newWeights = Array.from({ length: POINT_COUNT }, () => generateRandomWeights(assets.length));
    setWeightsList(newWeights);
  }, [assets]);

  // Recalculate points when correlations (or weights) change
  useEffect(() => {
    if (weightsList.length === 0) return;

    const covarianceMatrix = buildCovarianceMatrix(assets, correlations);
    const riskFreeRate = 0.02;
    const returns = assets.map(a => a.meanReturn);

    const newPoints = weightsList.map(weights => {
      const pReturn = calculatePortfolioReturn(weights, returns);
      const pRisk = calculatePortfolioVolatility(weights, covarianceMatrix);
      const sharpe = (pReturn - riskFreeRate) / pRisk;
      return { weights, return: pReturn, risk: pRisk, sharpe };
    });

    setPoints(newPoints);
  }, [weightsList, correlations, assets]);

  const handleCorrelationChange = useCallback((i: number, j: number, value: number) => {
    setCorrelations(prev => {
      const next = prev.map(row => [...row]);
      next[i][j] = value;
      next[j][i] = value; // Symmetric
      return next;
    });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px', color: 'white' }}>
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', minWidth: '600px' }}>
             <CanvasRenderer points={points} assets={assets} width={800} height={600} />
        </div>
        <div style={{ flex: '0 0 300px' }}>
            <Controls assets={assets} correlations={correlations} onCorrelationChange={handleCorrelationChange} />
             <div style={{ marginTop: '20px', padding: '15px', background: '#2a2a2a', borderRadius: '8px' }}>
                <h4>How it works</h4>
                <p style={{ fontSize: '0.9em', lineHeight: '1.4' }}>
                    This simulation uses <strong>Monte Carlo</strong> methods to generate {POINT_COUNT} random portfolios using 4 different assets.
                </p>
                <p style={{ fontSize: '0.9em', lineHeight: '1.4' }}>
                    Each dot represents a portfolio. The X-axis is <strong>Risk</strong> (Volatility), and the Y-axis is <strong>Return</strong>.
                </p>
                <p style={{ fontSize: '0.9em', lineHeight: '1.4' }}>
                    The <strong>Efficient Frontier</strong> is the glowing green line on the top-left edge. These are the optimal portfolios offering the highest return for a given level of risk.
                </p>
                <p style={{ fontSize: '0.9em', lineHeight: '1.4' }}>
                    Adjust the <strong>Correlations</strong> to see how diversification benefits change the shape of the cloud! Lower correlations typically bow the frontier to the left, reducing risk.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};
