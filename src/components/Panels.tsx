'use client';

import { useState } from 'react';
import { Slider } from './Slider';
import { CurveEditor } from './CurveEditor';
import { Presets } from './Presets';
import { useEditor } from '@/lib/store';
import {
  HSL_BANDS,
  PARAM_RANGE,
  CLASSIC_STAMP_COLOR,
  type EditRecipe,
  type HslBand,
  type StampCorner,
  type BorderStyle,
  type LeakType,
  type LeakPosition,
} from '@/lib/recipe';
import { defaultStampText } from '@/lib/overlays';
import { LUTS } from '@/lib/lut';
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

const STAMP_CORNERS: { id: StampCorner; label: string }[] = [
  { id: 'tl', label: '↖' },
  { id: 'tr', label: '↗' },
  { id: 'bl', label: '↙' },
  { id: 'br', label: '↘' },
];

// Vintage-digicam date stamp (Film-engine Phase 2). An overlay, not a shader
// param — lives under recipe.overlays.dateStamp and composites over the frame.
function DateStampSection() {
  const ds = useEditor((s) => s.recipe.overlays.dateStamp);
  const exifDate = useEditor((s) => s.image?.exif?.dateTime ?? null);
  const update = useEditor((s) => s.update);
  const commit = useEditor((s) => s.commit);

  const toggle = () =>
    update((r) => {
      const d = r.overlays.dateStamp;
      d.enabled = !d.enabled;
      // Fill the text on first enable so there's something to show.
      if (d.enabled && !d.text.trim()) d.text = defaultStampText(exifDate);
    });

  return (
    <>
      <SwitchRow label="Enable" on={ds.enabled} onToggle={toggle} />

      {ds.enabled && (
        <div className="mt-2 space-y-3">
          <div>
            <div className={`${groupLabel} mb-1`}>Text</div>
            <input
              type="text"
              value={ds.text}
              placeholder="'26 07 13"
              onChange={(e) =>
                update((r) => {
                  r.overlays.dateStamp.text = e.target.value;
                })
              }
              className="w-full rounded-md border border-border bg-panel-2 px-2.5 py-1.5 font-[family-name:var(--font-mono)] text-[12px] text-text focus-visible:outline-2 focus-visible:outline-ring"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className={groupLabel}>Corner</div>
            <div className="grid grid-cols-2 grid-rows-2 gap-1">
              {STAMP_CORNERS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-label={`Corner ${c.id}`}
                  aria-pressed={ds.corner === c.id}
                  onClick={() => update((r) => (r.overlays.dateStamp.corner = c.id))}
                  className={`flex h-6 w-6 items-center justify-center rounded-md border text-[12px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ring ${
                    ds.corner === c.id
                      ? 'border-accent bg-accent-dim text-text'
                      : 'border-border bg-panel-2 text-text-dim hover:text-text'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between gap-3">
            <span className={groupLabel}>Color</span>
            <span className="flex items-center gap-2">
              <button
                type="button"
                className="text-[11px] text-text-dim underline-offset-2 hover:text-text hover:underline"
                onClick={() => update((r) => (r.overlays.dateStamp.color = CLASSIC_STAMP_COLOR))}
              >
                amber
              </button>
              <input
                type="color"
                value={ds.color}
                onChange={(e) => update((r) => (r.overlays.dateStamp.color = e.target.value))}
                aria-label="Date stamp color"
                className="h-7 w-9 cursor-pointer rounded-md border border-border bg-panel-2 p-0.5"
              />
            </span>
          </label>

          <Slider
            label="Size"
            value={ds.size}
            min={0}
            max={100}
            step={1}
            defaultValue={50}
            onChange={(v) =>
              update((r) => {
                r.overlays.dateStamp.size = v;
              }, false)
            }
            onCommit={commit}
          />
        </div>
      )}
    </>
  );
}

// Shared on/off switch row used by the overlay sub-sections.
function SwitchRow({
  label,
  on,
  onToggle,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1 text-[12px] text-text">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        className={`relative h-[18px] w-[32px] rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 ${
          on ? 'bg-accent' : 'bg-track'
        }`}
      >
        <span
          className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-[left] duration-150 ${
            on ? 'left-[16px]' : 'left-[2px]'
          }`}
        />
      </button>
    </label>
  );
}

const selectCls =
  'rounded-md border border-border bg-panel-2 px-2 py-1 text-[12px] text-text focus-visible:outline-2 focus-visible:outline-ring';

const BORDER_STYLES: { id: BorderStyle; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'white', label: 'White' },
  { id: 'black', label: 'Black' },
  { id: 'film', label: 'Film' },
  { id: 'polaroid', label: 'Polaroid' },
];

// Frame/border overlay — expands the output canvas around the image.
function BorderSection() {
  const border = useEditor((s) => s.recipe.overlays.border);
  const update = useEditor((s) => s.update);
  const commit = useEditor((s) => s.commit);
  return (
    <>
      <label className="flex items-center justify-between gap-3 py-1 text-[12px] text-text">
        <span>Border</span>
        <select
          className={selectCls}
          value={border.style}
          onChange={(e) => update((r) => (r.overlays.border.style = e.target.value as BorderStyle))}
        >
          {BORDER_STYLES.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      </label>
      {border.style !== 'none' && (
        <Slider
          label="Thickness"
          value={border.size}
          min={0}
          max={100}
          step={1}
          defaultValue={50}
          onChange={(v) => update((r) => (r.overlays.border.size = v), false)}
          onCommit={commit}
        />
      )}
    </>
  );
}

const LEAK_TYPES: LeakType[] = ['warm', 'red', 'golden'];
const LEAK_POSITIONS: LeakPosition[] = ['top', 'bottom', 'left', 'right', 'corner'];

// Light-leak overlay — procedural warm glow from an edge/corner.
function LightLeakSection() {
  const leak = useEditor((s) => s.recipe.overlays.lightLeak);
  const update = useEditor((s) => s.update);
  const commit = useEditor((s) => s.commit);
  return (
    <>
      <SwitchRow
        label="Light leak"
        on={leak.enabled}
        onToggle={() => update((r) => (r.overlays.lightLeak.enabled = !r.overlays.lightLeak.enabled))}
      />
      {leak.enabled && (
        <div className="mt-2 space-y-2">
          <label className="flex items-center justify-between gap-3 text-[12px] text-text-dim">
            <span>Color</span>
            <select
              className={selectCls}
              value={leak.type}
              onChange={(e) => update((r) => (r.overlays.lightLeak.type = e.target.value as LeakType))}
            >
              {LEAK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t[0].toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between gap-3 text-[12px] text-text-dim">
            <span>Position</span>
            <select
              className={selectCls}
              value={leak.position}
              onChange={(e) =>
                update((r) => (r.overlays.lightLeak.position = e.target.value as LeakPosition))
              }
            >
              {LEAK_POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p[0].toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <Slider
            label="Strength"
            value={leak.strength}
            min={0}
            max={100}
            step={1}
            defaultValue={55}
            onChange={(v) => update((r) => (r.overlays.lightLeak.strength = v), false)}
            onCommit={commit}
          />
        </div>
      )}
    </>
  );
}

// Dust & scratches overlay — procedural analog wear.
function DustSection() {
  const dust = useEditor((s) => s.recipe.overlays.dust);
  const update = useEditor((s) => s.update);
  const commit = useEditor((s) => s.commit);
  return (
    <>
      <SwitchRow
        label="Dust & scratches"
        on={dust.enabled}
        onToggle={() => update((r) => (r.overlays.dust.enabled = !r.overlays.dust.enabled))}
      />
      {dust.enabled && (
        <Slider
          label="Amount"
          value={dust.amount}
          min={0}
          max={100}
          step={1}
          defaultValue={40}
          onChange={(v) => update((r) => (r.overlays.dust.amount = v), false)}
          onCommit={commit}
        />
      )}
    </>
  );
}

// 3D LUT film-sim stage (shader-side color map).
function LutSection() {
  const lut = useEditor((s) => s.recipe.lut);
  const update = useEditor((s) => s.update);
  const commit = useEditor((s) => s.commit);
  return (
    <>
      <label className="flex items-center justify-between gap-3 py-1 text-[12px] text-text">
        <span>Film sim</span>
        <select
          className={selectCls}
          value={lut.id}
          onChange={(e) => update((r) => (r.lut.id = e.target.value))}
        >
          {LUTS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      {lut.id !== 'none' && (
        <Slider
          label="Amount"
          value={Math.round(lut.amount * 100)}
          min={0}
          max={100}
          step={1}
          defaultValue={100}
          onChange={(v) => update((r) => (r.lut.amount = v / 100), false)}
          onCommit={commit}
        />
      )}
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

      <Section title="Film Sim · LUT" defaultOpen={false} onReset={() => update((r) => (r.lut.id = 'none'))}>
        <LutSection />
      </Section>

      <Section
        title="Overlays"
        defaultOpen={false}
        onReset={() =>
          update((r) => {
            r.overlays.dateStamp.enabled = false;
            r.overlays.lightLeak.enabled = false;
            r.overlays.dust.enabled = false;
            r.overlays.border.style = 'none';
          })
        }
      >
        <div className={`${groupLabel} mb-0.5`}>Frame</div>
        <BorderSection />
        <div className="my-3 h-px bg-border" />
        <div className={`${groupLabel} mb-0.5`}>Light Leak</div>
        <LightLeakSection />
        <div className="my-3 h-px bg-border" />
        <div className={`${groupLabel} mb-0.5`}>Texture</div>
        <DustSection />
        <div className="my-3 h-px bg-border" />
        <div className={`${groupLabel} mb-0.5`}>Date Stamp</div>
        <DateStampSection />
      </Section>
    </div>
  );
}
