
import React, { useState, useEffect, useCallback } from 'react';
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
  // Matrix initialization
  const [correlations, setCorrelations] = useState<number[][]>(() => {
    const n = DEFAULT_ASSETS.length;
    const matrix = Array(n).fill(0).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) matrix[i][i] = 1.0;
    return matrix;
  });

  const [weightsList, setWeightsList] = useState<number[][]>([]);
  const [points, setPoints] = useState<PortfolioPoint[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  // Initialize weights once
  useEffect(() => {
    const newWeights = Array.from({ length: POINT_COUNT }, () => generateRandomWeights(assets.length));
    setWeightsList(newWeights);
  }, [assets]);

  // Recalculate points
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

  // Simulation Loop
  useEffect(() => {
    if (!isSimulating) return;

    let animationFrameId: number;
    const startTime = Date.now();
    let lastUpdate = 0;

    const animate = (timestamp: number) => {
      // Throttle logic updates to ~30fps to save CPU/Battery, though animation is 60fps
      if (timestamp - lastUpdate > 33) {
          lastUpdate = timestamp;
          const time = (Date.now() - startTime) / 1000;

          setCorrelations(prev => {
            const next = prev.map(row => [...row]);
            const n = prev.length;
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                     const phase = (i * 3 + j * 7); // Different phase for each pair
                     // Oscillate roughly between -0.2 and 0.8
                     // This creates a nice "breathing" effect of risk
                     const val = 0.3 + 0.6 * Math.sin(time * 0.5 + phase);
                     // Clamp
                     const clamped = Math.max(-0.99, Math.min(0.99, val));

                     next[i][j] = clamped;
                     next[j][i] = clamped;
                }
            }
            return next;
          });
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isSimulating]);

  const handleCorrelationChange = useCallback((i: number, j: number, value: number) => {
    if (isSimulating) return; // Prevent manual change during simulation
    setCorrelations(prev => {
      const next = prev.map(row => [...row]);
      next[i][j] = value;
      next[j][i] = value;
      return next;
    });
  }, [isSimulating]);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(600px, 2fr) minmax(300px, 1fr)',
      gap: '20px',
      padding: '20px',
      color: 'white',
      maxWidth: '1600px',
      margin: '0 auto'
    }}>
        {/* Left Column: Visualization */}
        <div style={{ minHeight: '600px' }}>
             <CanvasRenderer points={points} assets={assets} width={800} height={600} />
        </div>

        {/* Right Column: Info & Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

             {/* Info Box */}
             <div style={{ padding: '20px', background: '#2a2a2a', borderRadius: '8px' }}>
                <h3 style={{ marginTop: 0 }}>How it works</h3>
                <p style={{ fontSize: '0.9em', lineHeight: '1.5', color: '#ddd' }}>
                    This simulation uses <strong>Monte Carlo</strong> methods to generate {POINT_COUNT} random portfolios.
                    The <strong>Efficient Frontier</strong> (green line) shows optimal portfolios offering the highest return for a given risk.
                </p>
                <div style={{ marginTop: '15px' }}>
                    <button
                        onClick={() => setIsSimulating(!isSimulating)}
                        style={{
                            padding: '10px 20px',
                            background: isSimulating ? '#ef4444' : '#22c55e',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '1em',
                            fontWeight: 'bold',
                            width: '100%',
                            transition: 'background 0.2s'
                        }}
                    >
                        {isSimulating ? "Stop Simulation" : "Simulate Market Cycles"}
                    </button>
                    {isSimulating && <p style={{ fontSize: '0.8em', color: '#aaa', marginTop: '5px', textAlign: 'center' }}>Simulating changing market correlations...</p>}
                </div>
            </div>

            {/* Controls */}
            <Controls
                assets={assets}
                correlations={correlations}
                onCorrelationChange={handleCorrelationChange}
                disabled={isSimulating}
            />

            {/* Data Source Footer */}
            <div style={{ fontSize: '0.8em', color: '#666', fontStyle: 'italic' }}>
                <p>
                    Data Sources: Returns and volatilities are based on hypothetical long-term market averages (approx. 1990-2020) for demonstration purposes.
                    Correlations are adjustable to simulate various market conditions (e.g., 'flight to safety' or 'contagion').
                </p>
            </div>
        </div>

        {/* Responsive Adjustments usually handled via CSS Media Queries.
            For inline styles, we assume desktop first.
            If the screen is small, CSS in global styles or media queries should handle stacking.
            Since this is a React component, we'd need a hook for responsiveness or just use flex-wrap.
            Let's adjust the container to be responsive via inline style hacks or just stick to Grid which handles minmax?
            Actually, gridTemplateColumns with minmax might cause overflow if not wrapped.
            Let's assume the parent layout handles width, but let's change to flex-wrap for safety.
        */}
        <style>{`
            @media (max-width: 1000px) {
                div[style*="display: grid"] {
                    grid-template-columns: 1fr !important;
                }
                div[style*="minHeight: 600px"] {
                    min-height: 400px !important;
                }
                canvas {
                    width: 100% !important;
                    height: auto !important;
                }
            }
        `}</style>
    </div>
  );
};
