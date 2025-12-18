import React, { useEffect, useRef, useState, useCallback } from 'react';
import { LobEngine } from './LobEngine';
import { NoiseGenerator } from './NoiseGenerator';
import { Agent } from './Agent';
import { OrderBookCanvas } from './OrderBookCanvas';
import type { LobState } from './types';

export const OrderBookApp: React.FC = () => {
  // Use Refs for the engine to avoid re-renders on every tick logic
  const engineRef = useRef(new LobEngine(100));
  const noiseRef = useRef(new NoiseGenerator(100, 2.0));
  const agentRef = useRef(new Agent());

  // State for UI stats (low frequency updates)
  const [stats, setStats] = useState({
      price: 100,
      inventory: 0,
      pnl: 0,
      fps: 0
  });

  // UI Control State
  const [volatility, setVolatility] = useState(2.0);
  const [agentEnabled, setAgentEnabled] = useState(true);
  const [showExplanation, setShowExplanation] = useState(false);

  // Update refs when controls change
  useEffect(() => {
    // noiseRef.current.volatility = volatility; // Private field, need setter or reconstruct
    // Or just create new NoiseGenerator. But we want to keep price state.
    // Let's just modify the class to have a setter or make it public.
    // For now, let's just make a new one with same midPrice.
    // engineRef.current.lastPrice? No midPrice is inside NoiseGenerator.
    // We need to expose a setter in NoiseGenerator.
    noiseRef.current.setVolatility(volatility);
  }, [volatility]);

  const [lobState, setLobState] = useState<LobState>(engineRef.current.getState());

  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);

  const loop = useCallback((time: number) => {
      const deltaTime = time - lastTimeRef.current;

      if (deltaTime > 16) { // Cap at ~60fps
          // 1. Update Noise
          // Add some noise orders
          if (Math.random() > 0.5) { // 50% chance per frame to add order
             const order = noiseRef.current.generateOrder(Date.now());
             engineRef.current.addOrder(order);
          }

          // Move fair price occasionally
          if (Math.random() < 0.01) {
              noiseRef.current.updateFairPrice();
          }

          // 2. Agent Logic
          if (agentEnabled) {
              if (frameCountRef.current % 10 === 0) {
                  agentRef.current.decide(engineRef.current, Date.now());
                  agentRef.current.updatePortfolio(engineRef.current.getState().trades);
              }
          }

          // Cleanup
          if (frameCountRef.current % 60 === 0) {
              engineRef.current.cleanup();
          }

          // 3. Update State for Render
          const currentState = engineRef.current.getState();
          setLobState(currentState);

          // Update UI Stats less frequently
          if (frameCountRef.current % 60 === 0) {
              setStats({
                  price: currentState.lastPrice,
                  inventory: agentRef.current.inventory,
                  pnl: agentRef.current.getUnrealizedPnL(currentState.lastPrice),
                  fps: Math.round(1000 / deltaTime)
              });
          }

          lastTimeRef.current = time;
          frameCountRef.current++;
      }

      requestRef.current = requestAnimationFrame(loop);
  }, [agentEnabled]);

  useEffect(() => {
      requestRef.current = requestAnimationFrame(loop);
      return () => {
          if (requestRef.current) cancelAnimationFrame(requestRef.current);
      };
  }, [loop]);

  const handleInjectMarketOrder = (side: 'BID' | 'ASK') => {
      // Inject a massive market order
      const order: import('./types').Order = {
          id: `manual-shock-${Date.now()}`,
          price: 0,
          volume: 20 + Math.floor(Math.random() * 30),
          type: 'MARKET',
          side: side,
          owner: 'NOISE',
          timestamp: Date.now()
      };
      engineRef.current.addOrder(order);
  };

  return (
    <div style={{ width: '100%', height: '100vh', backgroundColor: '#111', color: '#eee', display: 'flex', flexDirection: 'column' }}>

      {/* Header / HUD */}
      <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #333', zIndex: 10, background: '#111' }}>
        <div>
          <h2>Order Book Organism</h2>
          <p>Mid Price: {stats.price.toFixed(2)}</p>
          <button onClick={() => setShowExplanation(!showExplanation)} style={{ marginTop: '10px', fontSize: '0.9em', background: 'transparent', color: '#888', border: '1px solid #444', padding: '5px', cursor: 'pointer' }}>
             {showExplanation ? 'Hide Info' : 'What is this?'}
          </button>
        </div>

        <div>
           <h3>Agent Status</h3>
           <p style={{ color: '#00d1ff' }}>Inventory: {stats.inventory}</p>
           <p style={{ color: stats.pnl >= 0 ? '#00ff88' : '#ff4444' }}>
               PnL: {stats.pnl.toFixed(2)}
           </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '200px' }}>
            {/* Controls */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '0.8em', marginBottom: '5px' }}>Volatility: {volatility}</label>
                <input
                    type="range"
                    min="0.5"
                    max="10.0"
                    step="0.5"
                    value={volatility}
                    onChange={(e) => setVolatility(parseFloat(e.target.value))}
                />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
                <button
                    onClick={() => handleInjectMarketOrder('BID')}
                    style={{
                        padding: '10px',
                        background: '#00ff88',
                        color: 'black',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        flex: 1
                    }}
                >
                    BUY SHOCK
                </button>
                <button
                    onClick={() => handleInjectMarketOrder('ASK')}
                    style={{
                        padding: '10px',
                        background: '#ff4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        flex: 1
                    }}
                >
                    SELL SHOCK
                </button>
            </div>

             <label style={{ fontSize: '0.8em', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input type="checkbox" checked={agentEnabled} onChange={(e) => setAgentEnabled(e.target.checked)} />
                Enable AI Agent
            </label>

            <p style={{ fontSize: '0.8em', marginTop: '5px', textAlign: 'right', color: '#666' }}>FPS: {stats.fps}</p>
        </div>
      </div>

      {/* Explanation Overlay */}
      {showExplanation && (
          <div style={{
              position: 'absolute',
              top: '120px',
              left: '20px',
              width: '300px',
              background: 'rgba(0,0,0,0.9)',
              border: '1px solid #444',
              padding: '20px',
              borderRadius: '8px',
              zIndex: 20,
              fontSize: '0.9em',
              lineHeight: '1.4'
          }}>
              <h3 style={{ marginTop: 0 }}>How it works</h3>
              <p>This is a simulation of a <strong>Limit Order Book</strong>, the engine behind modern financial markets.</p>
              <ul style={{ paddingLeft: '20px' }}>
                  <li><span style={{color: '#00ff88'}}>Green dots</span> are Bids (Buyers).</li>
                  <li><span style={{color: '#ff4444'}}>Red dots</span> are Asks (Sellers).</li>
                  <li>The vertical axis is <strong>Price</strong>.</li>
                  <li>The horizontal axis is <strong>Depth</strong> (Volume).</li>
              </ul>
              <p>The <span style={{color: '#00d1ff'}}>Blue Agent</span> is a simple Market Maker bot. It tries to profit by buying low and selling high (capturing the spread), while managing its inventory risk.</p>
              <p><strong>Click the Shock buttons</strong> to simulate a massive market order (a "Whale") and watch the agent scramble to re-price itself.</p>
          </div>
      )}

      <div style={{ flex: 1, position: 'relative' }}>
        <OrderBookCanvas lobState={lobState} width={window.innerWidth} height={window.innerHeight - 150} />
      </div>
    </div>
  );
};
