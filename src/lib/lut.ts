/**
 * 3D LUT film-sim stage (Film-engine Phase 2, step 5).
 *
 * A LUT is an arbitrary RGB→RGB mapping — the way to get film looks whose hue
 * crosstalk a parametric slider can't reach (Classic-Chrome-style teal shadows,
 * skin roll-off, etc.). We ship a small set of **self-authored, procedurally
 * generated** LUTs (no proprietary `.cube` files — licensing, CLAUDE.md) baked
 * into a tiled 2D texture the shader samples with trilinear interpolation.
 *
 * Texture layout: an N³ cube stored as N slices laid left-to-right. The texture
 * is (N·N) wide × N tall; slice `b` occupies columns [b·N, (b+1)·N), with r→x
 * within the slice and g→y. The shader (`sampleLut` in shaders.ts) reads it back
 * with the matching coordinate math. Swap `TRANSFORMS` for real `.cube` data
 * later without touching the shader.
 */

export const LUT_SIZE = 17; // N — 17³ = 4913 entries; good fidelity, tiny texture

export interface LutDef {
  id: string;
  name: string;
  transform: (r: number, g: number, b: number) => [number, number, number];
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
// Smooth S-curve contrast around 0.5.
const scurve = (v: number, amt: number) => {
  const x = v - 0.5;
  return clamp01(0.5 + x * (1 + amt) - amt * 2 * x * x * x * 4);
};
const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// Each LUT is a plain color function over the unit cube — baked once into a
// texture. `none` is identity (the stage is skipped when selected).
export const LUTS: LutDef[] = [
  { id: 'none', name: 'None', transform: (r, g, b) => [r, g, b] },
  {
    id: 'kodak',
    name: 'Kodak Warm',
    transform: (r, g, b) => {
      // Warm highlights, gently lifted shadows, gold cast.
      const l = luma(r, g, b);
      const lift = 0.03 * (1 - l);
      return [
        clamp01(scurve(r, 0.18) + 0.03 + lift),
        clamp01(scurve(g, 0.12) + 0.01 + lift * 0.6),
        clamp01(scurve(b, 0.1) - 0.03 * l + lift * 0.2),
      ];
    },
  },
  {
    id: 'teal-orange',
    name: 'Teal · Orange',
    transform: (r, g, b) => {
      // Cinematic split: shadows → teal, highlights → orange.
      const l = luma(r, g, b);
      const shadow = 1 - l;
      return [
        clamp01(scurve(r, 0.22) + 0.06 * l - 0.03 * shadow),
        clamp01(scurve(g, 0.14) + 0.02 * l + 0.02 * shadow),
        clamp01(scurve(b, 0.16) - 0.05 * l + 0.08 * shadow),
      ];
    },
  },
  {
    id: 'bw-film',
    name: 'B&W Film',
    transform: (r, g, b) => {
      // Panchromatic-ish luminance with a contrast toe/shoulder.
      const y = scurve(0.24 * r + 0.68 * g + 0.08 * b, 0.28);
      return [y, y, y];
    },
  },
  {
    id: 'faded',
    name: 'Faded Retro',
    transform: (r, g, b) => {
      // Lifted matte blacks, pulled highlights, cool desaturated.
      const l = luma(r, g, b);
      const desat = (c: number) => mix(c, l, 0.35);
      const fade = (c: number) => mix(desat(c), 0.5, 0.0) * 0.86 + 0.09; // compress to [0.09, 0.95]
      return [
        clamp01(fade(r) - 0.01),
        clamp01(fade(g) + 0.005),
        clamp01(fade(b) + 0.03),
      ];
    },
  },
];

export function lutById(id: string): LutDef {
  return LUTS.find((l) => l.id === id) ?? LUTS[0];
}

/**
 * Bake a LUT into the tiled RGBA byte texture the shader samples. Returns
 * `{ data, width, height }` where width = N·N, height = N.
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
