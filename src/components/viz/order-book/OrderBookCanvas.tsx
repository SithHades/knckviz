import React, { useRef, useEffect } from 'react';
import type { LobState, Order, Trade } from './types';

interface OrderBookCanvasProps {
  lobState: LobState;
  width: number;
  height: number;
}

// Particle System
class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;

  constructor(x: number, y: number, color: string) {
    this.x = x;
    this.y = y;
    // Random velocity
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = (Math.random() - 0.5) * 2;
    this.life = 1.0;
    this.color = color;
    this.size = Math.random() * 3 + 2;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= 0.02;
    this.size *= 0.95;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }
}

export const OrderBookCanvas: React.FC<OrderBookCanvasProps> = ({ lobState, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);

  // We need to map Price (Y) and Volume/Depth (X)
  // We need a stable range for Price Y-Axis.
  // Center roughly on lastPrice.
  // Let's say window is +/- 10% of price? Or dynamic?
  // Dynamic is better but can be jittery.
  // Let's use a smoothed camera.
  const cameraY = useRef(100);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Smooth camera to lastPrice
    const targetY = lobState.lastPrice;
    cameraY.current += (targetY - cameraY.current) * 0.1;

    // Clear
    ctx.fillStyle = '#000000'; // or clearRect for transparent
    // Wait, let's use transparent background and let CSS handle the dark theme?
    // Or explicit black. Let's do clearRect.
    ctx.clearRect(0, 0, width, height);

    // Coordinate System
    // Y: Price. Center of screen is cameraY. Scale: 1 unit price = 50 pixels?
    const priceScale = height / 20; // Show roughly 20 price units height
    const getPriceY = (p: number) => {
        return height / 2 - (p - cameraY.current) * priceScale;
    };

    // X: Cumulative Volume (Depth). Center is 0?
    // Let's Put Bids on Left, Asks on Right.
    // Center of screen is 0 volume?
    // Or standard Depth Chart:
    // Bids: Start from mid, go Left. Asks: Start from mid, go Right.
    const midX = width / 2;
    const volumeScale = 5; // 1 volume = 5 pixels

    // Draw "Spread" line
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(midX, 0);
    ctx.lineTo(midX, height);
    ctx.stroke();

    // Draw Orders
    // Helper to draw glowing circle
    const drawOrder = (order: Order, x: number, y: number) => {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);

        if (order.owner === 'AGENT') {
            ctx.fillStyle = '#00d1ff'; // Electric Blue
            ctx.shadowColor = '#00d1ff';
        } else if (order.side === 'BID') {
            ctx.fillStyle = '#00ff88'; // Neon Green
            ctx.shadowColor = '#00ff88';
        } else {
            ctx.fillStyle = '#ff4444'; // Neon Red
            ctx.shadowColor = '#ff4444';
        }

        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
    };

    // Render Bids (Left side)
    // We want to visualize depth. So we stack them?
    // Or just visualize individual orders floating?
    // "Orders should be rendered as glowing circles/particles."
    // Let's place them at Y=Price, X=CumulativeVolume distance from center.
    let cumVol = 0;
    lobState.bids.forEach(bid => {
        const y = getPriceY(bid.price);
        // Don't render if off screen
        if (y < -50 || y > height + 50) return;

        // Randomize X slightly within its volume block for "cloud" effect?
        // Or strictly stacked?
        // Let's do strictly stacked for depth visualization.
        const xStart = midX - (cumVol * volumeScale);
        const xEnd = midX - ((cumVol + bid.volume) * volumeScale);
        const xCenter = (xStart + xEnd) / 2;

        drawOrder(bid, xCenter, y);
        cumVol += bid.volume;
    });

    // Render Asks (Right side)
    cumVol = 0;
    lobState.asks.forEach(ask => {
        const y = getPriceY(ask.price);
        if (y < -50 || y > height + 50) return;

        const xStart = midX + (cumVol * volumeScale);
        const xEnd = midX + ((cumVol + ask.volume) * volumeScale);
        const xCenter = (xStart + xEnd) / 2;

        drawOrder(ask, xCenter, y);
        cumVol += ask.volume;
    });

    // Handle Trades (Explosions/Lines)
    // We need to detect NEW trades since last frame to trigger effects.
    // For now, let's just assume we might pass a "events" list or handle it in parent.
    // But wait, the `lobState` passed here is a snapshot.
    // Ideally the parent manages the particle effects for trades?
    // Or we just check the recent trades in lobState and if they are "fresh" (timestamp near now) we draw them.
    const now = Date.now();
    lobState.trades.forEach(trade => {
        if (now - trade.timestamp < 500) { // flash for 500ms
            const y = getPriceY(trade.price);

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(midX - 20, y);
            ctx.lineTo(midX + 20, y);
            ctx.stroke();

            // Add explosion particles if new
            // This is tricky in a stateless render unless we track which ones we've exploded.
            // Let's cheat: Random chance to spawn particles if it's very recent?
            // Better: The parent component calls a method on this ref or passes an event queue.
            // But for simplicity:
            if (now - trade.timestamp < 50) {
                 // Spawn particles
                 for(let i=0; i<5; i++) {
                     particlesRef.current.push(new Particle(midX, y, '#ffffff'));
                 }
            }
        }
    });

    // Update and Draw Particles
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
    particlesRef.current.forEach(p => {
        p.update();
        p.draw(ctx);
    });

  }, [lobState, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ display: 'block' }} />;
};
