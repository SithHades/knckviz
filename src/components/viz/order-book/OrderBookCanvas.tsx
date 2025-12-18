import React, { useRef, useEffect } from 'react';
import type { LobState, Order } from './types';

interface OrderBookCanvasProps {
  lobState: LobState;
  width: number;
  height: number;
  centerRatio?: number; // 0 to 1, default 0.5
}

// Particle System for effects (Trades)
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
    this.vx = (Math.random() - 0.5) * 5;
    this.vy = (Math.random() - 0.5) * 5;
    this.life = 1.0;
    this.color = color;
    this.size = Math.random() * 2 + 1;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= 0.05;
    this.size *= 0.9;
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

export const OrderBookCanvas: React.FC<OrderBookCanvasProps> = ({ lobState, width, height, centerRatio = 0.5 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const cameraY = useRef(100);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Data Aggregation (Binning)
    // We want to bin orders by price level (e.g. 0.1 increments)
    const priceStep = 0.1;
    const bidBins = new Map<number, number>(); // price -> volume
    const askBins = new Map<number, number>();

    const quantize = (p: number) => Math.round(p / priceStep) * priceStep;

    lobState.bids.forEach(o => {
        const p = quantize(o.price);
        bidBins.set(p, (bidBins.get(p) || 0) + o.volume);
    });
    lobState.asks.forEach(o => {
        const p = quantize(o.price);
        askBins.set(p, (askBins.get(p) || 0) + o.volume);
    });

    // 2. Camera / Viewport Logic
    // Smooth camera to lastPrice
    const targetY = lobState.lastPrice;
    cameraY.current += (targetY - cameraY.current) * 0.1;

    // Coordinate System
    // Y: Price. Scale: 1 unit price = N pixels
    // We want to fit a certain range of prices on screen. e.g. +/- 5%
    const visiblePriceRange = lobState.lastPrice * 0.1; // 10% range
    // height = visiblePriceRange * priceScale
    // priceScale = height / visiblePriceRange
    // Ensure min range
    const priceScale = height / Math.max(visiblePriceRange, 20);

    const getPriceY = (p: number) => {
        return height / 2 - (p - cameraY.current) * priceScale;
    };

    // X: Volume.
    // Max volume in current view?
    // Let's find max volume in the visible bins to normalize bars
    // Or use a fixed log scale? Linear scale with auto-scaling?
    let maxVol = 10;
    for(const [p, v] of bidBins) {
        if (Math.abs(p - cameraY.current) < visiblePriceRange/2) maxVol = Math.max(maxVol, v);
    }
    for(const [p, v] of askBins) {
        if (Math.abs(p - cameraY.current) < visiblePriceRange/2) maxVol = Math.max(maxVol, v);
    }

    // Smooth maxVol? Nah, instantaneous is fine for now, or maybe slow adaptation.

    // Scale X.
    // Left side (Bids): 0 to midX. Max length = midX * 0.9 (padding)
    // Right side (Asks): midX to width. Max length = (width - midX) * 0.9
    const midX = width * centerRatio;
    const maxBarWidth = Math.min(midX, width - midX) - 20;
    const volumeScale = maxBarWidth / maxVol;

    // Clear Canvas
    ctx.clearRect(0, 0, width, height);

    // Background Grid
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    // Horizontal price lines
    const startPrice = cameraY.current - (height/2)/priceScale;
    const endPrice = cameraY.current + (height/2)/priceScale;
    const gridStep = 1.0; // Every 1.0 price
    for (let p = Math.floor(startPrice); p <= Math.ceil(endPrice); p += gridStep) {
        const y = getPriceY(p);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        // Label
        ctx.fillStyle = '#444';
        ctx.font = '10px monospace';
        ctx.fillText(p.toFixed(0), width - 30, y - 2);
    }

    // Draw Spread / Mid Line
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(midX, 0);
    ctx.lineTo(midX, height);
    ctx.stroke();

    // Draw Bids (Green, Left)
    ctx.fillStyle = '#00ff88';
    const barHeight = Math.max(1, priceScale * priceStep) - 1; // leave 1px gap

    bidBins.forEach((vol, price) => {
        const y = getPriceY(price);
        if (y < -barHeight || y > height) return;

        const barLen = vol * volumeScale;
        // Rect: x, y, w, h.
        // Bids go left from midX.
        ctx.fillRect(midX - barLen, y - barHeight/2, barLen, barHeight);
    });

    // Draw Asks (Red, Right)
    ctx.fillStyle = '#ff4444';
    askBins.forEach((vol, price) => {
        const y = getPriceY(price);
        if (y < -barHeight || y > height) return;

        const barLen = vol * volumeScale;
        // Asks go right from midX.
        ctx.fillRect(midX, y - barHeight/2, barLen, barHeight);
    });

    // Draw Trades (Flashes / Particles)
    const now = Date.now();
    lobState.trades.forEach(trade => {
        if (now - trade.timestamp < 300) {
            const y = getPriceY(trade.price);

            // Flash line
            ctx.strokeStyle = trade.price >= lobState.lastPrice ? '#ff4444' : '#00ff88'; // or just white
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(midX - 30, y);
            ctx.lineTo(midX + 30, y);
            ctx.stroke();

            // Spawn Particles (only on first frame of trade ideally, but prob-based works for continuous loop)
            if (Math.random() < 0.3) {
                particlesRef.current.push(new Particle(midX, y, trade.buyerOwner === 'AGENT' || trade.sellerOwner === 'AGENT' ? '#00d1ff' : '#ffffff'));
            }
        }
    });

    // Update & Draw Particles
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
    particlesRef.current.forEach(p => {
        p.update();
        p.draw(ctx);
    });

    // Draw Last Price Label
    const lastPriceY = getPriceY(lobState.lastPrice);
    if (lastPriceY > 0 && lastPriceY < height) {

        // Background for Label
        const labelText = lobState.lastPrice.toFixed(2);
        ctx.font = 'bold 12px monospace';
        const textWidth = ctx.measureText(labelText).width;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(midX - textWidth/2 - 4, lastPriceY - 14, textWidth + 8, 18);

        // Text
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(labelText, midX, lastPriceY - 2);

        // Small indicator circle
        ctx.beginPath();
        ctx.arc(midX, lastPriceY, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
    }
    ctx.textAlign = 'left'; // Reset

  }, [lobState, width, height, centerRatio]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ display: 'block' }} />;
};
