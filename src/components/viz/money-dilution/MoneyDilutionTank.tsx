import React, { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';

const MoneyDilutionTank: React.FC = () => {
  const sceneRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);

  // Simulation State
  const [qeIntensity, setQeIntensity] = useState<number>(5); // Particles per interval
  const [totalCount, setTotalCount] = useState<number>(0);
  const goldBodyRef = useRef<Matter.Body | null>(null);

  // Refs for loop management
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!sceneRef.current) return;

    // 1. Setup Matter.js
    const Engine = Matter.Engine,
          Render = Matter.Render,
          Runner = Matter.Runner,
          Bodies = Matter.Bodies,
          Composite = Matter.Composite,
          Events = Matter.Events,
          Body = Matter.Body;

    const engine = Engine.create();
    const world = engine.world;
    engineRef.current = engine;

    const width = 800;
    const height = 600;

    const render = Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width,
        height,
        wireframes: false, // We will use custom rendering styles
        background: '#0a0a0a',
        pixelRatio: window.devicePixelRatio,
      }
    });
    renderRef.current = render;

    // 2. Create Tank (Walls) - Wireframe Style
    const wallOptions = {
      isStatic: true,
      render: {
          fillStyle: 'transparent',
          strokeStyle: '#ffffff',
          lineWidth: 2
      }
    };
    const ground = Bodies.rectangle(width / 2, height - 10, width - 40, 20, wallOptions);
    const leftWall = Bodies.rectangle(20, height / 2, 20, height, wallOptions);
    const rightWall = Bodies.rectangle(width - 20, height / 2, 20, height, wallOptions);

    Composite.add(world, [ground, leftWall, rightWall]);

    // 3. Create Gold Floating Object
    const goldRadius = 40;
    const gold = Bodies.circle(width / 2, height - 100, goldRadius, {
      density: 0.001,
      restitution: 0.5,
      friction: 0.1,
      render: {
        fillStyle: '#FFD700',
        strokeStyle: '#FFF',
        lineWidth: 2,
      },
      label: 'Gold'
    });
    goldBodyRef.current = gold;
    Composite.add(world, gold);

    // 4. Run
    Render.run(render);
    const runner = Runner.create();
    runnerRef.current = runner;
    Runner.run(runner, engine);

    // Update loop
    Events.on(engine, 'beforeUpdate', () => {
       const bodies = Composite.allBodies(world);
       const fiatParticles = bodies.filter(b => b.label === 'Fiat');
       const particleCount = fiatParticles.length;
       setTotalCount(particleCount);

       // Dilution Logic: Opacity decreases as count increases
       const dilutionFactor = Math.max(0.1, 1 - (particleCount / 1500));

       fiatParticles.forEach(body => {
           body.render.opacity = dilutionFactor;
           // Performance: Remove particles if they fall out of bounds (e.g. overflow)
           if (body.position.y > height + 50 || body.position.x < -50 || body.position.x > width + 50) {
               Composite.remove(world, body);
           }
       });

       // Performance Cap: Remove oldest particles if too many
       const MAX_PARTICLES = 1500;
       if (particleCount > MAX_PARTICLES) {
           // Remove the first few (oldest)
           const toRemove = fiatParticles.slice(0, particleCount - MAX_PARTICLES);
           Composite.remove(world, toRemove);
       }

       // Custom Force for Gold Floatation (Buoyancy Simulation)
       // We apply an upward force if the gold is surrounded by particles ("submerged")
       // or simply a constant upward force to counteract gravity slightly when overlapping?
       // Let's implement a simple "Buoyancy" logic:
       // If Gold is below a certain height relative to the pile, push it up.
       // Actually, the prompt says "Use a Matter.Constraint or a custom force".
       // A custom force that acts against gravity: F = -m * g * k
       // We only want it to float *on particles*, not fly away.
       // So we can check collisions or just density.
       // Let's rely on the density difference + a slight custom "uplift" jitter to keep it dynamic.
       if (goldBodyRef.current) {
           const g = goldBodyRef.current;
           // Apply a small upward force to simulate "high demand" / buoyancy
           // only if it is touching other bodies (we can approximate this by position or collision check)
           // For simplicity, let's just use the density trick which works well in Matter.js,
           // but adding a small force satisfies the "custom force" requirement explicitly.

           // Counteract 20% of gravity constantly to make it feel "lighter" than air/money
           Body.applyForce(g, g.position, { x: 0, y: -g.mass * 0.0002 });
       }
    });

    // Custom Rendering for Glow
    Events.on(render, 'afterRender', () => {
        const context = render.context;
        const goldBody = goldBodyRef.current;
        if (goldBody) {
            const { x, y } = goldBody.position;
            context.save();
            context.translate(x, y);
            // Glow effect
            context.shadowColor = '#FFD700';
            context.shadowBlur = 20;
            context.beginPath();
            context.arc(0, 0, goldRadius, 0, 2 * Math.PI);
            context.fillStyle = '#FFD700';
            context.fill();
            context.strokeStyle = '#FFFFFF';
            context.lineWidth = 2;
            context.stroke();
            context.restore();
        }
    });

    return () => {
      Render.stop(render);
      Runner.stop(runner);
      if (render.canvas) render.canvas.remove();
      Composite.clear(world, false);
      Engine.clear(engine);
    };
  }, []);

  // Fountain Effect
  useEffect(() => {
    if (!engineRef.current) return;

    // Clean up previous interval
    if (intervalRef.current) clearInterval(intervalRef.current);

    // Calculate spawn rate based on intensity
    // Intensity 1-100.
    // 1 -> slow (e.g. 200ms)
    // 100 -> fast (e.g. 20ms)
    const spawnRate = Math.max(10, 210 - qeIntensity * 2);

    intervalRef.current = setInterval(() => {
        const engine = engineRef.current;
        if (!engine) return;

        // "Fountain" effect: Spawn from bottom center and shoot up?
        // Or keep Top-Down for "Dilution Tank"?
        // Prompt: "Implement a 'fountain' effect that spawns small circular bodies (Money Particles)."
        // Usually a fountain shoots up. But a "Dilution Tank" implies filling a tank.
        // A fountain can be inside a tank.
        // Let's spawn from the bottom center, shooting upwards, to act like a geyser of money.
        // This fits "Fountain" and "Money Printer goes brrr" (often depicted as shooting out).

        const x = 400 + (Math.random() - 0.5) * 20;
        const y = 550; // Bottom
        const particle = Matter.Bodies.circle(x, y, 6, {
           restitution: 0.7,
           friction: 0.001,
           density: 0.05,
           render: {
             fillStyle: '#39ff14',
             opacity: 1, // Start fully opaque
           },
           label: 'Fiat',
           collisionFilter: { group: 1 }
        });

        // Shoot up
        const forceMagnitude = 0.003 * particle.mass;
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5; // Upwards with spread
        Matter.Body.applyForce(particle, particle.position, {
            x: Math.cos(angle) * forceMagnitude,
            y: Math.sin(angle) * forceMagnitude
        });

        Matter.Composite.add(engine.world, particle);

    }, spawnRate);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };

  }, [qeIntensity]);

  return (
    <div className="flex flex-col items-center gap-4 w-full h-full text-white bg-slate-900 p-4">
      <h1 className="text-2xl font-bold text-[#39ff14]">Money Dilution Tank</h1>

      <div className="flex gap-8 w-full max-w-4xl">
        {/* Controls */}
        <div className="flex flex-col gap-4 w-64 p-4 border border-slate-700 rounded bg-slate-800 h-fit">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold">QE Intensity (Money Printer)</label>
            <input
              type="range"
              min="1"
              max="100"
              value={qeIntensity}
              onChange={(e) => setQeIntensity(parseInt(e.target.value))}
              className="accent-[#39ff14]"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>Conservative</span>
              <span>Hyper</span>
            </div>
          </div>

          <div className="mt-4 p-2 bg-slate-900 rounded border border-slate-700">
            <div className="text-slate-400 text-xs uppercase tracking-wider">Total Supply</div>
            <div className="text-2xl font-mono text-[#39ff14]">{totalCount}</div>
          </div>

          <div className="text-xs text-slate-500 mt-2">
            <p>Observe how the Gold asset (Store of Value) floats atop the expanding Fiat supply.</p>
          </div>
        </div>

        {/* Simulation Area */}
        <div className="relative border border-slate-700 rounded overflow-hidden bg-[#0a0a0a]">
          <div ref={sceneRef} className="w-[800px] h-[600px]" />

          {/* Historical Markers Overlay */}
          <div className="absolute top-0 right-0 h-full w-full pointer-events-none">
             <div className="absolute right-0 w-32 border-b border-dashed border-slate-500 text-slate-500 text-xs text-right pr-2" style={{ top: '350px' }}>
                2008 Level
             </div>
             <div className="absolute right-0 w-32 border-b border-dashed border-slate-400 text-slate-400 text-xs text-right pr-2" style={{ top: '150px' }}>
                2020 Level
             </div>
             <div className="absolute right-0 w-32 border-b border-red-500 text-red-500 text-xs text-right pr-2" style={{ top: '50px' }}>
                Hyperinflation
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MoneyDilutionTank;
