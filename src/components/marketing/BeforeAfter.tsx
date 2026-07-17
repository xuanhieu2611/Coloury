'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * The landing page's signature: a draggable before/after grade reveal — the same
 * "wipe" DNA as the editor's reveal animation. `before` is the flat un-edited
 * frame, `after` is the graded result. Labels are mono technical annotations
 * (RAW vs. the film look) so it reads like a colorist's monitor.
 */
export function BeforeAfter({
  before,
  after,
  beforeLabel = 'RAW',
  afterLabel = 'Portra 400',
}: {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
}) {
  const [pos, setPos] = useState(50); // percent revealed of `after` (from left)
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // One-shot intro sweep — echoes the editor's reveal wipe. Skipped when the
  // viewer prefers reduced motion.
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    let raf = 0;
    const start = performance.now();
    const dur = 1100;
    const from = 100;
    const to = 52;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      setPos(from + (to - from) * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const setFromClientX = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const p = ((clientX - r.left) / r.width) * 100;
    setPos(Math.max(0, Math.min(100, p)));
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      setFromClientX(e.clientX);
    };
    const up = () => {
      dragging.current = false;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [setFromClientX]);

  return (
    <div
      ref={ref}
      className="group relative aspect-[16/11] w-full select-none overflow-hidden rounded-lg border border-border-strong shadow-[var(--shadow-pop)]"
      onPointerDown={(e) => {
        dragging.current = true;
        setFromClientX(e.clientX);
      }}
    >
      {/* AFTER — full frame underneath */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={after}
        alt="Graded with a film look"
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* BEFORE — clipped from the left up to the divider */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={before}
          alt="Unedited original"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>

      {/* Corner annotations */}
      <span className="pointer-events-none absolute left-3 top-3 rounded bg-black/45 px-2 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-white/85 backdrop-blur-sm">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute right-3 top-3 rounded bg-accent/85 px-2 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] text-[#06121f] backdrop-blur-sm">
        LUT · {afterLabel}
      </span>

      {/* Divider + handle */}
      <div
        className="absolute inset-y-0 z-10 w-px bg-white/80 shadow-[0_0_10px_rgba(0,0,0,0.5)]"
        style={{ left: `${pos}%` }}
      >
        <button
          type="button"
          aria-label="Drag to compare before and after"
          role="slider"
          aria-valuenow={Math.round(pos)}
          aria-valuemin={0}
          aria-valuemax={100}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - 4));
            if (e.key === 'ArrowRight') setPos((p) => Math.min(100, p + 4));
          }}
          className="absolute top-1/2 left-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-black/45 text-white backdrop-blur-md transition-transform duration-150 ease-[var(--ease-out)] hover:scale-105 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
