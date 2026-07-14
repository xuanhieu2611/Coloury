// The "edit recipe" — a JSON set of named parameters that is the single source
// of truth for all edits (PRD 3.1). Manual sliders and (later) AI Auto Edit both
// write into this shape; the WebGL pipeline reads it. Nothing is baked into pixels
// until export.

export type Point = [number, number]; // [input, output], each 0..255

export interface Curves {
  rgb: Point[];
  red: Point[];
  green: Point[];
  blue: Point[];
}

export type HslBand = 'red' | 'orange' | 'yellow' | 'green' | 'aqua' | 'blue' | 'purple' | 'magenta';

export interface HslChannel {
  hue: number; // -100..100
  saturation: number; // -100..100
  luminance: number; // -100..100
}

export type Hsl = Record<HslBand, HslChannel>;

export interface SplitToning {
  shadowHue: number; // 0..360
  shadowSaturation: number; // 0..100
  highlightHue: number; // 0..360
  highlightSaturation: number; // 0..100
  balance: number; // -100..100
}

// Crop & transform (PRD 4.2). Geometry only — applied by the renderer as a
// sampling transform, never baked into pixels until export. The rect is in the
// *display* (post-straighten) space, normalized 0..1 over the image box.
export interface Crop {
  x: number; // 0..1 left
  y: number; // 0..1 top
  w: number; // 0..1 width
  h: number; // 0..1 height
  angle: number; // straighten, degrees -45..45 (rotation about image center)
  orientation: number; // 90° quarter turns, 0..3 (clockwise)
}

// --- Overlays (Film-engine Phase 2) ----------------------------------------
// Overlays are compositing layers that sit ON TOP of the WebGL output — they
// are NOT shader color math. Rendered as a CSS/canvas layer for live preview
// and composited onto a 2D canvas at export (see src/lib/overlays.ts). Kept as
// a first-class recipe section so it stays the single contract.

export type StampCorner = 'tl' | 'tr' | 'bl' | 'br';

// A vintage-digicam date stamp — the orange corner timestamp. `text` holds the
// literal characters to render (digits/spaces/apostrophe), resolved once when
// the stamp is enabled (from EXIF DateTimeOriginal, else today) so export needs
// no metadata: the recipe fully describes what to draw.
export interface DateStamp {
  enabled: boolean;
  corner: StampCorner;
  text: string;
  color: string; // hex; classic amber default
  size: number; // 0..100 relative to the frame's short edge
}

// Procedural light leak — a soft warm glow bled in from a frame edge/corner,
// screen-blended over the image (the "film wasn't wound tight" look).
export type LeakType = 'warm' | 'red' | 'golden';
export type LeakPosition = 'top' | 'bottom' | 'left' | 'right' | 'corner';
export interface LightLeak {
  enabled: boolean;
  type: LeakType;
  position: LeakPosition;
  strength: number; // 0..100
}

// Procedural dust specks + vertical scratches (analog wear). Deterministic from
// a fixed seed so the live preview and export match exactly.
export interface Dust {
  enabled: boolean;
  amount: number; // 0..100 (density of specks + scratches)
}

// A frame drawn AROUND the graded image — the output canvas expands to make room
// (so nothing is cropped). Sizes are relative to the image's short edge.
export type BorderStyle = 'none' | 'white' | 'black' | 'film' | 'polaroid';
export interface Border {
  style: BorderStyle;
  size: number; // 0..100 thickness
}

export interface Overlays {
  dateStamp: DateStamp;
  lightLeak: LightLeak;
  dust: Dust;
  border: Border;
}

// 3D LUT film-sim stage (applied in-shader after split-tone, before effects).
// `id` selects a built-in look (see src/lib/lut.ts); `amount` dials it 0..1.
export interface LutSettings {
  id: string;
  amount: number; // 0..1
}

export interface EditRecipe {
  exposure: number; // stops, -5..5
  contrast: number; // -100..100
  highlights: number; // -100..100
  shadows: number; // -100..100
  whites: number; // -100..100
  blacks: number; // -100..100
  temperature: number; // -100..100
  tint: number; // -100..100
  vibrance: number; // -100..100
  saturation: number; // -100..100
  clarity: number; // -100..100 (midtone local contrast)
  texture: number; // -100..100 (fine high-frequency detail)
  curves: Curves;
  hsl: Hsl;
  splitToning: SplitToning;
  sharpening: number; // 0..100 (amount)
  sharpenRadius: number; // 0.5..3 px (default 1)
  noiseReduction: number; // 0..100 (luminance denoise)
  vignette: number; // -100..100 (amount)
  vignetteMidpoint: number; // 0..100 (where the falloff starts; default 50)
  vignetteFeather: number; // 0..100 (softness of the falloff; default 50)
  grain: number; // 0..100 (amount)
  grainSize: number; // 0..100 (coarseness; default 25)
  fade: number; // 0..100 (lifted matte blacks — the film/faded "toe")
  halation: number; // 0..100 (dreamy warm glow bleeding from highlights)
  crop: Crop;
  overlays: Overlays;
  lut: LutSettings;
}

export const HSL_BANDS: HslBand[] = [
  'red',
  'orange',
  'yellow',
  'green',
  'aqua',
  'blue',
  'purple',
  'magenta',
];

// Hue center (degrees) for each HSL band, used by the shader to weight bands.
export const HSL_BAND_HUE: Record<HslBand, number> = {
  red: 0,
  orange: 30,
  yellow: 60,
  green: 120,
  aqua: 180,
  blue: 240,
  purple: 270,
  magenta: 300,
};

const identityCurve = (): Point[] => [
  [0, 0],
  [255, 255],
];

const zeroHslChannel = (): HslChannel => ({ hue: 0, saturation: 0, luminance: 0 });

export const defaultCrop = (): Crop => ({ x: 0, y: 0, w: 1, h: 1, angle: 0, orientation: 0 });

// Classic amber vintage-camera timestamp. Disabled by default; the date text is
// filled in by the UI when the user turns it on.
export const CLASSIC_STAMP_COLOR = '#ff7a1a';
export const defaultDateStamp = (): DateStamp => ({
  enabled: false,
  corner: 'br',
  text: '',
  color: CLASSIC_STAMP_COLOR,
  size: 50,
});
export const defaultLightLeak = (): LightLeak => ({
  enabled: false,
  type: 'warm',
  position: 'right',
  strength: 55,
});
export const defaultDust = (): Dust => ({ enabled: false, amount: 40 });
export const defaultBorder = (): Border => ({ style: 'none', size: 50 });
export const defaultOverlays = (): Overlays => ({
  dateStamp: defaultDateStamp(),
  lightLeak: defaultLightLeak(),
  dust: defaultDust(),
  border: defaultBorder(),
});
export const defaultLut = (): LutSettings => ({ id: 'none', amount: 1 });

// A crop that changes nothing: full frame, no straighten, no rotation.
export function isIdentityCrop(c: Crop): boolean {
  return (
    c.x === 0 && c.y === 0 && c.w === 1 && c.h === 1 && c.angle === 0 && c.orientation % 4 === 0
  );
}

export function defaultRecipe(): EditRecipe {
  return {
    exposure: 0,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    whites: 0,
    blacks: 0,
    temperature: 0,
    tint: 0,
    vibrance: 0,
    saturation: 0,
    clarity: 0,
    texture: 0,
    curves: {
      rgb: identityCurve(),
      red: identityCurve(),
      green: identityCurve(),
      blue: identityCurve(),
    },
    hsl: {
      red: zeroHslChannel(),
      orange: zeroHslChannel(),
      yellow: zeroHslChannel(),
      green: zeroHslChannel(),
      aqua: zeroHslChannel(),
      blue: zeroHslChannel(),
      purple: zeroHslChannel(),
      magenta: zeroHslChannel(),
    },
    splitToning: {
      shadowHue: 0,
      shadowSaturation: 0,
      highlightHue: 0,
      highlightSaturation: 0,
      balance: 0,
    },
    sharpening: 0,
    sharpenRadius: 1,
    noiseReduction: 0,
    vignette: 0,
    vignetteMidpoint: 50,
    vignetteFeather: 50,
    grain: 0,
    grainSize: 25,
    fade: 0,
    halation: 0,
    crop: defaultCrop(),
    overlays: defaultOverlays(),
    lut: defaultLut(),
  };
}

// Valid ranges per scalar param — drives slider bounds, double-click reset
// (`default`), and export-time / AI clamping. Omitted `default` means 0.
export const PARAM_RANGE: Record<
  string,
  { min: number; max: number; step: number; default?: number }
> = {
  exposure: { min: -5, max: 5, step: 0.01 },
  contrast: { min: -100, max: 100, step: 1 },
  highlights: { min: -100, max: 100, step: 1 },
  shadows: { min: -100, max: 100, step: 1 },
  whites: { min: -100, max: 100, step: 1 },
  blacks: { min: -100, max: 100, step: 1 },
  temperature: { min: -100, max: 100, step: 1 },
  tint: { min: -100, max: 100, step: 1 },
  vibrance: { min: -100, max: 100, step: 1 },
  saturation: { min: -100, max: 100, step: 1 },
  clarity: { min: -100, max: 100, step: 1 },
  texture: { min: -100, max: 100, step: 1 },
  sharpening: { min: 0, max: 100, step: 1 },
  sharpenRadius: { min: 0.5, max: 3, step: 0.1, default: 1 },
  noiseReduction: { min: 0, max: 100, step: 1 },
  vignette: { min: -100, max: 100, step: 1 },
  vignetteMidpoint: { min: 0, max: 100, step: 1, default: 50 },
  vignetteFeather: { min: 0, max: 100, step: 1, default: 50 },
  grain: { min: 0, max: 100, step: 1 },
  grainSize: { min: 0, max: 100, step: 1, default: 25 },
  fade: { min: 0, max: 100, step: 1 },
  halation: { min: 0, max: 100, step: 1 },
  // Straighten angle lives under recipe.crop; range here drives its slider.
  straighten: { min: -45, max: 45, step: 0.1 },
};

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// Scalar params the AI Auto Edit (M3) is allowed to set. Deliberately excludes
// curves and crop — auto-grading is about tone/color/presence, and a bad curve
// or crop from the model would be far more destructive than a clamped slider.
const AI_SCALAR_KEYS = [
  'exposure',
  'contrast',
  'highlights',
  'shadows',
  'whites',
  'blacks',
  'temperature',
  'tint',
  'vibrance',
  'saturation',
  'clarity',
  'texture',
  'sharpening',
  'vignette',
  'grain',
  'fade',
  'halation',
] as const;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Turn an untrusted partial recipe from the AI vision model into a complete,
 * range-valid `EditRecipe` (PRD 5.4: validate + clamp before applying). Starts
 * from defaults, copies only recognized numeric fields, and clamps each to its
 * `PARAM_RANGE` / band range. Unknown keys, NaN, strings, curves, crop, and
 * overlays are ignored — so a malformed model response degrades to "no-op",
 * never a crash. (The AI grades tone/color; overlays are a manual framing tool.)
 */
export function recipeFromAi(partial: unknown): EditRecipe {
  const r = defaultRecipe();
  if (!partial || typeof partial !== 'object') return r;
  const p = partial as Record<string, unknown>;

  for (const k of AI_SCALAR_KEYS) {
    const v = p[k];
    if (isNum(v)) {
      const range = PARAM_RANGE[k];
      (r[k] as number) = clamp(v, range.min, range.max);
    }
  }

  if (p.hsl && typeof p.hsl === 'object') {
    const hsl = p.hsl as Record<string, unknown>;
    for (const band of HSL_BANDS) {
      const ch = hsl[band];
      if (ch && typeof ch === 'object') {
        const c = ch as Record<string, unknown>;
        (['hue', 'saturation', 'luminance'] as const).forEach((f) => {
          if (isNum(c[f])) r.hsl[band][f] = clamp(c[f] as number, -100, 100);
        });
      }
    }
  }

  if (p.splitToning && typeof p.splitToning === 'object') {
    const st = p.splitToning as Record<string, unknown>;
    const setSt = (k: keyof SplitToning, min: number, max: number) => {
      if (isNum(st[k])) r.splitToning[k] = clamp(st[k] as number, min, max);
    };
    setSt('shadowHue', 0, 360);
    setSt('shadowSaturation', 0, 100);
    setSt('highlightHue', 0, 360);
    setSt('highlightSaturation', 0, 100);
    setSt('balance', -100, 100);
  }

  return r;
}

// Deep clone so history snapshots don't alias live state.
export function cloneRecipe(r: EditRecipe): EditRecipe {
  return JSON.parse(JSON.stringify(r)) as EditRecipe;
}

/**
 * Merge a partial/legacy recipe over the current defaults, so recipes saved
 * before a field existed (localStorage presets) — and, later, partial recipes
 * from the M3 AI — always come out complete. Nested objects merge one level.
 */
export function normalizeRecipe(partial: Partial<EditRecipe> | null | undefined): EditRecipe {
  const base = defaultRecipe();
  if (!partial) return base;
  return {
    ...base,
    ...partial,
    curves: { ...base.curves, ...partial.curves },
    hsl: { ...base.hsl, ...partial.hsl },
    splitToning: { ...base.splitToning, ...partial.splitToning },
    crop: { ...base.crop, ...partial.crop },
    // Overlays are optional/newer than most stored recipes; deep-merge each
    // sub-section so a preset saved before Phase 2 still comes out complete.
    overlays: {
      dateStamp: { ...base.overlays.dateStamp, ...partial.overlays?.dateStamp },
      lightLeak: { ...base.overlays.lightLeak, ...partial.overlays?.lightLeak },
      dust: { ...base.overlays.dust, ...partial.overlays?.dust },
      border: { ...base.overlays.border, ...partial.overlays?.border },
    },
    lut: { ...base.lut, ...partial.lut },
  };
}
