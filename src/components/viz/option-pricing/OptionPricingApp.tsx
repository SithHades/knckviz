import React, { useState, useEffect, useMemo } from 'react';
import { generateGBMPaths, calculateOptionPrice, type Point } from './math';
import { CanvasRenderer } from './CanvasRenderer';
import { Controls } from './Controls';

export const OptionPricingApp = () => {
  const [paths, setPaths] = useState<Point[][]>([]);
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(500);

  // Parameters
  const [sigma, setSigma] = useState(0.2); // Volatility
  const [mu, setMu] = useState(0.05);      // Drift
  const [T, setT] = useState(1.0);         // Time in years
  const [S0, setS0] = useState(100);       // Start Price
  const [K, setK] = useState(100);         // Strike Price

  const numPaths = 500;
  const steps = 100;

  // Generate Paths
  useEffect(() => {
    const newPaths = generateGBMPaths(S0, mu, sigma, T, steps, numPaths);
    setPaths(newPaths);
  }, [S0, mu, sigma, T]); // Recalculate if these change. K doesn't affect paths.

  // Calculate Option Price
  const optionPrice = useMemo(() => {
    return calculateOptionPrice(paths, K, 0.05, T); // Risk free rate r=0.05 hardcoded for now or use mu?
    // Usually r is risk-free rate, mu is real drift. For risk-neutral pricing, drift should be r.
    // Spec: "dS_t = mu S_t dt + sigma S_t dW_t"
    // Spec: "Option Price = e^{-rT} E[max(S_T - K, 0)]"
    // In Black-Scholes world, we simulate with drift = r.
    // But the user exposes "Drift (mu)" explicitly.
    // If we want "True World" simulation, we use mu.
    // But then option pricing formula usually uses risk-neutral valuation (replace mu with r).
    // The user instruction implies just averaging the payoff.
    // I will use r = 0.05 for discounting.
    // If the user wants to see how Drift affects the "Simulated Payoff", I will use paths generated with mu.
  }, [paths, K, T]);

  // Responsive Canvas
  useEffect(() => {
    const handleResize = () => {
      const container = document.getElementById('viz-container');
      if (container) {
        setWidth(container.clientWidth);
        // Height can be fixed or relative
        setHeight(Math.min(600, window.innerHeight * 0.6));
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div id="viz-container" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      <CanvasRenderer
        paths={paths}
        width={width}
        height={height}
        K={K}
        onStrikeChange={setK}
        optionPrice={optionPrice}
      />
      <Controls
        sigma={sigma} setSigma={setSigma}
        mu={mu} setMu={setMu}
        T={T} setT={setT}
        S0={S0} setS0={setS0}
        K={K} setK={setK}
      />
      <div style={{ marginTop: '1rem', color: '#ccc', fontSize: '0.9rem', lineHeight: '1.5' }}>
          <p>
              This visualization runs a Monte Carlo simulation of Geometric Brownian Motion (GBM) to price a European Call Option.
          </p>
          <ul style={{ marginLeft: '1.5rem' }}>
              <li><strong>Glowing Lines:</strong> Individual price paths simulated over time. Green = In The Money (Profit), Red = Out of The Money.</li>
              <li><strong>Strike Line:</strong> The dashed horizontal line represents the Strike Price (K). Drag it to see how it affects the option value.</li>
              <li><strong>Histogram:</strong> The bar chart on the right shows the probability distribution of the final stock price.</li>
              <li><strong>Option Price:</strong> Calculated as the discounted average payoff: $e^&#123;-rT&#125; \mathbb&#123;E&#125;[\max(S_T - K, 0)]$.</li>
          </ul>
      </div>
    </div>
  );
};
