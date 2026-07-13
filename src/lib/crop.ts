// Crop/transform geometry. Turns a `Crop` (rect + straighten + orientation)
// into an affine sampling map the shader uses to read the source texture:
//
//     sourceUV = origin + outputUV.x * u + outputUV.y * v
//
// plus the output pixel dimensions. All math lives here (testable, readable)
// so the shader/renderer just plug values in. Straighten rotates about the
// image center — matching a CSS `rotate()` preview about the element center.

import type { Crop } from './recipe';

export interface CropTransform {
  origin: [number, number];
  u: [number, number];
  v: [number, number];
  outW: number;
  outH: number;
}

export interface AspectPreset {
  label: string;
  // width/height ratio in display space; null = free; 'original' = image aspect.
  ratio: number | null | 'original';
}

export const ASPECT_PRESETS: AspectPreset[] = [
  { label: 'Free', ratio: null },
  { label: 'Original', ratio: 'original' },
  { label: '1:1', ratio: 1 },
  { label: '4:5', ratio: 4 / 5 },
  { label: '5:4', ratio: 5 / 4 },
  { label: '3:2', ratio: 3 / 2 },
  { label: '2:3', ratio: 2 / 3 },
  { label: '16:9', ratio: 16 / 9 },
  { label: '9:16', ratio: 9 / 16 },
];

const IDENTITY: CropTransform = {
  origin: [0, 0],
  u: [1, 0],
  v: [0, 1],
  outW: 1,
  outH: 1,
};

/**
 * Compute the sampling affine + output dimensions for a crop at a given source
 * resolution. `outW/outH` come out in pixels at that resolution, so preview and
 * export share identical geometry (the affine itself is resolution-independent).
 */
export function computeCropTransform(c: Crop, imgW: number, imgH: number): CropTransform {
  const W = imgW;
  const H = imgH;
  const { x, y, w, h, angle } = c;
  const theta = (angle * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  // --- Straighten + crop affine (rotation about image center 0.5,0.5) ---
  // op.x spans the crop width w, op.y spans the crop height h, in display space;
  // we inverse-rotate each display point back into source UV.
  const U: [number, number] = [cos * w, (-sin * w * W) / H];
  const V: [number, number] = [(sin * h * H) / W, cos * h];

  const d0x = (x - 0.5) * W;
  const d0y = (y - 0.5) * H;
  const s0x = cos * d0x + sin * d0y;
  const s0y = -sin * d0x + cos * d0y;
  const origin: [number, number] = [0.5 + s0x / W, 0.5 + s0y / H];

  // --- Auto-inset: shrink the rect about its center so a straightened crop
  // never samples outside the source (no clamped-edge smear on the corners). ---
  const s = fitScale(origin, U, V);
  if (s < 1) {
    const cx = origin[0] + 0.5 * U[0] + 0.5 * V[0];
    const cy = origin[1] + 0.5 * U[1] + 0.5 * V[1];
    U[0] *= s; U[1] *= s;
    V[0] *= s; V[1] *= s;
    origin[0] = cx - 0.5 * U[0] - 0.5 * V[0];
    origin[1] = cy - 0.5 * U[1] - 0.5 * V[1];
  }

  let outW = Math.max(1, Math.round(w * W * s));
  let outH = Math.max(1, Math.round(h * H * s));

  // --- Orientation: rotate the output square by 90°*k (clockwise) ---
  const k = ((Math.round(c.orientation) % 4) + 4) % 4;
  const base = (a: number, b: number): [number, number] => [
    origin[0] + a * U[0] + b * V[0],
    origin[1] + a * U[1] + b * V[1],
  ];
  const lin = (a: number, b: number): [number, number] => [
    a * U[0] + b * V[0],
    a * U[1] + b * V[1],
  ];

  // For output op' (top-left origin, y-down), base_op = P + op'.x*A + op'.y*B.
  let P: [number, number], A: [number, number], B: [number, number];
  if (k === 0) {
    P = [0, 0]; A = [1, 0]; B = [0, 1];
  } else if (k === 1) {
    P = [0, 1]; A = [0, -1]; B = [1, 0];
  } else if (k === 2) {
    P = [1, 1]; A = [-1, 0]; B = [0, -1];
  } else {
    P = [1, 0]; A = [0, 1]; B = [-1, 0];
  }

  const nOrigin = base(P[0], P[1]);
  const nU = lin(A[0], A[1]);
  const nV = lin(B[0], B[1]);
  if (k % 2 === 1) [outW, outH] = [outH, outW];

  return { origin: nOrigin, u: nU, v: nV, outW, outH };
}

// Largest scale <= 1 (about the rect center) keeping all 4 corners inside the
// [0,1] source box. Returns 1 when the rect already fits.
function fitScale(origin: [number, number], U: [number, number], V: [number, number]): number {
  const cx = origin[0] + 0.5 * U[0] + 0.5 * V[0];
  const cy = origin[1] + 0.5 * U[1] + 0.5 * V[1];
  // How far can we scale q away from center m before it leaves [0,1]?
  const axis = (q: number, m: number): number => {
    if (q > m) return (1 - m) / (q - m);
    if (q < m) return m / (m - q);
    return Infinity;
  };
  let s = 1;
  for (const [a, b] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ]) {
    const qx = origin[0] + a * U[0] + b * V[0];
    const qy = origin[1] + a * U[1] + b * V[1];
    s = Math.min(s, axis(qx, cx), axis(qy, cy));
  }
  return Math.max(0, s);
}

export function identityTransform(imgW: number, imgH: number): CropTransform {
  return { ...IDENTITY, outW: Math.max(1, Math.round(imgW)), outH: Math.max(1, Math.round(imgH)) };
}
