import React, { useEffect, useRef, useState, useCallback } from 'react';
import { LobEngine } from './LobEngine';
import { NoiseGenerator } from './NoiseGenerator';
import { Agent } from './Agent';
import { OrderBookCanvas } from './OrderBookCanvas';
import type { LobState } from './types';

export const OrderBookApp: React.FC = () => {
  // Use Refs for the engine to avoid re-renders on every tick logic
  const engineRef = useRef(new LobEngine(100));
  const noiseRef = useRef(new NoiseGenerator(100));
  const agentRef = useRef(new Agent());

  // State for UI stats (low frequency updates)
  const [stats, setStats] = useState({
      price: 100,
      inventory: 0,
      pnl: 0,
      fps: 0
  });

  // State for Visualization (high frequency)
  // We use a Ref to store the latest state to pass to Canvas,
  // but to trigger a render of the Canvas component, we might need state or a requestAnimationFrame loop that draws.
  // Actually, OrderBookCanvas useEffect depends on `lobState`.
  // If we update state 60 times a second, React might choke.
  // Better approach:
  // The `OrderBookCanvas` should perhaps just take a Ref to the engine and pull data in its own loop?
  // Or we update a `lobState` React state every frame? React 18 is fast, but 60fps might be tough with full object copying.
  // "State Management: Use useRef for the Order Book data to avoid React re-render bottlenecks. Only use useState for high-level UI stats"
  // This implies the Canvas should probably be imperative or controlled by the loop directly.
  // Let's modify OrderBookCanvas to accept the raw data via a Ref or method, OR just pass the state but rely on the parent's loop to force update?
  // Let's try passing state. If it's slow, we optimize.
  // To avoid React render loop, we can put the Canvas drawing logic INSIDE the main loop here,
  // and just pass a ref to the canvas element to a drawing function.
  // Let's refactor `OrderBookCanvas` to be a dumb canvas and we draw from here?
  // Or keep `OrderBookCanvas` but expose a `draw(state)` method?
  // Let's go with passing state but using `requestAnimationFrame` to drive the state updates.

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
          // Run agent every ~100ms or every N ticks
          if (frameCountRef.current % 10 === 0) {
              agentRef.current.decide(engineRef.current, Date.now());
              agentRef.current.updatePortfolio(engineRef.current.getState().trades); // Check recent trades?
              // Actually Agent needs to know if ITS orders were filled.
              // We passed 'trades' to updatePortfolio. But we need only NEW trades.
              // For MVP, let's just calc PnL based on inventory * price.
              // We should probably clear trades from engine occasionally.
          }

          // Cleanup
          if (frameCountRef.current % 60 === 0) {
              engineRef.current.cleanup();
          }

          // 3. Update State for Render
          const currentState = engineRef.current.getState();
          setLobState(currentState);

          // Update UI Stats less frequently (e.g. every 1 sec)
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
  }, []);

  useEffect(() => {
      requestRef.current = requestAnimationFrame(loop);
      return () => {
          if (requestRef.current) cancelAnimationFrame(requestRef.current);
      };
  }, [loop]);

  const handleInjectMarketOrder = () => {
      // Inject a massive market order
      const side = Math.random() > 0.5 ? 'BID' : 'ASK';
      const order: import('./types').Order = {
          id: `manual-shock-${Date.now()}`,
          price: 0, // Market order ignores price
          volume: 50, // Massive volume
          type: 'MARKET',
          side: side,
          owner: 'NOISE',
          timestamp: Date.now()
      };
      engineRef.current.addOrder(order);
  };

  return (
    <div style={{ width: '100%', height: '100vh', backgroundColor: '#111', color: '#eee', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #333' }}>
        <div>
          <h2>Order Book Organism</h2>
          <p>Mid Price: {stats.price.toFixed(2)}</p>
        </div>
        <div>
           <h3>Agent Status</h3>
           <p style={{ color: '#00d1ff' }}>Inventory: {stats.inventory}</p>
           <p style={{ color: stats.pnl >= 0 ? '#00ff88' : '#ff4444' }}>
               PnL: {stats.pnl.toFixed(2)}
           </p>
        </div>
        <div>
            <button
                onClick={handleInjectMarketOrder}
                style={{
                    padding: '10px 20px',
                    background: '#ff0055',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                }}
            >
                INJECT SHOCK
            </button>
            <p style={{ fontSize: '0.8em', marginTop: '5px' }}>FPS: {stats.fps}</p>
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative' }} onClick={handleInjectMarketOrder}>
        {/* We use a container to measure dimensions if needed, or just full width/height */}
        <OrderBookCanvas lobState={lobState} width={window.innerWidth} height={window.innerHeight - 100} />
      </div>
    </div>
  );
};
