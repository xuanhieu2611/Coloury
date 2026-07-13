'use client';

import { useState } from 'react';
import { Slider } from './Slider';
import { CurveEditor } from './CurveEditor';
import { Presets } from './Presets';
import { useEditor } from '@/lib/store';
import {
  HSL_BANDS,
  PARAM_RANGE,
  type EditRecipe,
  type HslBand,
} from '@/lib/recipe';

type ScalarKey =
  | 'exposure'
  | 'contrast'
  | 'highlights'
  | 'shadows'
  | 'whites'
  | 'blacks'
  | 'temperature'
  | 'tint'
  | 'vibrance'
  | 'saturation'
  | 'clarity'
  | 'texture'
  | 'sharpening'
  | 'sharpenRadius'
  | 'noiseReduction'
  | 'vignette'
  | 'vignetteMidpoint'
  | 'vignetteFeather'
  | 'grain'
  | 'grainSize';

const LABEL: Record<ScalarKey, string> = {
  exposure: 'Exposure',
  contrast: 'Contrast',
  highlights: 'Highlights',
  shadows: 'Shadows',
  whites: 'Whites',
  blacks: 'Blacks',
  temperature: 'Temperature',
  tint: 'Tint',
  vibrance: 'Vibrance',
  saturation: 'Saturation',
  clarity: 'Clarity',
  texture: 'Texture',
  sharpening: 'Amount',
  sharpenRadius: 'Radius',
  noiseReduction: 'Noise Reduction',
  vignette: 'Amount',
  vignetteMidpoint: 'Midpoint',
  vignetteFeather: 'Feather',
  grain: 'Grain',
  grainSize: 'Grain Size',
};

function ScalarSlider({ k }: { k: ScalarKey }) {
  const value = useEditor((s) => s.recipe[k]);
  const update = useEditor((s) => s.update);
  const commit = useEditor((s) => s.commit);
  const range = PARAM_RANGE[k];
  return (
    <Slider
      label={LABEL[k]}
      value={value}
      min={range.min}
      max={range.max}
      step={range.step}
      defaultValue={range.default ?? 0}
      onChange={(v) =>
        update((r) => {
          (r[k] as number) = v;
        }, false)
      }
      onCommit={commit}
    />
  );
}

function Section({
  title,
  children,
  defaultOpen = true,
  onReset,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  onReset?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="panel-section">
      <div className="section-head">
        <button className="section-toggle" onClick={() => setOpen((o) => !o)}>
          <span className={`chevron ${open ? 'open' : ''}`}>▸</span>
          {title}
        </button>
        {onReset && (
          <button
            className="section-reset"
            title={`Reset ${title}`}
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
          >
            ⟲
          </button>
        )}
      </div>
      {open && <div className="section-body">{children}</div>}
    </div>
  );
}

function HslSection() {
  const [band, setBand] = useState<HslBand>('red');
  const channel = useEditor((s) => s.recipe.hsl[band]);
  const update = useEditor((s) => s.update);
  const commit = useEditor((s) => s.commit);

  const set = (field: 'hue' | 'saturation' | 'luminance', v: number, doCommit: boolean) =>
    update((r) => {
      r.hsl[band][field] = v;
    }, doCommit);

  return (
    <>
      <div className="hsl-swatches">
        {HSL_BANDS.map((b) => (
          <button
            key={b}
            className={`hsl-swatch ${band === b ? 'active' : ''}`}
            style={{ background: SWATCH[b] }}
            title={b}
            onClick={() => setBand(b)}
          />
        ))}
      </div>
      <div className="hsl-name">{band}</div>
      {(['hue', 'saturation', 'luminance'] as const).map((f) => (
        <Slider
          key={f}
          label={f[0].toUpperCase() + f.slice(1)}
          value={channel[f]}
          min={-100}
          max={100}
          step={1}
          onChange={(v) => set(f, v, false)}
          onCommit={commit}
        />
      ))}
    </>
  );
}

const SWATCH: Record<HslBand, string> = {
  red: '#e64545',
  orange: '#e0863a',
  yellow: '#dcc73a',
  green: '#4caf50',
  aqua: '#3ac6c6',
  blue: '#3a6de0',
  purple: '#8a5ae0',
  magenta: '#d24ac0',
};

function SplitToneSection() {
  const split = useEditor((s) => s.recipe.splitToning);
  const update = useEditor((s) => s.update);
  const commit = useEditor((s) => s.commit);
  const set = (k: keyof EditRecipe['splitToning'], v: number, c: boolean) =>
    update((r) => {
      r.splitToning[k] = v;
    }, c);

  return (
    <>
      <div className="split-group">Shadows</div>
      <Slider label="Hue" value={split.shadowHue} min={0} max={360} step={1}
        onChange={(v) => set('shadowHue', v, false)} onCommit={commit} defaultValue={0} />
      <Slider label="Saturation" value={split.shadowSaturation} min={0} max={100} step={1}
        onChange={(v) => set('shadowSaturation', v, false)} onCommit={commit} defaultValue={0} />
      <div className="split-group">Highlights</div>
      <Slider label="Hue" value={split.highlightHue} min={0} max={360} step={1}
        onChange={(v) => set('highlightHue', v, false)} onCommit={commit} defaultValue={0} />
      <Slider label="Saturation" value={split.highlightSaturation} min={0} max={100} step={1}
        onChange={(v) => set('highlightSaturation', v, false)} onCommit={commit} defaultValue={0} />
      <Slider label="Balance" value={split.balance} min={-100} max={100} step={1}
        onChange={(v) => set('balance', v, false)} onCommit={commit} />
    </>
  );
}

export function Panels() {
  const update = useEditor((s) => s.update);
  const resetKeys = (keys: ScalarKey[]) =>
    update((r) => keys.forEach((k) => ((r[k] as number) = PARAM_RANGE[k]?.default ?? 0)));

  return (
    <div className="panels">
      <Section title="Presets" defaultOpen={false}>
        <Presets />
      </Section>

      <Section
        title="Basic"
        onReset={() =>
          resetKeys(['exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks', 'temperature', 'tint'])
        }
      >
        <ScalarSlider k="temperature" />
        <ScalarSlider k="tint" />
        <div className="divider" />
        <ScalarSlider k="exposure" />
        <ScalarSlider k="contrast" />
        <ScalarSlider k="highlights" />
        <ScalarSlider k="shadows" />
        <ScalarSlider k="whites" />
        <ScalarSlider k="blacks" />
      </Section>

      <Section
        title="Presence"
        onReset={() => resetKeys(['vibrance', 'saturation', 'clarity', 'texture'])}
      >
        <ScalarSlider k="vibrance" />
        <ScalarSlider k="saturation" />
        <ScalarSlider k="clarity" />
        <ScalarSlider k="texture" />
      </Section>

      <Section title="Tone Curve" defaultOpen={false}>
        <CurveEditor />
      </Section>

      <Section title="Color · HSL" defaultOpen={false}>
        <HslSection />
      </Section>

      <Section title="Split Toning" defaultOpen={false}>
        <SplitToneSection />
      </Section>

      <Section
        title="Detail"
        defaultOpen={false}
        onReset={() => resetKeys(['sharpening', 'sharpenRadius', 'noiseReduction'])}
      >
        <div className="split-group">Sharpening</div>
        <ScalarSlider k="sharpening" />
        <ScalarSlider k="sharpenRadius" />
        <div className="split-group">Noise</div>
        <ScalarSlider k="noiseReduction" />
      </Section>

      <Section
        title="Effects"
        defaultOpen={false}
        onReset={() =>
          resetKeys(['vignette', 'vignetteMidpoint', 'vignetteFeather', 'grain', 'grainSize'])
        }
      >
        <div className="split-group">Vignette</div>
        <ScalarSlider k="vignette" />
        <ScalarSlider k="vignetteMidpoint" />
        <ScalarSlider k="vignetteFeather" />
        <div className="split-group">Grain</div>
        <ScalarSlider k="grain" />
        <ScalarSlider k="grainSize" />
      </Section>
    </div>
  );
}
