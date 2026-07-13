'use client';

import { Slider } from './Slider';
import { ASPECT_PRESETS } from '@/lib/crop';
import { defaultCrop, type Crop } from '@/lib/recipe';

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
    <div className="crop-bar">
      <div className="crop-bar-group">
        <span className="crop-bar-label">Aspect</span>
        <div className="crop-aspects">
          {ASPECT_PRESETS.map((p) => (
            <button
              key={p.label}
              className={`crop-aspect ${activeAspect === p.label ? 'active' : ''}`}
              onClick={() =>
                onAspect(p.label, p.ratio === 'original' ? imageAspect : p.ratio)
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="crop-bar-group straighten">
        <Slider
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

      <div className="crop-bar-group">
        <button className="tb-btn" title="Rotate 90° left" onClick={() => rotate(-1)}>
          ⟲ 90°
        </button>
        <button className="tb-btn" title="Rotate 90° right" onClick={() => rotate(1)}>
          ⟳ 90°
        </button>
      </div>

      <div className="crop-bar-group right">
        <button className="tb-btn" onClick={onReset} title="Reset crop">
          Reset
        </button>
        <button className="tb-btn primary" onClick={onDone}>
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
