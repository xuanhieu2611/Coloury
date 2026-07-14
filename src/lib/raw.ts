/**
 * RAW decode (M5) — decode camera RAW files in the browser via LibRaw (wasm).
 *
 * LibRaw runs in its own Web Worker (spawned by the package) and demosaics the
 * sensor data into an 8-bit sRGB RGB buffer. We paint that onto a full-res
 * canvas which then flows through the *exact* same edit pipeline as a decoded
 * JPEG — the renderer's `ImageSource` accepts a canvas, so nothing downstream
 * changes. RAW metadata is mapped into the existing `ExifData` shape so the
 * toolbar camera/lens/exposure readout works for RAW too.
 *
 * Deliberately dependency-boundaried: `libraw-wasm` is a ~2MB wasm module, so it
 * is dynamically `import()`ed only when a RAW file is actually opened (keeps it
 * off the JPEG/PNG path and out of the SSR bundle).
 */

import type { ExifData } from './exif';

// Extensions LibRaw can decode. Not exhaustive of every LibRaw format, but the
// common ones users actually upload. Detection is by extension because RAW
// files rarely carry a reliable MIME type from the OS file picker.
const RAW_RE =
  /\.(arw|sr2|srf|cr2|cr3|crw|nef|nrw|dng|raf|rw2|orf|pef|srw|3fr|erf|kdc|dcr|mos|mrw|x3f|iiq|rwl|raw)$/i;

export function isRaw(file: File): boolean {
  return RAW_RE.test(file.name);
}

export interface DecodedRaw {
  /** Full-resolution decoded RGBA image, orientation already applied. */
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  exif: ExifData | null;
}

/** Format a shutter time in seconds the way the EXIF reader does ("1/250s", "2s"). */
function formatShutter(seconds: number): string | undefined {
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  if (seconds >= 1) return `${Number(seconds.toFixed(1))}s`;
  return `1/${Math.round(1 / seconds)}s`;
}

function clean(s: unknown): string | undefined {
  if (typeof s !== 'string') return undefined;
  const t = s.trim();
  return t.length ? t : undefined;
}

/** Map LibRaw metadata into our toolbar's ExifData shape (best-effort). */
function toExif(meta: Record<string, unknown> | undefined): ExifData | null {
  if (!meta) return null;
  const make = clean(meta.camera_make ?? meta.normalized_make);
  const model = clean(meta.camera_model ?? meta.normalized_model);
  const lensBlock = meta.lens as { lensName?: string; Lens?: string } | undefined;
  const lens = clean(lensBlock?.lensName ?? lensBlock?.Lens);
  const iso = Number(meta.iso_speed);
  const fNumber = Number(meta.aperture);
  const focalLength = Number(meta.focal_len);
  const shutter = formatShutter(Number(meta.shutter));
  const timestamp = meta.timestamp;
  const dateTime =
    timestamp instanceof Date && !Number.isNaN(timestamp.getTime())
      ? timestamp
          .toISOString()
          .replace('T', ' ')
          .replace(/\..*$/, '')
          .replace(/-/g, ':')
      : undefined;

  const exif: ExifData = {
    make,
    model,
    lens,
    iso: Number.isFinite(iso) && iso > 0 ? Math.round(iso) : undefined,
    shutter,
    fNumber: Number.isFinite(fNumber) && fNumber > 0 ? fNumber : undefined,
    focalLength: Number.isFinite(focalLength) && focalLength > 0 ? focalLength : undefined,
    dateTime,
  };
  // If every field is empty, treat as no metadata.
  return Object.values(exif).some((v) => v !== undefined) ? exif : null;
}

/**
 * Decode a RAW File into a full-res RGBA canvas + mapped EXIF. Rejects if the
 * file can't be decoded (unsupported/corrupt), so callers should try/catch and
 * surface a friendly message.
 */
export async function decodeRaw(file: File): Promise<DecodedRaw> {
  // Vendored client (worker served from /public) — NOT the npm entry, whose
  // `new URL('./worker.js', import.meta.url)` deadlocks Turbopack's build. See
  // src/lib/libraw-client.ts.
  const LibRaw = (await import('./libraw-client')).default;
  const raw = new LibRaw();
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    // useCameraWb: honor the camera's recorded white balance (natural colors);
    // outputColor 1 = sRGB; outputBps 8 = our pipeline is 8-bit; userQual 3 =
    // AHD demosaic (good quality/speed). userFlip default (-1) applies the RAW's
    // own orientation so width/height already reflect the upright image.
    await raw.open(bytes, {
      useCameraWb: true,
      outputColor: 1,
      outputBps: 8,
      userQual: 3,
    });

    let exif: ExifData | null = null;
    try {
      const meta = (await raw.metadata(true)) as Record<string, unknown> | undefined;
      exif = toExif(meta);
    } catch {
      exif = null; // metadata is a bonus; never fail the decode over it
    }

    const img = await raw.imageData();
    if (!img || !img.data || !img.width || !img.height) {
      throw new Error('empty-decode');
    }
    const { width, height, colors, data } = img;

    // LibRaw gives tightly-packed `colors`-channel 8-bit pixels; the canvas needs
    // RGBA. colors is 3 (RGB) for normal output, occasionally 1 (mono) or 4.
    const rgba = new Uint8ClampedArray(width * height * 4);
    const src = data as Uint8Array;
    const c = colors || 3;
    for (let i = 0, p = 0, s = 0; i < width * height; i++, p += 4, s += c) {
      if (c >= 3) {
        rgba[p] = src[s];
        rgba[p + 1] = src[s + 1];
        rgba[p + 2] = src[s + 2];
      } else {
        // Monochrome: replicate the single channel across RGB.
        rgba[p] = rgba[p + 1] = rgba[p + 2] = src[s];
      }
      rgba[p + 3] = 255;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas-2d-unavailable');
    ctx.putImageData(new ImageData(rgba, width, height), 0, 0);

    return { canvas, width, height, exif };
  } finally {
    // Free the wasm worker + its heap.
    raw.dispose?.();
  }
}
