// The curated film-look pack — the Tezza/VSCO "WOW". Each filter is a named
// EditRecipe whose GRADE is driven by a real film LUT (src/lib/lut.ts), plus a
// light dressing of texture params (grain / halation / fade / vignette). The
// recipe stays the single contract (CLAUDE.md), so the UI only ever calls
// `lerpRecipe(default, filter.recipe, intensity)` → setRecipe.
//
// A filter carries its `recipe.lut` — the LUT IS the look. The intensity slider
// dials the LUT amount (via `lerpRecipe`), so 0% = original, 100% = full film.

import { cloneRecipe, defaultRecipe, HSL_BANDS, type EditRecipe } from './recipe';

export type FilterCategory = 'Film' | 'Fuji' | 'Cinema' | 'Mono';

export const FILTER_CATEGORIES: FilterCategory[] = ['Film', 'Fuji', 'Cinema', 'Mono'];

export interface Filter {
  id: string;
  name: string;
  category: FilterCategory;
  /** A hint color for the thumbnail chip while the live preview renders. */
  swatch: string;
  /** Premium looks are gated behind the (future) subscription; free set stays great. */
  premium?: boolean;
  recipe: EditRecipe;
}

function make(
  category: FilterCategory,
  name: string,
  swatch: string,
  tweak: (r: EditRecipe) => void,
  premium = false,
): Filter {
  const recipe = defaultRecipe();
  tweak(recipe);
  return { id: `${category}:${name}`, name, category, swatch, premium, recipe };
}

// Small helper: set the film LUT that drives this look.
const lut = (r: EditRecipe, id: string, amount = 1) => {
  r.lut.id = id;
  r.lut.amount = amount;
};

export const FILTERS: Filter[] = [
  // --- Film: classic color negative stocks ---------------------------------
  make('Film', 'Portra 400', '#e6c3a6', (r) => {
    lut(r, 'portra400');
    r.grain = 14;
    r.grainSize = 26;
    r.halation = 14;
    r.vignette = 6;
  }),
  make('Film', 'Kodak Gold', '#e8c68a', (r) => {
    lut(r, 'kodakgold');
    r.grain = 16;
    r.grainSize = 26;
    r.halation = 22;
    r.vignette = 8;
  }),
  make(
    'Film',
    'Golden Hour',
    '#f0b878',
    (r) => {
      lut(r, 'kodakgold');
      r.temperature = 12;
      r.exposure = 0.12;
      r.halation = 42;
      r.grain = 14;
      r.grainSize = 30;
      r.vignette = 8;
    },
    true,
  ),
  make('Film', 'Clean Girl', '#ece6dc', (r) => {
    lut(r, 'portra400', 0.7);
    r.exposure = 0.18;
    r.contrast = -6;
    r.fade = 18;
    r.halation = 10;
  }),

  // --- Fuji: film simulations ----------------------------------------------
  make('Fuji', 'Classic Chrome', '#9aa39c', (r) => {
    lut(r, 'classicchrome');
    r.grain = 10;
    r.grainSize = 24;
    r.vignette = 6;
  }),
  make(
    'Fuji',
    'Superia',
    '#8fb59a',
    (r) => {
      lut(r, 'superia');
      r.grain = 12;
      r.grainSize = 24;
    },
    true,
  ),

  // --- Cinema: graded, filmic looks ----------------------------------------
  make('Cinema', 'Teal · Orange', '#5f8296', (r) => {
    lut(r, 'cineteal');
    r.grain = 8;
    r.vignette = 14;
  }),
  make(
    'Cinema',
    'Moody Cine',
    '#4a5f6b',
    (r) => {
      lut(r, 'cineteal');
      r.exposure = -0.18;
      r.contrast = 8;
      r.fade = 12;
      r.grain = 12;
      r.vignette = 26;
    },
    true,
  ),
  make('Cinema', 'Faded Retro', '#b9b3ac', (r) => {
    lut(r, 'faded');
    r.grain = 16;
    r.grainSize = 26;
    r.fade = 10;
    r.vignette = 10;
  }),

  // --- Mono: black & white -------------------------------------------------
  make('Mono', 'B&W Film', '#b8b8b8', (r) => {
    lut(r, 'bwfilm');
    r.grain = 18;
    r.grainSize = 28;
    r.vignette = 8;
  }),
  make('Mono', 'Noir', '#8a8a8a', (r) => {
    lut(r, 'noir');
    r.grain = 14;
    r.grainSize = 24;
    r.vignette = 22;
  }),
  make(
    'Mono',
    'Dark Room',
    '#6f6f6f',
    (r) => {
      lut(r, 'noir');
      r.exposure = -0.15;
      r.fade = 14;
      r.grain = 20;
      r.grainSize = 30;
      r.vignette = 30;
    },
    true,
  ),
];

/**
 * Blend two recipes for the per-filter intensity slider (Tezza-style strength).
 * Interpolates every scalar param, HSL band, split-tone field, AND the film-LUT
 * amount; curves, crop, and overlays are left as `a`'s (filters never touch them).
 * `t` in 0..1.
 *
 * LUT handling: when `a` and `b` select different LUTs (the usual case — `a` is
 * the neutral default whose `lut.id` is `none`), ramp `b`'s LUT in from amount 0
 * so the slider dials the film-sim strength; at `t = 0` we keep `a`'s LUT (none).
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

  // Film LUT: dial strength with intensity.
  if (a.lut.id === b.lut.id) {
    out.lut.id = a.lut.id;
    out.lut.amount = lerp(a.lut.amount, b.lut.amount);
  } else {
    out.lut.id = t > 0 ? b.lut.id : a.lut.id;
    out.lut.amount = t > 0 ? b.lut.amount * t : a.lut.amount;
  }
  return out;
}
