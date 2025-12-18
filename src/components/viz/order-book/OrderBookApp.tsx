import React, { useEffect, useRef, useState, useCallback } from 'react';
import { LobEngine } from './LobEngine';
import { NoiseGenerator } from './NoiseGenerator';
import { Agent } from './Agent';
import { OrderBookCanvas } from './OrderBookCanvas';
import type { LobState } from './types';

// Helper hook for responsive canvas
const useResizeObserver = (ref: React.RefObject<HTMLElement>) => {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return dimensions;
};

export const OrderBookApp: React.FC = () => {
  const engineRef = useRef(new LobEngine(100));
  const noiseRef = useRef(new NoiseGenerator(100, 2.0));
  const agentRef = useRef(new Agent());
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useResizeObserver(containerRef);

  // Stats
  const [stats, setStats] = useState({
      price: 100,
      inventory: 0,
      pnl: 0,
      fps: 0
  });

  // Controls
  const [volatility, setVolatility] = useState(2.0);
  const [agentEnabled, setAgentEnabled] = useState(true);
  const [speed, setSpeed] = useState(1.0);
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    noiseRef.current.setVolatility(volatility);
  }, [volatility]);

  const [lobState, setLobState] = useState<LobState>(engineRef.current.getState());

  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const accumulatedSimTime = useRef<number>(0);

  const loop = useCallback((time: number) => {
      const deltaTime = time - lastTimeRef.current;
      lastTimeRef.current = time;

      // Cap deltaTime to avoid spirals if tab was inactive
      const cappedDelta = Math.min(deltaTime, 100);

      // Accumulate simulation time
      // Base step is ~16ms (60fps). We scale by speed.
      // If speed is 1, we add cappedDelta.
      // If speed is 2, we add cappedDelta * 2.
      accumulatedSimTime.current += cappedDelta * speed;

      const timeStep = 16; // 60hz simulation steps
      let updates = 0;

      // Run simulation steps
      while (accumulatedSimTime.current >= timeStep && updates < 10) { // Cap max updates to prevent freeze
          // 1. Noise
          if (Math.random() > 0.5) {
             const order = noiseRef.current.generateOrder(Date.now());
             engineRef.current.addOrder(order);
          }
          if (Math.random() < 0.01) {
              noiseRef.current.updateFairPrice();
          }

          // 2. Agent
          if (agentEnabled) {
              // Agent runs less frequently, say every 10 ticks
              if (Math.random() < 0.1) {
                  agentRef.current.decide(engineRef.current, Date.now());
                  agentRef.current.updatePortfolio(engineRef.current.getState().trades);
              }
          }

          // Cleanup
          if (Math.random() < 0.02) { // Occasionally cleanup
             engineRef.current.cleanup();
          }

          accumulatedSimTime.current -= timeStep;
          updates++;
      }

      // 3. Render Update (Once per frame)
      const currentState = engineRef.current.getState();
      setLobState(currentState);

      // UI Stats (Throttle)
      frameCountRef.current++;
      if (frameCountRef.current % 30 === 0) {
          setStats({
              price: currentState.lastPrice,
              inventory: agentRef.current.inventory,
              pnl: agentRef.current.getUnrealizedPnL(currentState.lastPrice),
              fps: Math.round(1000 / (deltaTime || 16))
          });
      }

      requestRef.current = requestAnimationFrame(loop);
  }, [agentEnabled, speed]); // Dependencies

  useEffect(() => {
      requestRef.current = requestAnimationFrame(loop);
      return () => {
          if (requestRef.current) cancelAnimationFrame(requestRef.current);
      };
  }, [loop]);

  const handleInjectMarketOrder = (side: 'BID' | 'ASK') => {
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
    <div style={{ width: '100%', height: '100%', backgroundColor: '#111', color: '#eee', display: 'flex', flexDirection: 'column' }}>

      {/* Header / HUD */}
      <div style={{ padding: '20px', display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'space-between', borderBottom: '1px solid #333', zIndex: 10, background: '#111', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{margin: '0 0 5px 0'}}>Order Book Organism</h2>
          <p style={{margin: 0, fontSize: '0.9em', color: '#888'}}>Mid Price: {stats.price.toFixed(2)}</p>
          <button onClick={() => setShowExplanation(!showExplanation)} style={{ marginTop: '5px', fontSize: '0.8em', background: 'transparent', color: '#888', border: '1px solid #444', padding: '3px 8px', cursor: 'pointer', borderRadius: '4px' }}>
             {showExplanation ? 'Hide Info' : 'Info'}
          </button>
        </div>

        <div>
           <h3 style={{margin: '0 0 5px 0', fontSize: '1em'}}>Agent Status</h3>
           <div style={{fontSize: '0.9em'}}>
               <span style={{ color: '#00d1ff', marginRight: '10px' }}>Inv: {stats.inventory}</span>
               <span style={{ color: stats.pnl >= 0 ? '#00ff88' : '#ff4444' }}>
                   PnL: {stats.pnl.toFixed(2)}
               </span>
           </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '180px' }}>
            {/* Speed Control */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '0.8em', width: '50px' }}>Speed</label>
                <input
                    type="range"
                    min="0.1"
                    max="5.0"
                    step="0.1"
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    style={{flex: 1, marginLeft: '10px'}}
                />
                <span style={{ fontSize: '0.8em', width: '30px', textAlign: 'right' }}>{speed.toFixed(1)}x</span>
            </div>

            {/* Volatility Control */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '0.8em', width: '50px' }}>Vol</label>
                <input
                    type="range"
                    min="0.5"
                    max="10.0"
                    step="0.5"
                    value={volatility}
                    onChange={(e) => setVolatility(parseFloat(e.target.value))}
                    style={{flex: 1, marginLeft: '10px'}}
                />
                <span style={{ fontSize: '0.8em', width: '30px', textAlign: 'right' }}>{volatility}</span>
            </div>

             <label style={{ fontSize: '0.8em', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px', cursor: 'pointer' }}>
                <input type="checkbox" checked={agentEnabled} onChange={(e) => setAgentEnabled(e.target.checked)} />
                AI Market Maker Agent
            </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
             <button
                    onClick={() => handleInjectMarketOrder('BID')}
                    style={{
                        padding: '10px 15px',
                        background: '#00ff88',
                        color: 'black',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '0.8em',
                        boxShadow: '0 0 10px rgba(0,255,136,0.3)',
                        transition: 'transform 0.1s'
                    }}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                    BUY SHOCK
                </button>
                <button
                    onClick={() => handleInjectMarketOrder('ASK')}
                    style={{
                        padding: '10px 15px',
                        background: '#ff4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                         fontSize: '0.8em',
                         boxShadow: '0 0 10px rgba(255,68,68,0.3)',
                         transition: 'transform 0.1s'
                    }}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                    SELL SHOCK
                </button>
        </div>
      </div>

      {/* Explanation Overlay */}
      {showExplanation && (
          <div style={{
              position: 'absolute',
              top: '120px',
              left: '20px',
              width: '300px',
              background: 'rgba(0,0,0,0.95)',
              border: '1px solid #444',
              padding: '20px',
              borderRadius: '8px',
              zIndex: 20,
              fontSize: '0.9em',
              lineHeight: '1.4',
              color: '#ddd'
          }}>
              <h3 style={{ marginTop: 0 }}>Order Book Viz</h3>
              <p>Visualizing a Limit Order Book with histograms.</p>
              <ul style={{ paddingLeft: '20px' }}>
                  <li><span style={{color: '#00ff88'}}>Green Bars</span>: Buy Orders (Bids).</li>
                  <li><span style={{color: '#ff4444'}}>Red Bars</span>: Sell Orders (Asks).</li>
                  <li><strong>Vertical Axis:</strong> Price.</li>
                  <li><strong>Horizontal Axis:</strong> Volume/Depth.</li>
              </ul>
              <p>The <span style={{color: '#00d1ff'}}>Blue Agent</span> is a market maker bot attempting to profit from the spread.</p>
              <button onClick={() => setShowExplanation(false)} style={{marginTop: '10px', width: '100%', padding: '5px', cursor: 'pointer'}}>Close</button>
          </div>
      )}

      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {width > 0 && height > 0 && (
            <OrderBookCanvas
                lobState={lobState}
                width={width}
                height={height}
                centerRatio={0.5}
            />
        )}
      </div>
    </div>
  );
};
