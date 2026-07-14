'use client';

import { useEffect, useState } from 'react';
import { useEditor } from '@/lib/store';
import { cloneRecipe, defaultRecipe } from '@/lib/recipe';
import {
  FILTERS,
  FILTER_CATEGORIES,
  lerpRecipe,
  type Filter,
  type FilterCategory,
} from '@/lib/filters';
import { Renderer, type ImageSource } from '@/lib/gl/renderer';
import { Slider } from './Slider';

const THUMB_LONG_EDGE = 160; // px — small live-preview thumbnails per filter

/** Render every filter over a downscaled copy of the image → data URLs. */
function buildThumbnails(preview: HTMLCanvasElement): Record<string, string> {
  const long = Math.max(preview.width, preview.height);
  const scale = Math.min(1, THUMB_LONG_EDGE / long);
  const bw = Math.max(1, Math.round(preview.width * scale));
  const bh = Math.max(1, Math.round(preview.height * scale));
  const base = document.createElement('canvas');
  base.width = bw;
  base.height = bh;
  base.getContext('2d')!.drawImage(preview, 0, 0, bw, bh);

  const glCanvas = document.createElement('canvas');
  const out: Record<string, string> = {};
  let renderer: Renderer | null = null;
  try {
    renderer = new Renderer(glCanvas);
    renderer.setImage(base as unknown as ImageSource);
    for (const f of FILTERS) {
      renderer.render(f.recipe);
      out[f.id] = glCanvas.toDataURL('image/jpeg', 0.72);
    }
  } catch {
    // WebGL/thumbnail failure is non-fatal — the strip just shows swatch chips.
  } finally {
    renderer?.dispose();
  }
  return out;
}

export function Filters() {
  const image = useEditor((s) => s.image);
  const update = useEditor((s) => s.update);
  const commit = useEditor((s) => s.commit);

  const [category, setCategory] = useState<FilterCategory>('Digicam');
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(100); // 0..100 strength

  // Regenerate thumbnails whenever the source image changes.
  useEffect(() => {
    if (!image) return;
    setThumbs(buildThumbnails(image.preview));
    setActiveId(null);
    setIntensity(100);
  }, [image]);

  if (!image) return null;

  // Apply a filter at a given strength; preserves the user's crop geometry.
  const applyFilter = (f: Filter, pct: number, doCommit: boolean) => {
    const target = lerpRecipe(defaultRecipe(), f.recipe, pct / 100);
    update((r) => {
      const crop = r.crop;
      const overlays = r.overlays; // framing (stamp/leak/dust/border) is independent of the grade
      const lut = r.lut; // a chosen film-sim LUT is independent of the grade too
      const merged = cloneRecipe(target);
      (Object.keys(merged) as (keyof typeof merged)[]).forEach((k) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r as any)[k] = (merged as any)[k];
      });
      r.crop = crop;
      r.overlays = overlays;
      r.lut = lut;
    }, doCommit);
  };

  const select = (f: Filter) => {
    setActiveId(f.id);
    setIntensity(100);
    applyFilter(f, 100, true);
  };

  const activeFilter = FILTERS.find((f) => f.id === activeId) ?? null;
  const shown = FILTERS.filter((f) => f.category === category);

  return (
    <section className="px-3.5 py-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-md bg-accent/15 text-accent ring-1 ring-accent/25">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="9" cy="9" r="5" stroke="currentColor" strokeWidth="1.9" />
            <circle cx="15" cy="15" r="5" stroke="currentColor" strokeWidth="1.9" opacity="0.6" />
          </svg>
        </span>
        <h2 className="m-0 text-[13px] font-semibold tracking-tight text-text">Filters</h2>
      </div>

      {/* Category tabs */}
      <div className="mb-2.5 flex gap-1" role="tablist" aria-label="Filter category">
        {FILTER_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={category === c}
            onClick={() => setCategory(c)}
            className={`flex-1 rounded-full px-2 py-1 text-[11px] font-medium transition-[background,color,border-color] duration-150 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1 ${
              category === c
                ? 'bg-accent-dim text-text border border-accent'
                : 'bg-panel-2 text-text-dim border border-border hover:text-text hover:border-border-strong'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Thumbnail strip */}
      <div className="-mx-3.5 flex gap-2 overflow-x-auto px-3.5 pb-1 [scrollbar-width:thin]">
        {shown.map((f) => {
          const active = f.id === activeId;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => select(f)}
              aria-pressed={active}
              className="group shrink-0 focus-visible:outline-none"
              title={f.name}
            >
              <div
                className={`relative h-[68px] w-[68px] overflow-hidden rounded-lg border-2 transition-[border-color,transform] duration-150 group-active:scale-[0.97] group-focus-visible:outline-2 group-focus-visible:outline-ring group-focus-visible:outline-offset-2 ${
                  active ? 'border-accent' : 'border-transparent group-hover:border-border-strong'
                }`}
                style={thumbs[f.id] ? undefined : { background: f.swatch }}
              >
                {thumbs[f.id] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbs[f.id]}
                    alt={f.name}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                )}
              </div>
              <div
                className={`mt-1 w-[68px] truncate text-center text-[10px] leading-tight transition-colors duration-150 ${
                  active ? 'text-accent' : 'text-text-dim group-hover:text-text'
                }`}
              >
                {f.name}
              </div>
            </button>
          );
        })}
      </div>

      {/* Intensity — only meaningful once a filter is active */}
      {activeFilter && (
        <div className="mt-2">
          <Slider
            label={`Intensity · ${activeFilter.name}`}
            value={intensity}
            min={0}
            max={100}
            step={1}
            defaultValue={100}
            onChange={(v) => {
              setIntensity(v);
              applyFilter(activeFilter, v, false);
            }}
            onCommit={commit}
          />
        </div>
      )}
    </section>
  );
}
