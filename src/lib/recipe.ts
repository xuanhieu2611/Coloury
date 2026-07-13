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
  crop: Crop;
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
    crop: defaultCrop(),
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
  // Straighten angle lives under recipe.crop; range here drives its slider.
  straighten: { min: -45, max: 45, step: 0.1 },
};

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
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
  };
}
