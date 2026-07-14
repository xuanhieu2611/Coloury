/**
 * Overlay compositing (Film-engine Phase 2). Overlays sit ON TOP of the graded
 * WebGL output — pure canvas-2D drawing, no shader math. The same code powers
 * both the live preview (an overlay canvas over the GL canvas) and export
 * (composited onto a 2D canvas at full output resolution), so preview == export.
 *
 * Overlays implemented:
 *  - date stamp   — orange 7-segment vintage-digicam timestamp
 *  - light leak   — procedural warm glow bled in from an edge/corner (screen)
 *  - dust         — procedural specks (multiply) + scratches (screen), seeded
 *  - border/frame — white/black matte, film strip (sprocket holes), Polaroid;
 *                   the output canvas EXPANDS around the image (nothing cropped)
 *
 * `composeOverlays` renders the full framed result onto a 2D context;
 * `drawOverlays` draws just the leak/dust/stamp within a given image region.
 */

import type { Border, DateStamp, Dust, LightLeak, Overlays } from './recipe';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// --- Date resolution --------------------------------------------------------

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Format a Date as the classic `'YY MM DD` digicam stamp, e.g. `'26 07 13`. */
export function formatStampDate(d: Date): string {
  const yy = pad2(d.getFullYear() % 100);
  return `'${yy} ${pad2(d.getMonth() + 1)} ${pad2(d.getDate())}`;
}

/**
 * The default stamp text when the user first enables it: the photo's EXIF
 * capture date if present (EXIF stores "YYYY:MM:DD HH:MM:SS"), else today.
 */
export function defaultStampText(exifDateTime?: string | null): string {
  if (exifDateTime) {
    const m = exifDateTime.match(/^(\d{4}):(\d{2}):(\d{2})/);
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      if (!Number.isNaN(d.getTime())) return formatStampDate(d);
    }
  }
  return formatStampDate(new Date());
}

// --- 7-segment glyph rendering ---------------------------------------------

// Which of the 7 segments light up for each digit.
//   a = top, b = top-right, c = bottom-right, d = bottom,
//   e = bottom-left, f = top-left, g = middle.
const SEGMENTS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abgcd',
  '4': 'fgbc',
  '5': 'afgcd',
  '6': 'afgedc',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcfgd',
};

/** Draw one 7-segment digit into the box (x, y, w, h) with segment width t. */
function drawDigit(
  ctx: CanvasRenderingContext2D,
  ch: string,
  x: number,
  y: number,
  w: number,
  h: number,
  t: number,
): void {
  const segs = SEGMENTS[ch];
  if (!segs) return;
  const q = t * 0.55; // gap so segments don't touch at the corners
  const midY = y + (h - t) / 2;
  const vLen = (h - t) / 2 - t / 2 - q; // length of a vertical (half-height) segment
  const on = (s: string) => segs.includes(s);
  const bar = (bx: number, by: number, bw: number, bh: number) => ctx.fillRect(bx, by, bw, bh);

  if (on('a')) bar(x + t + q, y, w - 2 * t - 2 * q, t);
  if (on('g')) bar(x + t + q, midY, w - 2 * t - 2 * q, t);
  if (on('d')) bar(x + t + q, y + h - t, w - 2 * t - 2 * q, t);
  if (on('f')) bar(x, y + t + q, t, vLen);
  if (on('b')) bar(x + w - t, y + t + q, t, vLen);
  if (on('e')) bar(x, midY + t + q, t, vLen);
  if (on('c')) bar(x + w - t, midY + t + q, t, vLen);
}

// Per-character advance width as a multiple of the base digit width.
function advanceFactor(ch: string): number {
  if (ch === ' ') return 0.6;
  if (ch === "'") return 0.45;
  return 1;
}

function drawDateStamp(ctx: CanvasRenderingContext2D, region: Rect, ds: DateStamp): void {
  const text = ds.text.trim();
  if (!text) return;

  const minEdge = Math.min(region.w, region.h);
  const digitH = minEdge * (0.03 + clamp01(ds.size / 100) * 0.055); // ~3%..8.5% of short edge
  const digitW = digitH * 0.58;
  const t = Math.max(1, digitH * 0.15);
  const spacing = digitW * 0.34;
  const margin = digitH * 0.75;

  let total = 0;
  for (const ch of text) total += digitW * advanceFactor(ch) + spacing;
  total = Math.max(0, total - spacing);

  const right = ds.corner === 'tr' || ds.corner === 'br';
  const bottom = ds.corner === 'bl' || ds.corner === 'br';
  const x0 = right ? region.x + region.w - margin - total : region.x + margin;
  const y0 = bottom ? region.y + region.h - margin - digitH : region.y + margin;

  ctx.save();
  ctx.fillStyle = ds.color;
  ctx.shadowColor = ds.color;
  ctx.shadowBlur = digitH * 0.28; // soft LED bloom
  let cx = x0;
  for (const ch of text) {
    const cw = digitW * advanceFactor(ch);
    if (ch === "'") {
      ctx.fillRect(cx, y0, t, digitH * 0.3);
    } else if (ch !== ' ') {
      drawDigit(ctx, ch, cx, y0, digitW, digitH, t);
    }
    cx += cw + spacing;
  }
  ctx.restore();
}

// --- Light leak -------------------------------------------------------------

const LEAK_COLORS: Record<LightLeak['type'], [number, number, number]> = {
  warm: [255, 120, 40],
  red: [255, 45, 60],
  golden: [255, 205, 90],
};

function drawLightLeak(ctx: CanvasRenderingContext2D, region: Rect, leak: LightLeak): void {
  const s = clamp01(leak.strength / 100);
  if (s <= 0) return;
  const { x, y, w, h } = region;
  const [r, g, b] = LEAK_COLORS[leak.type] ?? LEAK_COLORS.warm;

  // Anchor the glow to the chosen edge/corner.
  let cxp = x + w,
    cyp = y,
    rad = Math.max(w, h) * 0.85;
  switch (leak.position) {
    case 'left':
      cxp = x; cyp = y + h * 0.5; rad = w * 0.95; break;
    case 'right':
      cxp = x + w; cyp = y + h * 0.5; rad = w * 0.95; break;
    case 'top':
      cxp = x + w * 0.5; cyp = y; rad = h * 0.95; break;
    case 'bottom':
      cxp = x + w * 0.5; cyp = y + h; rad = h * 0.95; break;
    case 'corner':
    default:
      cxp = x + w; cyp = y; rad = Math.max(w, h) * 0.85; break;
  }

  const grd = ctx.createRadialGradient(cxp, cyp, 0, cxp, cyp, rad);
  grd.addColorStop(0, `rgba(${r},${g},${b},${(0.9 * s).toFixed(3)})`);
  grd.addColorStop(0.4, `rgba(${r},${g},${b},${(0.45 * s).toFixed(3)})`);
  grd.addColorStop(1, `rgba(${r},${g},${b},0)`);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip(); // keep the leak on the image, not the border
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = grd;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// --- Dust & scratches -------------------------------------------------------

// Small deterministic PRNG so preview and export draw the identical specks.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawDust(ctx: CanvasRenderingContext2D, region: Rect, dust: Dust): void {
  const a = clamp01(dust.amount / 100);
  if (a <= 0) return;
  const { x, y, w, h } = region;
  const rng = mulberry32(0x9e3779b9); // fixed seed → stable specks
  const base = Math.max(0.6, Math.min(w, h) / 600);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // Dust specks — dark, multiply.
  ctx.globalCompositeOperation = 'multiply';
  const specks = Math.floor(a * 280);
  for (let i = 0; i < specks; i++) {
    const px = x + rng() * w;
    const py = y + rng() * h;
    const rr = (0.5 + rng() * 1.6) * base;
    ctx.fillStyle = `rgba(18,14,10,${(0.25 + rng() * 0.45).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(px, py, rr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Scratches — bright, thin, near-vertical, screen.
  ctx.globalCompositeOperation = 'screen';
  const scratches = Math.floor(a * 7);
  for (let i = 0; i < scratches; i++) {
    let sx = x + rng() * w;
    ctx.strokeStyle = `rgba(235,230,220,${(0.15 + rng() * 0.35).toFixed(3)})`;
    ctx.lineWidth = (0.4 + rng() * 1.1) * base;
    ctx.beginPath();
    ctx.moveTo(sx, y);
    const segs = 6;
    for (let s = 1; s <= segs; s++) {
      sx += (rng() - 0.5) * base * 4;
      ctx.lineTo(sx, y + (h * s) / segs);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// --- Borders / frames -------------------------------------------------------

export interface Frame {
  outW: number;
  outH: number;
  region: Rect; // where the image sits within the framed output
}

/**
 * Given the image dims and a border, return the expanded output dims and the
 * rect the image occupies. The frame ADDS area around the image (no crop).
 */
export function computeFrame(imgW: number, imgH: number, border: Border | undefined): Frame {
  if (!border || border.style === 'none' || border.size <= 0) {
    return { outW: imgW, outH: imgH, region: { x: 0, y: 0, w: imgW, h: imgH } };
  }
  const base = Math.min(imgW, imgH);
  const pad = Math.max(1, Math.round(base * (border.size / 100) * 0.12));
  let l = pad,
    r = pad,
    t = pad,
    b = pad;
  if (border.style === 'film') {
    t = Math.round(pad * 1.5); // wider bars top/bottom for sprocket holes
    b = t;
  } else if (border.style === 'polaroid') {
    b = Math.round(pad * 3.2); // classic thick bottom lip
  }
  return { outW: imgW + l + r, outH: imgH + t + b, region: { x: l, y: t, w: imgW, h: imgH } };
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rad: number,
): void {
  const r = Math.min(rad, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawFrame(ctx: CanvasRenderingContext2D, frame: Frame, border: Border): void {
  const { outW, outH, region } = frame;
  const bg =
    border.style === 'black' || border.style === 'film'
      ? '#121212'
      : border.style === 'polaroid'
        ? '#f6f3ea'
        : '#ffffff';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, outW, outH);

  if (border.style === 'film') {
    // Sprocket holes evenly spaced along the top and bottom bars.
    const barT = region.y;
    const barB = outH - (region.y + region.h);
    const holeH = Math.min(barT, barB) * 0.5;
    const holeW = holeH * 0.7;
    const step = holeW * 1.9;
    ctx.fillStyle = '#3a3a3a';
    for (let hx = step * 0.5; hx + holeW < outW; hx += step) {
      roundRectPath(ctx, hx, (barT - holeH) / 2, holeW, holeH, holeH * 0.25);
      ctx.fill();
      roundRectPath(ctx, hx, outH - barB + (barB - holeH) / 2, holeW, holeH, holeH * 0.25);
      ctx.fill();
    }
  }
}

// --- Public API -------------------------------------------------------------

function borderActive(border: Border | undefined): boolean {
  return !!border && border.style !== 'none' && border.size > 0;
}

/** True when any overlay would draw (drives whether preview/export composite). */
export function overlaysActive(overlays: Overlays | undefined): boolean {
  if (!overlays) return false;
  return (
    (overlays.dateStamp.enabled && overlays.dateStamp.text.trim().length > 0) ||
    (overlays.lightLeak.enabled && overlays.lightLeak.strength > 0) ||
    (overlays.dust.enabled && overlays.dust.amount > 0) ||
    borderActive(overlays.border)
  );
}

/** Draw the leak/dust/stamp overlays within a given image region (no frame). */
export function drawOverlays(
  ctx: CanvasRenderingContext2D,
  region: Rect,
  overlays: Overlays | undefined,
): void {
  if (!overlays) return;
  if (overlays.lightLeak.enabled) drawLightLeak(ctx, region, overlays.lightLeak);
  if (overlays.dust.enabled) drawDust(ctx, region, overlays.dust);
  if (overlays.dateStamp.enabled) drawDateStamp(ctx, region, overlays.dateStamp);
}

/**
 * Compose the full framed result of `src` (the graded image canvas) onto `ctx`.
 * The context's canvas must already be sized to `computeFrame(...).out{W,H}`.
 * Draws: border background + decorations → image → leak/dust/stamp.
 */
export function composeOverlays(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource & { width: number; height: number },
  overlays: Overlays | undefined,
): void {
  const frame = computeFrame(src.width, src.height, overlays?.border);
  if (overlays && borderActive(overlays.border)) drawFrame(ctx, frame, overlays.border);
  ctx.drawImage(src, frame.region.x, frame.region.y, frame.region.w, frame.region.h);
  drawOverlays(ctx, frame.region, overlays);
}
