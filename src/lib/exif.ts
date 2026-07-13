/**
 * Minimal EXIF reader for JPEG files (PRD 4.1 — show camera/lens/exposure).
 *
 * Parses just the APP1/TIFF block and the handful of tags we surface. No
 * dependency; deliberately forgiving — any parse failure returns `null` so the
 * UI simply omits the EXIF row rather than erroring. Only JPEG carries EXIF in
 * the formats we accept (PNG/WebP/HEIC won't, so we skip them).
 */

export interface ExifData {
  make?: string;
  model?: string;
  lens?: string;
  /** ISO speed, e.g. 400. */
  iso?: number;
  /** Human-readable shutter speed, e.g. "1/250s" or "2s". */
  shutter?: string;
  /** Aperture f-number, e.g. 2.8. */
  fNumber?: number;
  /** Focal length in mm. */
  focalLength?: number;
  /** Capture date/time as stored (EXIF "YYYY:MM:DD HH:MM:SS"). */
  dateTime?: string;
}

// TIFF tag ids we care about.
const TAG = {
  Make: 0x010f,
  Model: 0x0110,
  ExposureTime: 0x829a,
  FNumber: 0x829d,
  ExifOffset: 0x8769,
  ISO: 0x8827,
  DateTimeOriginal: 0x9003,
  FocalLength: 0x920a,
  LensModel: 0xa434,
} as const;

interface Field {
  type: number;
  count: number;
  valueOffset: number; // absolute offset into the buffer of the value/pointer
}

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

/** Read one IFD at `ifdStart` (relative to `tiffStart`); returns a tag→field map. */
function readIfd(
  view: DataView,
  tiffStart: number,
  ifdStart: number,
  le: boolean,
): Map<number, Field> {
  const fields = new Map<number, Field>();
  const base = tiffStart + ifdStart;
  if (base + 2 > view.byteLength) return fields;
  const count = view.getUint16(base, le);
  for (let i = 0; i < count; i++) {
    const entry = base + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = view.getUint16(entry, le);
    const type = view.getUint16(entry + 2, le);
    const num = view.getUint32(entry + 4, le);
    const size = (TYPE_SIZE[type] ?? 0) * num;
    // Values <=4 bytes are inline at entry+8; otherwise entry+8 is an offset.
    const valueOffset = size <= 4 ? entry + 8 : tiffStart + view.getUint32(entry + 8, le);
    fields.set(tag, { type, count: num, valueOffset });
  }
  return fields;
}

function readAscii(view: DataView, f: Field): string | undefined {
  let s = '';
  for (let i = 0; i < f.count; i++) {
    const off = f.valueOffset + i;
    if (off >= view.byteLength) break;
    const c = view.getUint8(off);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  s = s.trim();
  return s || undefined;
}

function readUint(view: DataView, f: Field, le: boolean): number | undefined {
  if (f.valueOffset + (TYPE_SIZE[f.type] ?? 0) > view.byteLength) return undefined;
  if (f.type === 3) return view.getUint16(f.valueOffset, le);
  if (f.type === 4) return view.getUint32(f.valueOffset, le);
  return undefined;
}

function readRational(view: DataView, f: Field, le: boolean): number | undefined {
  if (f.valueOffset + 8 > view.byteLength) return undefined;
  const numer = view.getUint32(f.valueOffset, le);
  const denom = view.getUint32(f.valueOffset + 4, le);
  if (!denom) return undefined;
  return numer / denom;
}

/** Format a shutter speed from seconds into a readable string. */
function formatShutter(seconds: number): string {
  if (seconds <= 0) return '';
  if (seconds >= 1) return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}s`;
  return `1/${Math.round(1 / seconds)}s`;
}

/** Parse EXIF from a JPEG buffer. Returns null when absent/unparseable. */
export function parseExif(buffer: ArrayBuffer): ExifData | null {
  try {
    const view = new DataView(buffer);
    if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return null; // not JPEG

    // Walk JPEG markers for APP1 (0xFFE1) carrying "Exif\0\0".
    let offset = 2;
    let tiffStart = -1;
    while (offset + 4 < view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      const segLen = view.getUint16(offset + 2, false);
      if (marker === 0xe1) {
        // "Exif\0\0" == 0x45786966 0000
        if (view.getUint32(offset + 4, false) === 0x45786966) {
          tiffStart = offset + 10;
          break;
        }
      }
      if (marker === 0xda) break; // start of scan — no more metadata
      offset += 2 + segLen;
    }
    if (tiffStart < 0 || tiffStart + 8 > view.byteLength) return null;

    // TIFF header: byte order + IFD0 offset.
    const byteOrder = view.getUint16(tiffStart, false);
    const le = byteOrder === 0x4949; // "II" little-endian, "MM" big-endian
    const ifd0Offset = view.getUint32(tiffStart + 4, le);
    const ifd0 = readIfd(view, tiffStart, ifd0Offset, le);

    const out: ExifData = {};
    const mk = ifd0.get(TAG.Make);
    if (mk) out.make = readAscii(view, mk);
    const md = ifd0.get(TAG.Model);
    if (md) out.model = readAscii(view, md);

    // EXIF sub-IFD holds exposure/ISO/lens.
    const exifPtr = ifd0.get(TAG.ExifOffset);
    if (exifPtr) {
      const exifIfd = readIfd(view, tiffStart, view.getUint32(exifPtr.valueOffset, le), le);
      const exp = exifIfd.get(TAG.ExposureTime);
      if (exp) {
        const s = readRational(view, exp, le);
        if (s != null) out.shutter = formatShutter(s);
      }
      const fn = exifIfd.get(TAG.FNumber);
      if (fn) {
        const v = readRational(view, fn, le);
        if (v != null) out.fNumber = Math.round(v * 10) / 10;
      }
      const iso = exifIfd.get(TAG.ISO);
      if (iso) out.iso = readUint(view, iso, le);
      const fl = exifIfd.get(TAG.FocalLength);
      if (fl) {
        const v = readRational(view, fl, le);
        if (v != null) out.focalLength = Math.round(v);
      }
      const lens = exifIfd.get(TAG.LensModel);
      if (lens) out.lens = readAscii(view, lens);
      const dt = exifIfd.get(TAG.DateTimeOriginal);
      if (dt) out.dateTime = readAscii(view, dt);
    }

    // Return null if we found nothing useful.
    return Object.values(out).some((v) => v != null && v !== '') ? out : null;
  } catch {
    return null;
  }
}

/** One-line human summary, e.g. "SONY ILCE-7M3 · 55mm · f/1.8 · 1/250s · ISO 400". */
export function summarizeExif(e: ExifData): string {
  const parts: string[] = [];
  const body = [e.make, e.model].filter(Boolean).join(' ').trim();
  // Cameras often repeat the make inside the model; collapse "SONY SONY".
  if (body) parts.push(dedupeMakeModel(body));
  if (e.lens) parts.push(e.lens);
  if (e.focalLength) parts.push(`${e.focalLength}mm`);
  if (e.fNumber) parts.push(`f/${e.fNumber}`);
  if (e.shutter) parts.push(e.shutter);
  if (e.iso) parts.push(`ISO ${e.iso}`);
  return parts.join(' · ');
}

function dedupeMakeModel(s: string): string {
  const words = s.split(/\s+/);
  if (words.length >= 2 && words[0].toUpperCase() === words[1].toUpperCase()) {
    return words.slice(1).join(' ');
  }
  return s;
}
