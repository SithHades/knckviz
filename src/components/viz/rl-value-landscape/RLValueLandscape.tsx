
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Stars } from '@react-three/drei';
import { GridHelper } from 'three';
import { GridWorld, QLearner, GRID_SIZE, ACTIONS } from './QAgent';
import { Landscape } from './Landscape';
import { AgentEntity } from './AgentEntity';

export default function RLValueLandscape() {
  // Logic State
  const [gridWorld] = useState(() => new GridWorld());
  const [learner] = useState(() => new QLearner(GRID_SIZE));
  const [agentPos, setAgentPos] = useState({ x: 0, y: 0 });
  const [qValues, setQValues] = useState<Float32Array>(new Float32Array(GRID_SIZE * GRID_SIZE));

  // Simulation params
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(100); // ms per step
  const [alpha, setAlpha] = useState(0.1);
  const [gamma, setGamma] = useState(0.9);

  // Refs for animation loop without re-renders affecting logic speed too much
  const learnerRef = useRef(learner);
  const gridWorldRef = useRef(gridWorld);
  const agentPosRef = useRef(agentPos);

  // Sync refs when state changes from UI
  useEffect(() => {
    learnerRef.current.alpha = alpha;
  }, [alpha]);

  useEffect(() => {
    learnerRef.current.gamma = gamma;
  }, [gamma]);

  // Step function
  const step = useCallback(() => {
    const { x, y } = agentPosRef.current;
    const actionIdx = learnerRef.current.chooseAction(x, y);
    const action = ACTIONS[actionIdx];

    let nextX = x;
    let nextY = y;

    if (action === 'UP') nextY = Math.min(GRID_SIZE - 1, y + 1);
    if (action === 'DOWN') nextY = Math.max(0, y - 1);
    if (action === 'LEFT') nextX = Math.max(0, x - 1);
    if (action === 'RIGHT') nextX = Math.min(GRID_SIZE - 1, x + 1);

    // Get Reward
    const reward = gridWorldRef.current.getReward(nextX, nextY);

    // Update Q-Table
    learnerRef.current.update(x, y, actionIdx, reward, nextX, nextY);

    // Move Agent
    // Check for terminal states (Goal or Pit) to reset position
    const cellType = gridWorldRef.current.getCell(nextX, nextY);

    if (cellType === 'GOAL' || cellType === 'PIT') {
        // Reset to start
        agentPosRef.current = { x: 0, y: 0 };
    } else {
        agentPosRef.current = { x: nextX, y: nextY };
    }

    // Trigger React update for Visuals
    setAgentPos(agentPosRef.current);

    // Update Q-Values for visualization
    // We align the texture data so that x maps to columns (U) and y maps to rows (V).
    const newQValues = new Float32Array(GRID_SIZE * GRID_SIZE);
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        // index = y * width + x
        newQValues[y * GRID_SIZE + x] = learnerRef.current.getMaxQ(x, y);
      }
    }
    setQValues(newQValues);

  }, []);

  // Loop
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(step, speed);
    return () => clearInterval(interval);
  }, [isRunning, speed, step]);


  const handleLandscapeClick = (x: number, y: number) => {
    // Toggle obstacles
    const current = gridWorldRef.current.getCell(x, y);
    if (current === 'EMPTY') {
        gridWorldRef.current.setCell(x, y, 'PIT');
    } else if (current === 'PIT') {
        gridWorldRef.current.setCell(x, y, 'GOAL');
    } else {
        gridWorldRef.current.setCell(x, y, 'EMPTY');
    }
    // Force re-render of qValues to reflect potential immediate reward changes?
    // No, Q-values update on agent interaction. But landscape might need to show pits/goals?
    // We strictly visualize Q-Values (Height). Pits will eventually become deep valleys.
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000' }}>

      {/* UI Overlay */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        zIndex: 10,
        background: 'rgba(0,0,0,0.8)',
        padding: '20px',
        borderRadius: '8px',
        color: 'white',
        border: '1px solid #333',
        maxWidth: '300px'
      }}>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '1.2rem', color: '#00ffff' }}>RL Value Landscape</h2>
        <div style={{ marginBottom: '10px', fontSize: '0.9rem', color: '#ccc' }}>
            Visualizing Q-Learning on a 20x20 grid. <br/>
            High peaks = High Value. <br/>
            Click grid to add Pits/Goals.
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <button
                onClick={() => setIsRunning(!isRunning)}
                style={{
                    background: isRunning ? '#ff4444' : '#44ff44',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    color: '#000'
                }}
            >
                {isRunning ? 'Stop' : 'Start Simulation'}
            </button>
            <button
                onClick={() => {
                    learnerRef.current.reset();
                    setQValues(new Float32Array(GRID_SIZE * GRID_SIZE));
                }}
                style={{
                    background: '#333',
                    border: '1px solid #666',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: '#fff'
                }}
            >
                Reset
            </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '10px' }}>
            <label>Speed: {speed}ms</label>
            <input
                type="range"
                min="10"
                max="500"
                step="10"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
            />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '10px' }}>
            <label>Learning Rate (α): {alpha}</label>
            <input
                type="range"
                min="0.01"
                max="1.0"
                step="0.01"
                value={alpha}
                onChange={(e) => setAlpha(Number(e.target.value))}
            />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label>Discount (γ): {gamma}</label>
            <input
                type="range"
                min="0.1"
                max="0.99"
                step="0.01"
                value={gamma}
                onChange={(e) => setGamma(Number(e.target.value))}
            />
        </div>
      </div>

      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 15, 20]} />
        <OrbitControls enableDamping dampingFactor={0.05} />

        <color attach="background" args={['#050510']} />
        <fog attach="fog" args={['#050510', 10, 50]} />

        <ambientLight intensity={0.5} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

        {/* Landscape */}
        <Landscape
            qValues={qValues}
            agentPos={agentPos}
            onClick={handleLandscapeClick}
        />

        {/* Agent */}
        <AgentEntity x={agentPos.x} y={agentPos.y} qValues={qValues} />

        <gridHelper position={[0, 0.01, 0]} args={[20, 20, 0x444444, 0x222222]} />
      </Canvas>
    </div>
  );
}
