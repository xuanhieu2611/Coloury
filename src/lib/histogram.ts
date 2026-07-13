import { create } from 'zustand';

export interface HistogramData {
  r: number[];
  g: number[];
  b: number[];
  lum: number[];
}

interface HistogramState {
  data: HistogramData | null;
  set: (d: HistogramData) => void;
}

export const useHistogram = create<HistogramState>((set) => ({
  data: null,
  set: (data) => set({ data }),
}));

// Compute a 64-bin histogram from an ImageData buffer (already downsampled).
export function computeHistogram(pixels: Uint8ClampedArray, bins = 64): HistogramData {
  const r = new Array(bins).fill(0);
  const g = new Array(bins).fill(0);
  const b = new Array(bins).fill(0);
  const lum = new Array(bins).fill(0);
  const scale = bins / 256;
  for (let i = 0; i < pixels.length; i += 4) {
    const pr = pixels[i];
    const pg = pixels[i + 1];
    const pb = pixels[i + 2];
    r[Math.min(bins - 1, (pr * scale) | 0)]++;
    g[Math.min(bins - 1, (pg * scale) | 0)]++;
    b[Math.min(bins - 1, (pb * scale) | 0)]++;
    const l = 0.2126 * pr + 0.7152 * pg + 0.0722 * pb;
    lum[Math.min(bins - 1, (l * scale) | 0)]++;
  }
  return { r, g, b, lum };
}
