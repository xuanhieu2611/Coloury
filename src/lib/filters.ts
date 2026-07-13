// Aesthetic filter pack — the Pinterest/Instagram "hot girl" looks: vintage
// digicam, warm film, Fuji film sims, and moody/clean vibes. A filter is just a
// named EditRecipe (the recipe stays the single contract, CLAUDE.md), so the UI
// only ever calls `lerpRecipe(default, filter.recipe, intensity)` → setRecipe.
// Everything is expressed through existing params plus the film-signature
// `fade` (lifted matte blacks) and `halation` (warm highlight glow).

import { cloneRecipe, defaultRecipe, HSL_BANDS, type EditRecipe } from './recipe';

export type FilterCategory = 'Digicam' | 'Film' | 'Fuji' | 'Mood';

export const FILTER_CATEGORIES: FilterCategory[] = ['Digicam', 'Film', 'Fuji', 'Mood'];

export interface Filter {
  id: string;
  name: string;
  category: FilterCategory;
  /** A hint color for the thumbnail chip while the live preview renders. */
  swatch: string;
  recipe: EditRecipe;
}

function make(
  category: FilterCategory,
  name: string,
  swatch: string,
  tweak: (r: EditRecipe) => void,
): Filter {
  const recipe = defaultRecipe();
  tweak(recipe);
  return { id: `${category}:${name}`, name, category, swatch, recipe };
}

export const FILTERS: Filter[] = [
  // --- Digicam: 2000s point-and-shoot / Y2K flash — cool, crisp, grainy -----
  make('Digicam', 'Y2K Flash', '#c7d6e0', (r) => {
    r.temperature = -14;
    r.tint = 6;
    r.contrast = 26;
    r.highlights = -6;
    r.whites = 16;
    r.blacks = -10;
    r.clarity = 14;
    r.texture = 10;
    r.vibrance = 12;
    r.saturation = -4;
    r.grain = 30;
    r.grainSize = 18;
    r.vignette = 10;
  }),
  make('Digicam', '2003 Cam', '#b9c4cc', (r) => {
    r.temperature = -8;
    r.tint = 10;
    r.contrast = 30;
    r.highlights = -14;
    r.shadows = -6;
    r.whites = 10;
    r.blacks = -16;
    r.clarity = 18;
    r.saturation = 8;
    r.grain = 38;
    r.grainSize = 22;
    r.vignette = 18;
  }),
  make('Digicam', 'CCD Cool', '#a9c2d6', (r) => {
    r.temperature = -22;
    r.tint = -4;
    r.contrast = 20;
    r.highlights = -10;
    r.shadows = 8;
    r.clarity = 10;
    r.vibrance = 6;
    r.saturation = -8;
    r.hsl.blue.saturation = 18;
    r.hsl.aqua.saturation = 14;
    r.grain = 24;
    r.grainSize = 16;
  }),

  // --- Film: warm Kodak Gold / Portra — golden, creamy, lifted -------------
  make('Film', 'Kodak Gold', '#e8c68a', (r) => {
    r.temperature = 26;
    r.tint = 8;
    r.contrast = 8;
    r.highlights = -20;
    r.shadows = 16;
    r.blacks = 6;
    r.vibrance = 12;
    r.saturation = -4;
    r.fade = 24;
    r.halation = 30;
    r.splitToning.highlightHue = 48;
    r.splitToning.highlightSaturation = 22;
    r.splitToning.shadowHue = 32;
    r.splitToning.shadowSaturation = 14;
    r.splitToning.balance = 12;
    r.hsl.yellow.saturation = 10;
    r.hsl.orange.luminance = 6;
    r.grain = 22;
    r.grainSize = 26;
    r.vignette = 10;
  }),
  make('Film', 'Portra 400', '#e6c3a6', (r) => {
    r.temperature = 16;
    r.tint = 4;
    r.contrast = 4;
    r.highlights = -14;
    r.shadows = 14;
    r.blacks = 8;
    r.vibrance = 6;
    r.saturation = -12;
    r.clarity = -6;
    r.fade = 30;
    r.halation = 18;
    r.splitToning.highlightHue = 40;
    r.splitToning.highlightSaturation = 14;
    r.splitToning.shadowHue = 210;
    r.splitToning.shadowSaturation = 8;
    r.hsl.orange.saturation = -6;
    r.hsl.red.luminance = 4;
    r.grain = 18;
    r.grainSize = 28;
  }),
  make('Film', 'Golden Hour', '#f0b878', (r) => {
    r.temperature = 34;
    r.tint = 10;
    r.exposure = 0.15;
    r.contrast = 10;
    r.highlights = -24;
    r.shadows = 20;
    r.blacks = 10;
    r.vibrance = 16;
    r.fade = 20;
    r.halation = 46;
    r.splitToning.highlightHue = 44;
    r.splitToning.highlightSaturation = 30;
    r.splitToning.shadowHue = 28;
    r.splitToning.shadowSaturation = 18;
    r.splitToning.balance = 18;
    r.grain = 16;
    r.grainSize = 30;
    r.vignette = 8;
  }),

  // --- Fuji: film simulations ---------------------------------------------
  make('Fuji', 'Classic Chrome', '#9aa39c', (r) => {
    r.temperature = -4;
    r.tint = -2;
    r.contrast = 16;
    r.highlights = -12;
    r.shadows = -8;
    r.blacks = -6;
    r.vibrance = -6;
    r.saturation = -22;
    r.clarity = 8;
    r.splitToning.shadowHue = 40;
    r.splitToning.shadowSaturation = 10;
    r.hsl.red.saturation = -8;
    r.hsl.yellow.saturation = -14;
    r.hsl.green.saturation = -12;
    r.grain = 12;
    r.grainSize = 24;
  }),
  make('Fuji', 'Velvia', '#5f8f6b', (r) => {
    r.temperature = 4;
    r.contrast = 26;
    r.highlights = -10;
    r.shadows = 6;
    r.whites = 8;
    r.blacks = -12;
    r.vibrance = 22;
    r.saturation = 16;
    r.clarity = 12;
    r.hsl.green.saturation = 20;
    r.hsl.green.luminance = -8;
    r.hsl.blue.saturation = 22;
    r.hsl.blue.luminance = -6;
    r.hsl.red.saturation = 10;
  }),
  make('Fuji', 'Pro Neg', '#d9c3b6', (r) => {
    r.temperature = 10;
    r.tint = 4;
    r.contrast = -6;
    r.highlights = -10;
    r.shadows = 10;
    r.blacks = 4;
    r.vibrance = 4;
    r.saturation = -8;
    r.clarity = -8;
    r.fade = 14;
    r.hsl.orange.saturation = -4;
    r.hsl.orange.luminance = 6;
    r.grain = 10;
    r.grainSize = 26;
  }),

  // --- Mood: dark academia / clean girl / moody blue ----------------------
  make('Mood', 'Dark Academia', '#7a6f5c', (r) => {
    r.temperature = 6;
    r.tint = 2;
    r.contrast = 14;
    r.highlights = -28;
    r.shadows = -10;
    r.blacks = -8;
    r.vibrance = -10;
    r.saturation = -24;
    r.fade = 16;
    r.splitToning.shadowHue = 36;
    r.splitToning.shadowSaturation = 16;
    r.splitToning.highlightHue = 40;
    r.splitToning.highlightSaturation = 10;
    r.hsl.yellow.saturation = -16;
    r.grain = 20;
    r.grainSize = 26;
    r.vignette = 28;
  }),
  make('Mood', 'Clean Girl', '#e9e4dc', (r) => {
    r.temperature = 8;
    r.tint = 2;
    r.exposure = 0.2;
    r.contrast = -8;
    r.highlights = -12;
    r.shadows = 18;
    r.whites = 8;
    r.blacks = 10;
    r.vibrance = 6;
    r.saturation = -14;
    r.clarity = -10;
    r.fade = 26;
    r.hsl.green.saturation = -10;
    r.hsl.aqua.saturation = -8;
  }),
  make('Mood', 'Moody Blue', '#5a7488', (r) => {
    r.temperature = -20;
    r.tint = -6;
    r.contrast = 20;
    r.highlights = -22;
    r.shadows = 18;
    r.blacks = -12;
    r.vibrance = -8;
    r.saturation = -18;
    r.fade = 18;
    r.splitToning.shadowHue = 218;
    r.splitToning.shadowSaturation = 26;
    r.splitToning.highlightHue = 208;
    r.splitToning.highlightSaturation = 10;
    r.splitToning.balance = -14;
    r.hsl.blue.saturation = 12;
    r.grain = 14;
    r.grainSize = 24;
    r.vignette = 22;
  }),
];

/**
 * Blend two recipes for the per-filter intensity slider (Tezza-style strength).
 * Interpolates every scalar param, HSL band, and split-tone field; curves and
 * crop are left as `a`'s (filters never touch them). `t` in 0..1.
 */
export function lerpRecipe(a: EditRecipe, b: EditRecipe, t: number): EditRecipe {
  const out = cloneRecipe(a);
  const lerp = (x: number, y: number) => x + (y - x) * t;

  for (const k of Object.keys(a) as (keyof EditRecipe)[]) {
    if (typeof a[k] === 'number' && typeof b[k] === 'number') {
      (out[k] as number) = lerp(a[k] as number, b[k] as number);
    }
  }
  for (const band of HSL_BANDS) {
    (['hue', 'saturation', 'luminance'] as const).forEach((f) => {
      out.hsl[band][f] = lerp(a.hsl[band][f], b.hsl[band][f]);
    });
  }
  (['shadowHue', 'shadowSaturation', 'highlightHue', 'highlightSaturation', 'balance'] as const).forEach(
    (f) => {
      out.splitToning[f] = lerp(a.splitToning[f], b.splitToning[f]);
    },
  );
  return out;
}
