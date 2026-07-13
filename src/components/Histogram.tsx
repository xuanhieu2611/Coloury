'use client';

import { useEffect, useRef } from 'react';
import { useHistogram } from '@/lib/histogram';

export function Histogram() {
  const data = useHistogram((s) => s.data);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    if (!data) return;

    const bins = data.lum.length;
    const max = Math.max(1, ...data.r, ...data.g, ...data.b);
    const channels: [number[], string][] = [
      [data.r, 'rgba(255,80,80,0.65)'],
      [data.g, 'rgba(80,255,120,0.55)'],
      [data.b, 'rgba(90,140,255,0.6)'],
    ];
    ctx.globalCompositeOperation = 'lighter';
    for (const [ch, color] of channels) {
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let i = 0; i < bins; i++) {
        const x = (i / (bins - 1)) * W;
        const y = H - Math.sqrt(ch[i] / max) * H;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }, [data]);

  return (
    <div className="border-b border-border px-3.5 py-2.5">
      <canvas
        ref={canvasRef}
        width={280}
        height={90}
        className="block h-[90px] w-full rounded-md bg-canvas ring-1 ring-border/60"
        role="img"
        aria-label="Live RGB histogram"
      />
    </div>
  );
}
