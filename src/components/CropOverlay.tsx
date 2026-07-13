'use client';

import { useRef } from 'react';
import type { Crop } from '@/lib/recipe';

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e' | 'move';

interface Props {
  crop: Crop;
  imageAspect: number; // source W/H
  ratio: number | null; // locked px aspect (w/h), or null = free
  onChange: (mut: (c: Crop) => void, commit: boolean) => void;
}

const MIN = 0.05; // minimum crop size (fraction of image)

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const HANDLE_POS: Record<Exclude<Handle, 'move'>, string> = {
  nw: 'top-[-8px] left-[-8px] cursor-nwse-resize',
  ne: 'top-[-8px] right-[-8px] cursor-nesw-resize',
  sw: 'bottom-[-8px] left-[-8px] cursor-nesw-resize',
  se: 'bottom-[-8px] right-[-8px] cursor-nwse-resize',
  n: 'top-[-8px] left-1/2 -translate-x-1/2 cursor-ns-resize',
  s: 'bottom-[-8px] left-1/2 -translate-x-1/2 cursor-ns-resize',
  w: 'left-[-8px] top-1/2 -translate-y-1/2 cursor-ew-resize',
  e: 'right-[-8px] top-1/2 -translate-y-1/2 cursor-ew-resize',
};

export function CropOverlay({ crop, imageAspect, ratio, onChange }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  // ratio is width/height in pixels; convert to normalized w/h ratio: w/h = ratio/A
  const normRatio = ratio == null ? null : ratio / imageAspect;

  const startDrag = (handle: Handle) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = overlayRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const start = { ...crop };
    const startPx = { x: e.clientX, y: e.clientY };

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startPx.x) / box.width;
      const dy = (ev.clientY - startPx.y) / box.height;
      onChange((c) => applyDrag(c, handle, start, dx, dy, normRatio), false);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      onChange(() => {}, true); // commit history
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const pct = (v: number) => `${v * 100}%`;
  const handles: Exclude<Handle, 'move'>[] =
    ratio == null ? ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'] : ['nw', 'ne', 'sw', 'se'];

  return (
    <div className="absolute inset-0 z-[6] touch-none" ref={overlayRef}>
      {/* Dark mask outside the crop rectangle (four bands). */}
      <div
        className="pointer-events-none absolute bg-black/55"
        style={{ left: 0, top: 0, width: '100%', height: pct(crop.y) }}
      />
      <div
        className="pointer-events-none absolute bg-black/55"
        style={{ left: 0, top: pct(crop.y + crop.h), width: '100%', height: pct(1 - crop.y - crop.h) }}
      />
      <div
        className="pointer-events-none absolute bg-black/55"
        style={{ left: 0, top: pct(crop.y), width: pct(crop.x), height: pct(crop.h) }}
      />
      <div
        className="pointer-events-none absolute bg-black/55"
        style={{
          left: pct(crop.x + crop.w),
          top: pct(crop.y),
          width: pct(1 - crop.x - crop.w),
          height: pct(crop.h),
        }}
      />

      {/* Crop rectangle with rule-of-thirds grid + handles. */}
      <div
        className="absolute box-border cursor-move border border-white/90"
        style={{ left: pct(crop.x), top: pct(crop.y), width: pct(crop.w), height: pct(crop.h) }}
        onPointerDown={startDrag('move')}
      >
        <div className="pointer-events-none absolute top-0 bottom-0 w-px bg-white/35" style={{ left: '33.33%' }} />
        <div className="pointer-events-none absolute top-0 bottom-0 w-px bg-white/35" style={{ left: '66.66%' }} />
        <div className="pointer-events-none absolute right-0 left-0 h-px bg-white/35" style={{ top: '33.33%' }} />
        <div className="pointer-events-none absolute right-0 left-0 h-px bg-white/35" style={{ top: '66.66%' }} />
        {handles.map((h) => (
          <div
            key={h}
            className={`crop-handle absolute z-[2] h-4 w-4 ${HANDLE_POS[h]}`}
            onPointerDown={startDrag(h)}
          />
        ))}
      </div>
    </div>
  );
}

// Pure geometry: given a handle drag (dx,dy in normalized image units), return
// the updated crop rect. normRatio locks w/h (normalized) when set.
function applyDrag(
  c: Crop,
  handle: Handle,
  start: Crop,
  dx: number,
  dy: number,
  normRatio: number | null,
): void {
  let { x, y, w, h } = start;

  if (handle === 'move') {
    x = clamp01(start.x + dx);
    y = clamp01(start.y + dy);
    // keep the rect fully inside the image
    x = Math.min(x, 1 - w);
    y = Math.min(y, 1 - h);
    c.x = x;
    c.y = y;
    return;
  }

  const left = handle.includes('w');
  const right = handle.includes('e');
  const top = handle.includes('n');
  const bottom = handle.includes('s');

  // Edges of the rect.
  let x0 = start.x;
  let y0 = start.y;
  let x1 = start.x + start.w;
  let y1 = start.y + start.h;

  if (left) x0 = clamp01(Math.min(start.x + dx, x1 - MIN));
  if (right) x1 = clamp01(Math.max(start.x + start.w + dx, x0 + MIN));
  if (top) y0 = clamp01(Math.min(start.y + dy, y1 - MIN));
  if (bottom) y1 = clamp01(Math.max(start.y + start.h + dy, y0 + MIN));

  w = x1 - x0;
  h = y1 - y0;

  if (normRatio != null) {
    // Corner drag: enforce w/h = normRatio, anchoring the opposite corner.
    // Prefer matching the dominant movement, then clamp back into the image.
    const anchorX = right ? x0 : x1; // fixed x edge
    const anchorY = bottom ? y0 : y1; // fixed y edge
    // Derive height from width (or vice versa), pick the smaller to stay in-frame.
    const hFromW = w / normRatio;
    const wFromH = h * normRatio;
    if (wFromH <= w) {
      w = wFromH;
    } else {
      h = hFromW;
    }
    // Recompute edges from the anchor.
    x0 = right ? anchorX : anchorX - w;
    x1 = right ? anchorX + w : anchorX;
    y0 = bottom ? anchorY : anchorY - h;
    y1 = bottom ? anchorY + h : anchorY;

    // If we ran past an image edge, shrink to fit and re-derive the other side.
    if (x0 < 0 || x1 > 1 || y0 < 0 || y1 > 1) {
      w = Math.min(w, right ? 1 - anchorX : anchorX);
      h = w / normRatio;
      if (top && anchorY - h < 0) {
        h = anchorY;
        w = h * normRatio;
      }
      if (bottom && anchorY + h > 1) {
        h = 1 - anchorY;
        w = h * normRatio;
      }
      x0 = right ? anchorX : anchorX - w;
      y0 = bottom ? anchorY : anchorY - h;
    }
    c.x = clamp01(x0);
    c.y = clamp01(y0);
    c.w = w;
    c.h = h;
    return;
  }

  c.x = x0;
  c.y = y0;
  c.w = w;
  c.h = h;
}
