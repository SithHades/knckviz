import React, { useEffect, useRef, useState, useCallback } from 'react';
import { LobEngine } from './LobEngine';
import { NoiseGenerator } from './NoiseGenerator';
import { BaseAgent, NaiveMarketMaker, TrendFollower, DeepMarketMaker } from './Agent';
import { OrderBookCanvas } from './OrderBookCanvas';
import type { LobState, MarketRegime } from './types';

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

  // Initialize Agents
  const agentsRef = useRef<BaseAgent[]>([
      new NaiveMarketMaker({ id: 'AGENT_NAIVE', name: 'Naive MM', type: 'MM', color: '#00d1ff' }),
      new DeepMarketMaker({ id: 'AGENT_DEEP', name: 'Deep MM', type: 'MM', color: '#ae00ff' }),
      new TrendFollower({ id: 'AGENT_TREND', name: 'Trend Follower', type: 'TF', color: '#ffbd00' }),
  ]);

  const [activeAgents, setActiveAgents] = useState<Record<string, boolean>>({
      'AGENT_NAIVE': true,
      'AGENT_DEEP': false,
      'AGENT_TREND': false
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useResizeObserver(containerRef);

  // Stats
  const [stats, setStats] = useState({
      price: 100,
      fps: 0
  });

  const [agentStats, setAgentStats] = useState<Record<string, { inv: number, pnl: number }>>({});

  // Controls
  const [volatility, setVolatility] = useState(2.0);
  const [speed, setSpeed] = useState(1.0);
  const [regime, setRegime] = useState<MarketRegime>('STABLE');
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    noiseRef.current.setVolatility(volatility);
  }, [volatility]);

  useEffect(() => {
      noiseRef.current.setRegime(regime);
  }, [regime]);

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

      accumulatedSimTime.current += cappedDelta * speed;

      const timeStep = 16; // 60hz simulation steps
      let updates = 0;

      // Run simulation steps
      while (accumulatedSimTime.current >= timeStep && updates < 10) {
          // 1. Noise
          if (Math.random() > 0.5) {
             const order = noiseRef.current.generateOrder(Date.now());
             engineRef.current.addOrder(order);
          }
          if (Math.random() < 0.01) {
              noiseRef.current.updateFairPrice();
          }

          // 2. Agents
          const currentState = engineRef.current.getState();
          agentsRef.current.forEach(agent => {
              if (activeAgents[agent.id]) {
                  // Agents act with some probability per tick
                   if (Math.random() < 0.1) {
                      agent.decide(engineRef.current, Date.now());
                   }
                   agent.updatePortfolio(currentState.trades);
              } else {
                  // If deactivated, ensure no lingering orders?
                  // We can do this once when toggled, but doing it here is safe too,
                  // though inefficient. Better to handle in the toggle handler or
                  // check if it has orders. For now, we rely on the agent's logic
                  // to cancel its own orders, but if we don't call decide(), they stay.
                  // So we should clear them.
                  // Optimized: Check if orders exist for this agent in engine?
                  // Or just indiscriminately cancel every N frames.
                  // Let's implement a 'cleanup' for inactive agents.
                  if (Math.random() < 0.05) {
                      engineRef.current.cancelAllAgentOrders(agent.id);
                  }
              }
          });

          // Cleanup
          if (Math.random() < 0.02) {
             engineRef.current.cleanup();
          }

          accumulatedSimTime.current -= timeStep;
          updates++;
      }

      // 3. Render Update
      const currentState = engineRef.current.getState();
      setLobState(currentState);

      // UI Stats (Throttle)
      frameCountRef.current++;
      if (frameCountRef.current % 30 === 0) {
          setStats({
              price: currentState.lastPrice,
              fps: Math.round(1000 / (deltaTime || 16))
          });

          const newAgentStats: Record<string, { inv: number, pnl: number }> = {};
          agentsRef.current.forEach(agent => {
              newAgentStats[agent.id] = {
                  inv: agent.inventory,
                  pnl: agent.getUnrealizedPnL(currentState.lastPrice)
              };
          });
          setAgentStats(newAgentStats);
      }

      requestRef.current = requestAnimationFrame(loop);
  }, [speed, activeAgents]);

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

  const toggleAgent = (id: string) => {
      setActiveAgents(prev => {
          const newState = { ...prev, [id]: !prev[id] };
          if (!newState[id]) {
              // If turning off, cancel orders immediately
              engineRef.current.cancelAllAgentOrders(id);
          }
          return newState;
      });
  };

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#111', color: '#eee', display: 'flex', flexDirection: 'column' }}>

      {/* Header / HUD */}
      <div style={{ padding: '20px', display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'space-between', borderBottom: '1px solid #333', zIndex: 10, background: '#111', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{margin: '0 0 5px 0'}}>Order Book Organism</h2>
          <p style={{margin: 0, fontSize: '0.9em', color: '#888'}}>Mid Price: {stats.price.toFixed(2)}</p>
           <div style={{ marginTop: '5px', display: 'flex', gap: '5px' }}>
                <button onClick={() => setShowExplanation(!showExplanation)} style={{ fontSize: '0.8em', background: 'transparent', color: '#888', border: '1px solid #444', padding: '3px 8px', cursor: 'pointer', borderRadius: '4px' }}>
                     {showExplanation ? 'Hide Info' : 'Info'}
                </button>
           </div>
        </div>

        {/* Agents Control Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <h3 style={{margin: '0 0 5px 0', fontSize: '1em'}}>Active Agents</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {agentsRef.current.map(agent => (
                    <div key={agent.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85em' }}>
                        <input
                            type="checkbox"
                            checked={activeAgents[agent.id]}
                            onChange={() => toggleAgent(agent.id)}
                            style={{ accentColor: agent.color }}
                        />
                        <span style={{ color: agent.color, width: '100px' }}>{agent.name}</span>
                        <span style={{ width: '60px', textAlign: 'right' }}>Inv: {agentStats[agent.id]?.inv || 0}</span>
                        <span style={{ width: '80px', textAlign: 'right', color: (agentStats[agent.id]?.pnl || 0) >= 0 ? '#00ff88' : '#ff4444' }}>
                            PnL: {(agentStats[agent.id]?.pnl || 0).toFixed(1)}
                        </span>
                    </div>
                ))}
            </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '180px' }}>
             {/* Regime Control */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                <label style={{ fontSize: '0.8em' }}>Regime:</label>
                <select
                    value={regime}
                    onChange={(e) => setRegime(e.target.value as MarketRegime)}
                    style={{ background: '#222', color: '#eee', border: '1px solid #444', fontSize: '0.8em', padding: '2px 5px', borderRadius: '3px' }}
                >
                    <option value="STABLE">Stable</option>
                    <option value="UPTREND">Uptrend</option>
                    <option value="DOWNTREND">Downtrend</option>
                    <option value="VOLATILE">Volatile</option>
                </select>
            </div>

            {/* Speed Control */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '0.8em', width: '50px' }}>Speed</label>
                <input
                    type="range"
                    min="0.01"
                    max="2.0"
                    step="0.1"
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    style={{flex: 1, marginLeft: '10px'}}
                />
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
            </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
             <button
                    onClick={() => handleInjectMarketOrder('BID')}
                    style={{
                        padding: '8px 12px',
                        background: '#00ff88',
                        color: 'black',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '0.7em',
                    }}
                >
                    BUY SHOCK
                </button>
                <button
                    onClick={() => handleInjectMarketOrder('ASK')}
                    style={{
                        padding: '8px 12px',
                        background: '#ff4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                         fontSize: '0.7em',
                    }}
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
              <p>Visualizing a Limit Order Book with multiple competing agents.</p>
              <ul style={{ paddingLeft: '20px' }}>
                  <li><span style={{color: '#00d1ff'}}>Naive MM</span>: Standard inventory-keeping market maker.</li>
                  <li><span style={{color: '#ae00ff'}}>Deep MM</span>: Provides liquidity deep in the book (wide spread).</li>
                  <li><span style={{color: '#ffbd00'}}>Trend Follower</span>: Trades in the direction of momentum.</li>
              </ul>
              <p><strong>Regimes:</strong> Change the market conditions to see how agents adapt.</p>
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
