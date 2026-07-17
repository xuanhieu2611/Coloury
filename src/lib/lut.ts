/**
 * 3D LUT film-sim stage (Film-engine Phase 2, step 5 + the "authentic look" work).
 *
 * A LUT is an arbitrary RGB→RGB mapping — the way to get film looks whose hue
 * crosstalk a parametric slider can't reach (Classic-Chrome-style teal shadows,
 * Portra skin roll-off, etc.). Two sources feed the same baked texture:
 *
 *   1. **Procedural film specs** (`bakeFilm`) — declarative lift/gamma/gain +
 *      split-tone + skin-hue protection, tuned by eye on real photos. This is the
 *      curated pack today (no proprietary `.cube` files — licensing, CLAUDE.md).
 *   2. **Real `.cube` files** (`parseCube` + `cubeToLutDef`) — drop-in authentic
 *      LUTs, trilinearly resampled to our grid. Same texture, shader untouched.
 *
 * Texture layout: an N³ cube stored as N slices laid left-to-right. The texture
 * is (N·N) wide × N tall; slice `b` occupies columns [b·N, (b+1)·N), with r→x
 * within the slice and g→y. The shader (`sampleLut` in shaders.ts) reads it back
 * with the matching coordinate math. Every LutDef exposes a `transform` closure;
 * `.cube` LUTs implement it as a trilinear lookup over their parsed grid, so
 * `buildLutTexture` never has to know where the data came from.
 */

export const LUT_SIZE = 17; // N — 17³ = 4913 entries; good fidelity, tiny texture

export interface LutDef {
  id: string;
  name: string;
  transform: (r: number, g: number, b: number) => [number, number, number];
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
// Smooth S-curve contrast around 0.5.
const scurve = (v: number, amt: number) => {
  const x = v - 0.5;
  return clamp01(0.5 + x * (1 + amt) - amt * 2 * x * x * x * 4);
};

// --- HSL helpers (for hue-selective color science in the film specs) --------
function rgb2hsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d > 1e-6) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s, l];
}
function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360 / 360;
  if (s <= 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
}

// Angular distance between two hues in degrees (0..180).
const hueDist = (a: number, b: number) => {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
};

/**
 * A declarative film look. Everything is a gentle, tunable operation over the
 * unit cube — baked once into a texture, so cost is irrelevant. Order mirrors a
 * real grade: white balance → contrast → lift/gamma/gain → saturation (with skin
 * protection) → split-tone → matte fade.
 */
interface FilmSpec {
  /** Per-channel gain (white balance / color cast). 1 = neutral. */
  wb?: [number, number, number];
  /** S-curve contrast amount around mid-grey. */
  contrast?: number;
  /** Shadow lift (adds), midtone gamma (0.5..2, <1 brightens), highlight gain. Per-channel. */
  lift?: [number, number, number];
  gamma?: [number, number, number];
  gain?: [number, number, number];
  /** Global saturation multiplier (1 = neutral, <1 muted, >1 punchy). */
  sat?: number;
  /** Extra saturation for a hue window {center°, mult} — e.g. boost greens. */
  hueSat?: { center: number; width: number; mult: number };
  /** Protect skin hues (~25°) from desaturation: 0..1 how much to spare them. */
  skinProtect?: number;
  /** Split-tone tints as [hue°, strength 0..1], weighted by shadow/highlight mask. */
  shadowTint?: [number, number];
  highlightTint?: [number, number];
  /** Matte fade: raise the black floor / lower the white ceiling (0..1). */
  fadeBlack?: number;
  fadeWhite?: number;
}

function bakeFilm(spec: FilmSpec): (r: number, g: number, b: number) => [number, number, number] {
  const wb = spec.wb ?? [1, 1, 1];
  const lift = spec.lift ?? [0, 0, 0];
  const gamma = spec.gamma ?? [1, 1, 1];
  const gain = spec.gain ?? [1, 1, 1];
  const sat = spec.sat ?? 1;
  return (r0, g0, b0) => {
    let r = clamp01(r0 * wb[0]);
    let g = clamp01(g0 * wb[1]);
    let b = clamp01(b0 * wb[2]);

    if (spec.contrast) {
      r = scurve(r, spec.contrast);
      g = scurve(g, spec.contrast);
      b = scurve(b, spec.contrast);
    }

    // Lift / gamma / gain (shadows / mids / highlights).
    const lgg = (c: number, i: number) =>
      clamp01(Math.pow(clamp01(c * gain[i] + lift[i] * (1 - c)), 1 / gamma[i]));
    r = lgg(r, 0);
    g = lgg(g, 1);
    b = lgg(b, 2);

    // Saturation, with per-hue boost + skin protection.
    const [h, , l0] = rgb2hsl(r, g, b);
    const y = luma(r, g, b);
    let satMul = sat;
    if (spec.hueSat) {
      const w = Math.max(0, 1 - hueDist(h, spec.hueSat.center) / spec.hueSat.width);
      satMul *= 1 + (spec.hueSat.mult - 1) * w;
    }
    if (spec.skinProtect && satMul < 1) {
      // Near skin (orange ~25°), pull satMul back toward 1 so faces stay alive.
      const skin = Math.max(0, 1 - hueDist(h, 25) / 40);
      satMul = mix(satMul, 1, spec.skinProtect * skin);
    }
    r = clamp01(mix(y, r, satMul));
    g = clamp01(mix(y, g, satMul));
    b = clamp01(mix(y, b, satMul));

    // Split-tone: tint shadows / highlights by luminance mask.
    const applyTint = (tint: [number, number] | undefined, mask: number) => {
      if (!tint || tint[1] <= 0) return;
      const [tr, tg, tb] = hsl2rgb(tint[0], 0.6, 0.5);
      const k = tint[1] * mask;
      r = clamp01(mix(r, mix(r, tr, 0.5), k));
      g = clamp01(mix(g, mix(g, tg, 0.5), k));
      b = clamp01(mix(b, mix(b, tb, 0.5), k));
    };
    applyTint(spec.shadowTint, 1 - l0);
    applyTint(spec.highlightTint, l0);

    // Matte fade — compress into [fadeBlack, 1 - fadeWhite].
    const fb = spec.fadeBlack ?? 0;
    const fw = spec.fadeWhite ?? 0;
    if (fb || fw) {
      const lo = fb;
      const hi = 1 - fw;
      r = mix(lo, hi, r);
      g = mix(lo, hi, g);
      b = mix(lo, hi, b);
    }

    return [clamp01(r), clamp01(g), clamp01(b)];
  };
}

// --- Curated LUT library (the authentic pack) -------------------------------
// `none` is identity (the stage is skipped when selected). The rest are tuned
// film emulations; filters.ts references these ids as the heart of each look.
export const LUTS: LutDef[] = [
  { id: 'none', name: 'None', transform: (r, g, b) => [r, g, b] },
  {
    // Kodak Portra 400 — the portrait film. Warm, creamy, low contrast, skin-safe.
    id: 'portra400',
    name: 'Portra 400',
    transform: bakeFilm({
      wb: [1.05, 1.0, 0.95],
      contrast: 0.08,
      lift: [0.04, 0.03, 0.03],
      gamma: [1.05, 1.03, 1.0],
      gain: [1.02, 1.0, 0.98],
      sat: 0.9,
      skinProtect: 0.8,
      highlightTint: [42, 0.1],
      shadowTint: [30, 0.08],
      fadeBlack: 0.03,
    }),
  },
  {
    // Kodak Gold 200 — nostalgic golden-hour warmth, richer saturation.
    id: 'kodakgold',
    name: 'Kodak Gold',
    transform: bakeFilm({
      wb: [1.1, 1.01, 0.9],
      contrast: 0.12,
      lift: [0.05, 0.035, 0.02],
      gamma: [1.02, 1.0, 0.98],
      sat: 1.05,
      hueSat: { center: 50, width: 60, mult: 1.15 },
      skinProtect: 0.6,
      highlightTint: [45, 0.16],
      shadowTint: [35, 0.1],
      fadeBlack: 0.04,
    }),
  },
  {
    // Fuji Classic Chrome — muted, documentary, teal-leaning shadows, low sat.
    id: 'classicchrome',
    name: 'Classic Chrome',
    transform: bakeFilm({
      wb: [0.99, 1.0, 1.0],
      contrast: 0.16,
      lift: [0.02, 0.025, 0.03],
      gamma: [1.0, 1.0, 1.02],
      sat: 0.72,
      skinProtect: 0.5,
      shadowTint: [200, 0.14],
      highlightTint: [45, 0.06],
    }),
  },
  {
    // Fuji Superia — consumer film: punchy greens, cool-ish, a bit crunchy.
    id: 'superia',
    name: 'Fuji Superia',
    transform: bakeFilm({
      wb: [1.0, 1.03, 1.0],
      contrast: 0.14,
      gamma: [1.0, 0.99, 1.0],
      sat: 1.05,
      hueSat: { center: 120, width: 70, mult: 1.25 },
      skinProtect: 0.5,
      shadowTint: [150, 0.08],
    }),
  },
  {
    // Cinematic teal & orange — the trailer look. Skin stays warm, shadows cool.
    id: 'cineteal',
    name: 'Teal · Orange',
    transform: bakeFilm({
      contrast: 0.2,
      lift: [0.02, 0.02, 0.04],
      sat: 0.95,
      skinProtect: 0.7,
      shadowTint: [195, 0.22],
      highlightTint: [30, 0.14],
    }),
  },
  {
    // Faded retro — matte lifted blacks, pulled highlights, cool desaturated.
    id: 'faded',
    name: 'Faded Retro',
    transform: bakeFilm({
      wb: [1.0, 1.0, 1.04],
      contrast: -0.05,
      sat: 0.7,
      shadowTint: [210, 0.1],
      fadeBlack: 0.12,
      fadeWhite: 0.06,
    }),
  },
  {
    // Warm B&W film — panchromatic luminance with a gentle contrast toe/shoulder.
    id: 'bwfilm',
    name: 'B&W Film',
    transform: (r, g, b) => {
      const y = scurve(0.24 * r + 0.68 * g + 0.08 * b, 0.24);
      return [clamp01(y + 0.01), y, clamp01(y - 0.01)];
    },
  },
  {
    // High-contrast noir B&W — deep blacks, bright whites, dramatic.
    id: 'noir',
    name: 'Noir',
    transform: (r, g, b) => {
      const y = scurve(scurve(0.22 * r + 0.7 * g + 0.08 * b, 0.42), 0.15);
      return [y, y, y];
    },
  },
];

export function lutById(id: string): LutDef {
  return LUTS.find((l) => l.id === id) ?? LUTS[0];
}

// --- Real `.cube` LUT support ----------------------------------------------
export interface CubeData {
  size: number;
  /** Flattened size³ × 3, red-fastest order: idx = ((b*N + g)*N + r)*3. Values 0..1. */
  data: Float32Array;
}

/**
 * Parse an Adobe `.cube` 3D LUT (dependency-free, forgiving). Supports LUT_3D_SIZE,
 * comments (`#`), and DOMAIN_MIN/MAX (values are normalized back to 0..1). Returns
 * null on anything malformed so callers can fall back to identity.
 */
export function parseCube(text: string): CubeData | null {
  let size = 0;
  let dmin = [0, 0, 0];
  let dmax = [1, 1, 1];
  const rows: number[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const upper = line.toUpperCase();
    if (upper.startsWith('LUT_3D_SIZE')) {
      size = parseInt(line.split(/\s+/)[1], 10);
      continue;
    }
    if (upper.startsWith('LUT_1D_SIZE')) return null; // 1D LUTs unsupported
    if (upper.startsWith('DOMAIN_MIN')) {
      dmin = line.split(/\s+/).slice(1, 4).map(Number);
      continue;
    }
    if (upper.startsWith('DOMAIN_MAX')) {
      dmax = line.split(/\s+/).slice(1, 4).map(Number);
      continue;
    }
    if (upper.startsWith('TITLE') || upper.startsWith('LUT_3D_INPUT_RANGE')) continue;
    const parts = line.split(/\s+/).map(Number);
    if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) {
      rows.push(parts[0], parts[1], parts[2]);
    }
  }
  if (!size || size < 2 || rows.length !== size * size * size * 3) return null;
  const data = new Float32Array(rows.length);
  const span = [dmax[0] - dmin[0] || 1, dmax[1] - dmin[1] || 1, dmax[2] - dmin[2] || 1];
  for (let i = 0; i < rows.length; i += 3) {
    data[i] = clamp01((rows[i] - dmin[0]) / span[0]);
    data[i + 1] = clamp01((rows[i + 1] - dmin[1]) / span[1]);
    data[i + 2] = clamp01((rows[i + 2] - dmin[2]) / span[2]);
  }
  return { size, data };
}

/** Trilinear lookup into parsed `.cube` data at a normalized (r,g,b) point. */
export function sampleCube(cube: CubeData, r: number, g: number, b: number): [number, number, number] {
  const N = cube.size;
  const d = cube.data;
  const fr = clamp01(r) * (N - 1);
  const fg = clamp01(g) * (N - 1);
  const fb = clamp01(b) * (N - 1);
  const r0 = Math.floor(fr);
  const g0 = Math.floor(fg);
  const b0 = Math.floor(fb);
  const r1 = Math.min(r0 + 1, N - 1);
  const g1 = Math.min(g0 + 1, N - 1);
  const b1 = Math.min(b0 + 1, N - 1);
  const dr = fr - r0;
  const dg = fg - g0;
  const db = fb - b0;
  const at = (ri: number, gi: number, bi: number, c: number) => d[((bi * N + gi) * N + ri) * 3 + c];
  const lerpC = (c: number) => {
    const c00 = mix(at(r0, g0, b0, c), at(r1, g0, b0, c), dr);
    const c10 = mix(at(r0, g1, b0, c), at(r1, g1, b0, c), dr);
    const c01 = mix(at(r0, g0, b1, c), at(r1, g0, b1, c), dr);
    const c11 = mix(at(r0, g1, b1, c), at(r1, g1, b1, c), dr);
    return mix(mix(c00, c10, dg), mix(c01, c11, dg), db);
  };
  return [lerpC(0), lerpC(1), lerpC(2)];
}

/** Wrap a parsed `.cube` as a LutDef — resampled to our N on bake, shader unchanged. */
export function cubeToLutDef(id: string, name: string, cube: CubeData): LutDef {
  return { id, name, transform: (r, g, b) => sampleCube(cube, r, g, b) };
}

/**
 * Bake a LUT into the tiled RGBA byte texture the shader samples. Returns
 * `{ data, width, height }` where width = N·N, height = N. Works identically for
 * procedural specs and `.cube`-backed LUTs (both are just a `transform` closure).
 */
export function buildLutTexture(id: string): { data: Uint8Array; width: number; height: number } {
  const N = LUT_SIZE;
  const width = N * N;
  const height = N;
  const data = new Uint8Array(width * height * 4);
  const def = lutById(id);
  for (let bi = 0; bi < N; bi++) {
    for (let gi = 0; gi < N; gi++) {
      for (let ri = 0; ri < N; ri++) {
        const [or, og, ob] = def.transform(ri / (N - 1), gi / (N - 1), bi / (N - 1));
        const x = bi * N + ri; // slice bi, column ri
        const y = gi;
        const o = (y * width + x) * 4;
        data[o] = Math.round(clamp01(or) * 255);
        data[o + 1] = Math.round(clamp01(og) * 255);
        data[o + 2] = Math.round(clamp01(ob) * 255);
        data[o + 3] = 255;
      }
    }
  }
  return { data, width, height };
}
