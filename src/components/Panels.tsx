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
import { groupLabel } from '@/lib/ui';
import { IconChevron, IconReset } from './Icons';
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
  | 'grainSize'
  | 'fade'
  | 'halation';

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
  fade: 'Fade',
  halation: 'Halation',
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
    <div className="border-b border-border">
      <div className="flex items-center justify-between pr-2">
        <button
          type="button"
          className={`flex min-h-[42px] flex-1 items-center gap-2 border-none bg-transparent px-3.5 py-2.5 text-left font-[family-name:var(--font-mono)] text-[10.5px] tracking-[0.14em] uppercase transition-colors duration-150 hover:bg-panel-2/40 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px] ${
            open ? 'text-text' : 'text-text-dim'
          }`}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <IconChevron open={open} />
          {title}
        </button>
        {onReset && (
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border-none bg-transparent text-text-dim transition-colors duration-150 hover:bg-panel-2 hover:text-text focus-visible:outline-2 focus-visible:outline-ring"
            title={`Reset ${title}`}
            aria-label={`Reset ${title}`}
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
          >
            <IconReset />
          </button>
        )}
      </div>
      {open && <div className="px-3.5 pt-0.5 pb-3.5">{children}</div>}
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
      <div className="mb-2.5 flex gap-1" role="tablist" aria-label="HSL color band">
        {HSL_BANDS.map((b) => (
          <button
            key={b}
            type="button"
            role="tab"
            aria-selected={band === b}
            aria-label={b}
            className={`h-6 flex-1 rounded-sm border-2 p-0 transition-[border-color,transform] duration-150 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1 ${
              band === b ? 'border-white scale-[1.04]' : 'border-transparent hover:border-white/40'
            }`}
            style={{ background: SWATCH[b] }}
            title={b}
            onClick={() => setBand(b)}
          />
        ))}
      </div>
      <div className="mb-1 text-[12px] font-semibold capitalize text-text">{band}</div>
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
      <div className={`${groupLabel} mt-3 mb-0.5`}>Shadows</div>
      <Slider label="Hue" value={split.shadowHue} min={0} max={360} step={1}
        onChange={(v) => set('shadowHue', v, false)} onCommit={commit} defaultValue={0} />
      <Slider label="Saturation" value={split.shadowSaturation} min={0} max={100} step={1}
        onChange={(v) => set('shadowSaturation', v, false)} onCommit={commit} defaultValue={0} />
      <div className={`${groupLabel} mt-3 mb-0.5`}>Highlights</div>
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
    <div>
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
        <div className="my-2.5 h-px bg-border" />
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
        <div className={`${groupLabel} mt-3 mb-0.5`}>Sharpening</div>
        <ScalarSlider k="sharpening" />
        <ScalarSlider k="sharpenRadius" />
        <div className={`${groupLabel} mt-3 mb-0.5`}>Noise</div>
        <ScalarSlider k="noiseReduction" />
      </Section>

      <Section
        title="Effects"
        defaultOpen={false}
        onReset={() =>
          resetKeys([
            'vignette', 'vignetteMidpoint', 'vignetteFeather',
            'grain', 'grainSize', 'fade', 'halation',
          ])
        }
      >
        <div className={`${groupLabel} mt-3 mb-0.5`}>Film</div>
        <ScalarSlider k="fade" />
        <ScalarSlider k="halation" />
        <div className={`${groupLabel} mt-3 mb-0.5`}>Vignette</div>
        <ScalarSlider k="vignette" />
        <ScalarSlider k="vignetteMidpoint" />
        <ScalarSlider k="vignetteFeather" />
        <div className={`${groupLabel} mt-3 mb-0.5`}>Grain</div>
        <ScalarSlider k="grain" />
        <ScalarSlider k="grainSize" />
      </Section>
    </div>
  );
}
