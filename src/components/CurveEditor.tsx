'use client';

import { useMemo, useRef, useState } from 'react';
import { buildLut } from '@/lib/curves';
import type { Point } from '@/lib/recipe';
import { useEditor } from '@/lib/store';

type Channel = 'rgb' | 'red' | 'green' | 'blue';

const CH_COLOR: Record<Channel, string> = {
  rgb: '#d0d0d0',
  red: '#ff6060',
  green: '#50e070',
  blue: '#5a8cff',
};

const SIZE = 256; // logical curve units (0..255)

export function CurveEditor() {
  const recipe = useEditor((s) => s.recipe);
  const update = useEditor((s) => s.update);
  const commit = useEditor((s) => s.commit);
  const [channel, setChannel] = useState<Channel>('rgb');
  const svgRef = useRef<SVGSVGElement>(null);
  const dragIdx = useRef<number | null>(null);

  const points = recipe.curves[channel];

  const lutPath = useMemo(() => {
    const lut = buildLut(points);
    let d = '';
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * SIZE;
      const y = SIZE - lut[i] * SIZE;
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    }
    return d;
  }, [points]);

  const toLocal = (e: React.PointerEvent): Point => {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 255;
    const y = (1 - (e.clientY - rect.top) / rect.height) * 255;
    return [clamp255(x), clamp255(y)];
  };

  const setPoints = (next: Point[], doCommit: boolean) => {
    update((r) => {
      r.curves[channel] = next;
    }, doCommit);
  };

  const handleBgDown = (e: React.PointerEvent) => {
    const [x, y] = toLocal(e);
    const next = [...points, [Math.round(x), Math.round(y)] as Point].sort(
      (a, b) => a[0] - b[0],
    );
    const idx = next.findIndex((p) => p[0] === Math.round(x));
    dragIdx.current = idx;
    setPoints(next, false);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const handlePointDown = (e: React.PointerEvent, idx: number) => {
    e.stopPropagation();
    dragIdx.current = idx;
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (dragIdx.current === null) return;
    const idx = dragIdx.current;
    const [x, y] = toLocal(e);
    const next = points.map((p) => [...p] as Point);
    const isEndpoint = idx === 0 || idx === next.length - 1;
    next[idx][1] = Math.round(y);
    if (!isEndpoint) {
      const lo = next[idx - 1][0] + 1;
      const hi = next[idx + 1][0] - 1;
      next[idx][0] = Math.round(Math.min(hi, Math.max(lo, x)));
    }
    setPoints(next, false);
  };

  const handleUp = (e: React.PointerEvent, idx?: number) => {
    if (dragIdx.current === null) return;
    // Remove interior points dragged off the top/bottom edges (delete gesture).
    if (idx !== undefined && idx > 0 && idx < points.length - 1) {
      const p = points[idx];
      if (p[1] <= 0 || p[1] >= 255) {
        setPoints(
          points.filter((_, i) => i !== idx),
          false,
        );
      }
    }
    dragIdx.current = null;
    commit();
  };

  return (
    <div className="curve-editor">
      <div className="curve-tabs">
        {(['rgb', 'red', 'green', 'blue'] as Channel[]).map((c) => (
          <button
            key={c}
            className={`curve-tab ${channel === c ? 'active' : ''}`}
            style={{ color: channel === c ? CH_COLOR[c] : undefined }}
            onClick={() => setChannel(c)}
          >
            {c === 'rgb' ? 'RGB' : c[0].toUpperCase()}
          </button>
        ))}
      </div>
      <svg
        ref={svgRef}
        className="curve-svg"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        preserveAspectRatio="none"
        onPointerDown={handleBgDown}
        onPointerMove={handleMove}
        onPointerUp={(e) => handleUp(e)}
      >
        {/* grid */}
        {[0.25, 0.5, 0.75].map((g) => (
          <g key={g}>
            <line x1={g * SIZE} y1={0} x2={g * SIZE} y2={SIZE} className="curve-grid" />
            <line x1={0} y1={g * SIZE} x2={SIZE} y2={g * SIZE} className="curve-grid" />
          </g>
        ))}
        <line x1={0} y1={SIZE} x2={SIZE} y2={0} className="curve-diag" />
        <path d={lutPath} fill="none" stroke={CH_COLOR[channel]} strokeWidth={2} />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p[0]}
            cy={SIZE - p[1]}
            r={6}
            className="curve-point"
            stroke={CH_COLOR[channel]}
            onPointerDown={(e) => handlePointDown(e, i)}
            onPointerMove={handleMove}
            onPointerUp={(e) => handleUp(e, i)}
          />
        ))}
      </svg>
      <div className="curve-hint">Click to add · drag off top/bottom to remove</div>
    </div>
  );
}

function clamp255(v: number): number {
  return Math.min(255, Math.max(0, v));
}
