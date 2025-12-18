
import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { type PortfolioPoint, type Asset } from './math';

interface CanvasRendererProps {
  points: PortfolioPoint[];
  assets: Asset[];
  width: number;
  height: number;
}

// Particle class for managing state and animation
class Particle {
  point: PortfolioPoint;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  color: string;
  speed: number;

  constructor(point: PortfolioPoint, targetX: number, targetY: number, startY: number, color: string) {
    this.point = point;
    this.targetX = targetX;
    this.targetY = targetY;
    this.x = targetX; // Start at target X (or could be random X)
    this.y = startY;
    this.color = color;
    // Random speed between 0.1 and 0.3 (fraction of distance per frame) or pixels per frame
    this.speed = 0.05 + Math.random() * 0.1;
  }

  update(newTargetX: number, newTargetY: number) {
    this.targetX = newTargetX;
    this.targetY = newTargetY;
  }

  step() {
    // Lerp towards target
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;

    // Simple easing
    this.x += dx * 0.1;
    this.y += dy * 0.1;

    // "Rain" logic for initialization could be different, but "Lerp" covers both
    // "falling" (target is below) and "adjusting" (target moved).
    // If we want explicit "falling", we could check if we haven't reached target Y yet.
  }
}

export const CanvasRenderer: React.FC<CanvasRendererProps> = ({ points, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const requestRef = useRef<number>(0);

  // Scales
  // Calculate domains based on points, with some padding
  const xDomain = useMemo(() => {
    if (points.length === 0) return [0, 1];
    const min = Math.min(...points.map(p => p.risk));
    const max = Math.max(...points.map(p => p.risk));
    return [Math.max(0, min * 0.8), max * 1.1]; // Zoom out a bit
  }, [points]);

  const yDomain = useMemo(() => {
    if (points.length === 0) return [0, 1];
    const min = Math.min(...points.map(p => p.return));
    const max = Math.max(...points.map(p => p.return));
    return [min * 0.8, max * 1.1];
  }, [points]);

  const xScale = useMemo(() => d3.scaleLinear().domain(xDomain).range([50, width - 50]), [xDomain, width]);
  const yScale = useMemo(() => d3.scaleLinear().domain(yDomain).range([height - 50, 50]), [yDomain, height]);
  const colorScale = useMemo(() => d3.scaleSequential(d3.interpolateViridis).domain([
    Math.min(...points.map(p => p.sharpe)),
    Math.max(...points.map(p => p.sharpe))
  ]), [points]);


  // Initialize or Update Particles
  useEffect(() => {
    // If points array size changed significantly (new batch), we might need to add particles
    // Or if we just re-rendered with same points but different calculated risk/return (because of correlation change)
    // We need to map `points` to `particles`.
    // Since `points` are recreated every simulation step or correlation change,
    // we need to track them.
    // Ideally, `points` should have IDs or we assume index correspondence.

    // Let's assume index correspondence for simplicity since we regenerate the whole batch on correlation change?
    // Wait, the prompt said: "When a slider moves... particles should use a Lerp... showing how the Frontier expands".
    // This implies the underlying weights are stable.

    // In `EfficientFrontierApp`, I should probably keep `weights` stable and re-calculate `return`/`risk` on the fly
    // or pass `weights` and `covariance` to this component?
    // No, passing `points` is cleaner, but `points` should be stable objects or array indices.

    // Let's rebuild particles array if length differs, otherwise update targets.

    if (particlesRef.current.length !== points.length) {
       // Initialize rain
       particlesRef.current = points.map(p => {
         const targetX = xScale(p.risk);
         const targetY = yScale(p.return);
         // Start from top, random x slightly offset? Or same x?
         // "Fall from the top of the chart to their (x, y)"
         return new Particle(p, targetX, targetY, -10, colorScale(p.sharpe));
       });
    } else {
       // Update targets
       points.forEach((p, i) => {
         particlesRef.current[i].point = p;
         particlesRef.current[i].update(xScale(p.risk), yScale(p.return));
         particlesRef.current[i].color = colorScale(p.sharpe);
       });
    }
  }, [points, xScale, yScale, colorScale]);


  // Animation Loop
  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // Draw Axes
    ctx.strokeStyle = '#555';
    ctx.beginPath();
    ctx.moveTo(50, height - 50);
    ctx.lineTo(width - 50, height - 50); // X axis
    ctx.moveTo(50, height - 50);
    ctx.lineTo(50, 50); // Y axis
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#aaa';
    ctx.font = '12px sans-serif';
    ctx.fillText('Risk (Std Dev)', width / 2, height - 15);
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Expected Return', 0, 0);
    ctx.restore();

    // Draw Particles
    particlesRef.current.forEach(p => {
      p.step();
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Draw Frontier Line
    // We need to calculate the frontier from the CURRENT positions or TARGET positions?
    // Probably target positions (the mathematical truth).
    // Identify points with highest return for given risk buckets.

    // Bucket size
    const xMin = xDomain[0];
    const xMax = xDomain[1];
    const buckets = 50;
    const step = (xMax - xMin) / buckets;

    const frontierPoints: {x: number, y: number}[] = [];

    for (let i = 0; i < buckets; i++) {
        const minRisk = xMin + i * step;
        const maxRisk = minRisk + step;

        // Find max return in this risk range
        // We use the `points` prop for the source of truth
        const candidates = points.filter(p => p.risk >= minRisk && p.risk < maxRisk);
        if (candidates.length > 0) {
            const maxReturnPoint = candidates.reduce((prev, current) => (prev.return > current.return) ? prev : current);
            frontierPoints.push({ x: xScale(maxReturnPoint.risk), y: yScale(maxReturnPoint.return) });
        }
    }

    if (frontierPoints.length > 1) {
        // Draw spline
        // Using D3 line generator on canvas
        const lineGenerator = d3.line<{x: number, y: number}>()
            .x(d => d.x)
            .y(d => d.y)
            .curve(d3.curveMonotoneX)
            .context(ctx);

        ctx.beginPath();
        lineGenerator(frontierPoints);
        ctx.strokeStyle = '#00ff00'; // Neon Green
        ctx.lineWidth = 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ff00';
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset
    }


    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [width, height, points]); // Re-bind animation if props change, though animate closes over refs so it might be fine.

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ border: '1px solid #333', background: '#111', borderRadius: '4px' }}
    />
  );
};
