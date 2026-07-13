import type { Curves, Point } from './recipe';

// Build a 256-entry lookup table from draggable control points using
// monotone cubic (Fritsch–Carlson) interpolation, so the tone curve never
// overshoots or wiggles between points the way a naive spline would.
export function buildLut(points: Point[]): Float32Array {
  const lut = new Float32Array(256);

  // Sort + dedupe by x, keep within 0..255.
  const pts = [...points]
    .map(([x, y]) => [clampByte(x), clampByte(y)] as Point)
    .sort((a, b) => a[0] - b[0]);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [x, y] of pts) {
    if (xs.length && xs[xs.length - 1] === x) {
      ys[ys.length - 1] = y; // last one wins on duplicate x
    } else {
      xs.push(x);
      ys.push(y);
    }
  }

  if (xs.length === 0) {
    for (let i = 0; i < 256; i++) lut[i] = i / 255;
    return lut;
  }
  if (xs.length === 1) {
    lut.fill(ys[0] / 255);
    return lut;
  }

  const n = xs.length;
  // Secant slopes.
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const h = xs[i + 1] - xs[i];
    dx.push(h);
    slope.push((ys[i + 1] - ys[i]) / h);
  }

  // Tangents (Fritsch–Carlson).
  const m: number[] = new Array(n).fill(0);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) {
      m[i] = 0;
    } else {
      m[i] = (slope[i - 1] + slope[i]) / 2;
    }
  }
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const a = m[i] / slope[i];
      const b = m[i + 1] / slope[i];
      const s = a * a + b * b;
      if (s > 9) {
        const t = 3 / Math.sqrt(s);
        m[i] = t * a * slope[i];
        m[i + 1] = t * b * slope[i];
      }
    }
  }

  let seg = 0;
  for (let i = 0; i < 256; i++) {
    const x = i;
    if (x <= xs[0]) {
      lut[i] = clamp01(ys[0] / 255);
      continue;
    }
    if (x >= xs[n - 1]) {
      lut[i] = clamp01(ys[n - 1] / 255);
      continue;
    }
    while (seg < n - 2 && x > xs[seg + 1]) seg++;
    const h = dx[seg];
    const t = (x - xs[seg]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    // Hermite basis.
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    const y = h00 * ys[seg] + h10 * h * m[seg] + h01 * ys[seg + 1] + h11 * h * m[seg + 1];
    lut[i] = clamp01(y / 255);
  }
  return lut;
}

// Compose all four curves into a single RGBA LUT the shader samples once per
// channel: master (rgb) curve is applied first, then the per-channel curve.
// Packed as a 256x1 RGBA8 texture (r,g,b = channel outputs; a unused).
export function buildCurveTextureData(curves: Curves): Uint8Array {
  const master = buildLut(curves.rgb);
  const red = buildLut(curves.red);
  const green = buildLut(curves.green);
  const blue = buildLut(curves.blue);
  const data = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    // master maps index -> 0..1; feed that through the per-channel curve.
    const mr = sample(red, master[i]);
    const mg = sample(green, master[i]);
    const mb = sample(blue, master[i]);
    data[i * 4 + 0] = Math.round(mr * 255);
    data[i * 4 + 1] = Math.round(mg * 255);
    data[i * 4 + 2] = Math.round(mb * 255);
    data[i * 4 + 3] = 255;
  }
  return data;
}

function sample(lut: Float32Array, x01: number): number {
  const x = clamp01(x01) * 255;
  const i0 = Math.floor(x);
  const i1 = Math.min(255, i0 + 1);
  const f = x - i0;
  return lut[i0] * (1 - f) + lut[i1] * f;
}

function clampByte(v: number): number {
  return Math.min(255, Math.max(0, v));
}
function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// True when the curves are identity (lets the renderer skip the LUT step).
export function isIdentityCurves(curves: Curves): boolean {
  const identity = (p: Point[]) =>
    p.length === 2 && p[0][0] === 0 && p[0][1] === 0 && p[1][0] === 255 && p[1][1] === 255;
  return (
    identity(curves.rgb) && identity(curves.red) && identity(curves.green) && identity(curves.blue)
  );
}
