import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { type Point } from './math';

interface CanvasRendererProps {
  paths: Point[][];
  width: number;
  height: number;
  K: number;
  onStrikeChange: (val: number) => void;
  optionPrice: number;
}

export const CanvasRenderer: React.FC<CanvasRendererProps> = ({
  paths, width, height, K, onStrikeChange, optionPrice
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const animationRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  // Reset animation when paths change
  useEffect(() => {
    startTimeRef.current = performance.now();
  }, [paths]);

  const xDomain = useMemo(() => {
    if (paths.length === 0) return [0, 100];
    return [0, paths[0].length - 1];
  }, [paths]);

  const yDomain = useMemo(() => {
    if (paths.length === 0) return [0, 100];
    let min = Infinity, max = -Infinity;
    // Iterate all points to find global min/max
    for (const path of paths) {
      for (const p of path) {
        if (p.y < min) min = p.y;
        if (p.y > max) max = p.y;
      }
    }
    // Add padding
    const padding = (max - min) * 0.1;
    return [Math.max(0, min - padding), max + padding];
  }, [paths]);

  const xScale = useMemo(() => d3.scaleLinear().domain(xDomain).range([0, width - 120]), [xDomain, width]); // Leave space for histogram
  const yScale = useMemo(() => d3.scaleLinear().domain(yDomain).range([height, 0]), [yDomain, height]);

  // Histogram Data
  const histogramBins = useMemo(() => {
    if (paths.length === 0) return [];
    const finalPrices = paths.map(p => p[p.length - 1].y);
    const binner = d3.bin().domain(yDomain as [number, number]).thresholds(40);
    return binner(finalPrices);
  }, [paths, yDomain]);

  const maxBinLength = useMemo(() => {
      if (histogramBins.length === 0) return 1;
      return Math.max(...histogramBins.map(b => b.length));
  }, [histogramBins]);

  const histogramScale = useMemo(() => d3.scaleLinear().domain([0, maxBinLength]).range([0, 100]), [maxBinLength]); // Width of histogram bars


  const animate = (time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Animation progress
    const duration = 2000; // 2 seconds
    const elapsed = time - startTimeRef.current;
    const progress = Math.min(1, elapsed / duration);
    // Easing
    const easedProgress = 1 - Math.pow(1 - progress, 3); // Cubic out

    const maxStepIndex = Math.floor(easedProgress * (paths[0]?.length || 0));

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Draw Background
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, width, height);

    // Draw Paths
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1;

    // Batch drawing?
    // We iterate paths.

    paths.forEach(path => {
       if (path.length === 0) return;
       const finalY = path[path.length - 1].y;
       const isITM = finalY > K;

       // Color: ITM = Cyan/Green, OTM = Red/Orange
       ctx.strokeStyle = isITM ? 'rgba(0, 255, 200, 0.15)' : 'rgba(255, 50, 50, 0.15)';

       ctx.beginPath();
       ctx.moveTo(xScale(path[0].x), yScale(path[0].y));
       // Draw up to maxStepIndex
       // To optimize, we can just lineTo all points
       const drawUpTo = Math.min(maxStepIndex, path.length - 1);
       for(let i=1; i <= drawUpTo; i++) {
            ctx.lineTo(xScale(path[i].x), yScale(path[i].y));
       }
       ctx.stroke();
    });

    ctx.globalCompositeOperation = 'source-over';

    // Draw Strike Line
    const yK = yScale(K);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, yK);
    ctx.lineTo(width, yK);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Strike Label
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.fillText(`Strike (K): ${K.toFixed(2)}`, 10, yK - 8);


    // Draw Histogram on Right
    // Always draw it, but maybe fade it in? Or just draw it.
    // Spec says "At the very end of the time axis (T)..."
    // Let's draw it always so user sees distribution even during animation, or reveal it?
    // "As paths finish their journey..." - maybe reveal.
    // Let's make opacity depend on progress.
    const histOpacity = Math.max(0, (progress - 0.5) * 2);

    if (histOpacity > 0) {
        const histXBase = width - 110;
        ctx.fillStyle = `rgba(200, 200, 255, ${histOpacity * 0.3})`;

        histogramBins.forEach(bin => {
            if (bin.length === 0) return;
            const y0 = yScale(bin.x0 || 0);
            const y1 = yScale(bin.x1 || 0);
            const h = Math.abs(y0 - y1);
            const w = histogramScale(bin.length);

            ctx.fillRect(histXBase, Math.min(y0, y1), w, Math.max(1, h - 1));
        });

        // Axis line for histogram
        ctx.strokeStyle = `rgba(100,100,100, ${histOpacity})`;
        ctx.beginPath();
        ctx.moveTo(histXBase, 0);
        ctx.lineTo(histXBase, height);
        ctx.stroke();
    }

    // Option Price Display
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`Option Price: ${optionPrice.toFixed(2)}`, width - 20, 40);

    // Draw current average price of visible paths?
    // Maybe too much noise.

    ctx.textAlign = 'left';

    animationRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [paths, K, width, height, xScale, yScale, histogramBins, optionPrice]);


  // Interaction
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    updateStrike(e);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (isDragging) {
          updateStrike(e);
      }
  };

  const handleMouseUp = () => {
      setIsDragging(false);
  };

  const updateStrike = (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const y = e.clientY - rect.top;
      const clampedY = Math.max(0, Math.min(height, y));
      const newK = yScale.invert(clampedY);
      onStrikeChange(newK);
  }

  return (
    <div style={{ position: 'relative' }}>
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            style={{
                border: '1px solid #333',
                background: '#111',
                borderRadius: '4px',
                cursor: isDragging ? 'grabbing' : 'row-resize',
                display: 'block'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        />
        <div style={{
            position: 'absolute',
            top: 10,
            left: 10,
            color: '#888',
            pointerEvents: 'none',
            fontFamily: 'monospace'
        }}>
            Drag vertical to change Strike
        </div>
    </div>
  );
};
