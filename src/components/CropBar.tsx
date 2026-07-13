'use client';

import { Slider } from './Slider';
import { ASPECT_PRESETS } from '@/lib/crop';
import { defaultCrop, type Crop } from '@/lib/recipe';
import { btn, btnPrimary, groupLabel } from '@/lib/ui';

interface Props {
  crop: Crop;
  imageAspect: number; // source W/H
  activeAspect: string; // label of the selected aspect preset
  onAspect: (label: string, ratio: number | null) => void;
  onChange: (mut: (c: Crop) => void, commit: boolean) => void;
  onReset: () => void;
  onDone: () => void;
}

export function CropBar({
  crop,
  imageAspect,
  activeAspect,
  onAspect,
  onChange,
  onReset,
  onDone,
}: Props) {
  const rotate = (dir: number) =>
    onChange((c) => {
      c.orientation = (((c.orientation + dir) % 4) + 4) % 4;
    }, true);

  return (
    <div className="absolute bottom-3.5 left-1/2 z-[7] flex max-w-[calc(100%-24px)] -translate-x-1/2 flex-wrap items-center justify-center gap-[18px] rounded-[10px] border border-border bg-[rgba(28,28,28,0.94)] px-3.5 py-2.5">
      <div className="flex items-center gap-2">
        <span className={groupLabel}>Aspect</span>
        <div className="flex flex-wrap gap-1">
          {ASPECT_PRESETS.map((p) => (
            <button
              key={p.label}
              className={`rounded border px-2 py-1 text-[11px] ${
                activeAspect === p.label
                  ? 'border-accent bg-accent-dim text-text'
                  : 'border-border bg-panel-2 text-text-dim hover:text-text'
              }`}
              onClick={() =>
                onAspect(p.label, p.ratio === 'original' ? imageAspect : p.ratio)
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-w-[190px] flex-1 items-center gap-2">
        <Slider
          className="m-0 w-full"
          label="Straighten"
          value={crop.angle}
          min={-45}
          max={45}
          step={0.1}
          defaultValue={0}
          onChange={(v) => onChange((c) => (c.angle = v), false)}
          onCommit={() => onChange(() => {}, true)}
        />
      </div>

      <div className="flex items-center gap-2">
        <button className={btn} title="Rotate 90° left" onClick={() => rotate(-1)}>
          ⟲ 90°
        </button>
        <button className={btn} title="Rotate 90° right" onClick={() => rotate(1)}>
          ⟳ 90°
        </button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button className={btn} onClick={onReset} title="Reset crop">
          Reset
        </button>
        <button className={btnPrimary} onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}

// Reshape a rect to a target px aspect (w/h), centered and maximized in-frame.
// ratio null = free (rect unchanged).
export function fitRectToRatio(imageAspect: number, ratio: number | null): Partial<Crop> {
  if (ratio == null) return {};
  const rn = ratio / imageAspect; // normalized w/h
  let w = 1;
  let h = 1;
  if (rn >= 1) h = 1 / rn;
  else w = rn;
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

export { defaultCrop };
