import { create } from 'zustand';
import { cloneRecipe, defaultRecipe, type EditRecipe } from './recipe';
import { parseExif, type ExifData } from './exif';
import { decodeRaw, isRaw } from './raw';

export interface LoadedImage {
  // Full-resolution decoded source. An <img> for JPEG/PNG/WebP/HEIC; a <canvas>
  // for RAW (LibRaw decodes to pixels, not an <img>). Both satisfy the
  // renderer's `ImageSource` (TexImageSource) contract used for export.
  element: HTMLImageElement | HTMLCanvasElement;
  preview: HTMLCanvasElement; // downsampled (<= MAX_PREVIEW) for live editing
  name: string;
  width: number;
  height: number;
  fileSize: number;
  exif: ExifData | null; // camera/lens/exposure metadata (JPEG only), if present
}

const MAX_PREVIEW = 2048; // long-edge cap for the live preview (PRD 5.3)
const HISTORY_LIMIT = 100;

/** Which editing surface is shown. `simple` = filter-first front door (Auto Edit
 *  + Filters); `advanced` reveals the pro cockpit (histogram + manual panels). */
export type EditMode = 'simple' | 'advanced';

interface EditorState {
  image: LoadedImage | null;
  recipe: EditRecipe;
  past: EditRecipe[];
  future: EditRecipe[];
  // Recipe as it was before the current uncommitted (drag) edit sequence began.
  pending: EditRecipe | null;
  // Increments to ask the canvas to play a one-shot before→after "reveal" wipe
  // (the WOW moment when a filter is tapped). The canvas watches this nonce.
  reveal: number;
  // UI-only view state (not part of the recipe). Persists across image loads so
  // a user who prefers Advanced keeps it when they open the next photo.
  mode: EditMode;

  setImage: (img: LoadedImage) => void;
  setMode: (mode: EditMode) => void;
  /** Update the recipe. `commit` pushes a history entry (default true). Live
   *  slider drags pass commit=false and call commit() once on release. */
  update: (mutator: (r: EditRecipe) => void, commit?: boolean) => void;
  setRecipe: (r: EditRecipe, commit?: boolean) => void;
  commit: () => void; // finalize a drag: push the pre-drag snapshot to history
  undo: () => void;
  redo: () => void;
  resetAll: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  /** Play a one-shot before→after wipe on the canvas (called when a look is picked). */
  triggerReveal: () => void;
}

export const useEditor = create<EditorState>((set, get) => ({
  image: null,
  recipe: defaultRecipe(),
  past: [],
  future: [],
  pending: null,
  reveal: 0,
  mode: 'simple',

  setImage: (img) =>
    // `mode` is intentionally omitted so the user's Simple/Advanced choice persists.
    set({ image: img, recipe: defaultRecipe(), past: [], future: [], pending: null, reveal: 0 }),

  setMode: (mode) => set({ mode }),

  update: (mutator, commit = true) => {
    const { recipe, past, pending } = get();
    const next = cloneRecipe(recipe);
    mutator(next);
    if (commit) {
      set({
        recipe: next,
        past: [...past, recipe].slice(-HISTORY_LIMIT),
        future: [],
        pending: null,
      });
    } else {
      // First uncommitted edit of a drag: remember the pre-edit recipe so
      // commit() can push it. Later edits in the same drag keep that snapshot.
      set({ recipe: next, pending: pending ?? recipe });
    }
  },

  setRecipe: (r, commit = true) => {
    const { recipe, past } = get();
    if (commit) {
      set({
        recipe: cloneRecipe(r),
        past: [...past, recipe].slice(-HISTORY_LIMIT),
        future: [],
        pending: null,
      });
    } else {
      set({ recipe: cloneRecipe(r) });
    }
  },

  // Finalize a drag: push the snapshot captured at drag start onto history.
  commit: () => {
    const { recipe, past, pending } = get();
    if (!pending) return;
    if (JSON.stringify(pending) === JSON.stringify(recipe)) {
      set({ pending: null });
      return;
    }
    set({
      past: [...past, cloneRecipe(pending)].slice(-HISTORY_LIMIT),
      future: [],
      pending: null,
    });
  },

  undo: () => {
    const { past, future, recipe } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    set({
      recipe: previous,
      past: past.slice(0, -1),
      future: [recipe, ...future].slice(0, HISTORY_LIMIT),
      pending: null,
    });
  },

  redo: () => {
    const { past, future, recipe } = get();
    if (future.length === 0) return;
    const next = future[0];
    set({
      recipe: next,
      past: [...past, recipe].slice(-HISTORY_LIMIT),
      future: future.slice(1),
      pending: null,
    });
  },

  resetAll: () => {
    const { recipe, past } = get();
    set({
      recipe: defaultRecipe(),
      past: [...past, recipe].slice(-HISTORY_LIMIT),
      future: [],
      pending: null,
    });
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  triggerReveal: () => set({ reveal: get().reveal + 1 }),
}));

const HEIC_RE = /\.(heic|heif)$/i;
function isHeic(file: File): boolean {
  return file.type === 'image/heic' || file.type === 'image/heif' || HEIC_RE.test(file.name);
}

/** Decode a Blob URL into an HTMLImageElement (rejects on decode failure). */
function decodeImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode-failed'));
    img.src = url;
  });
}

/**
 * Decode a File into a full-res HTMLImageElement plus a downsampled preview
 * canvas. HEIC/HEIF: tries browser-native decode first (Safari's is fast), then
 * falls back to a client-side heic2any conversion so Chrome/Firefox work too.
 * Also parses EXIF (JPEG only) for the camera/lens/exposure readout (PRD 4.1).
 */
export async function loadImageFile(file: File): Promise<LoadedImage> {
  // RAW files (ARW/CR2/NEF/DNG/…) don't decode via <img>; LibRaw (wasm) turns
  // the sensor data into a full-res RGBA canvas which then flows through the
  // identical edit/export pipeline. EXIF is mapped from LibRaw's metadata.
  if (isRaw(file)) {
    let decoded;
    try {
      decoded = await decodeRaw(file);
    } catch {
      throw new Error(
        `Could not decode ${file.name}. It may be an unsupported or corrupt RAW file.`,
      );
    }
    const { canvas: element, width: w, height: h, exif } = decoded;
    const scale = Math.min(1, MAX_PREVIEW / Math.max(w, h));
    const pw = Math.max(1, Math.round(w * scale));
    const ph = Math.max(1, Math.round(h * scale));
    const preview = document.createElement('canvas');
    preview.width = pw;
    preview.height = ph;
    preview.getContext('2d')!.drawImage(element, 0, 0, pw, ph);
    return { element, preview, name: file.name, width: w, height: h, fileSize: file.size, exif };
  }

  const urls: string[] = [];
  const objectUrl = (blob: Blob) => {
    const u = URL.createObjectURL(blob);
    urls.push(u);
    return u;
  };

  try {
    let element: HTMLImageElement;
    try {
      element = await decodeImage(objectUrl(file));
    } catch {
      if (!isHeic(file)) {
        throw new Error(
          `Could not decode ${file.name}. Supported formats: JPEG, PNG, WebP, HEIC.`,
        );
      }
      // Native decode failed on a HEIC — convert to JPEG in the browser.
      const heic2any = (await import('heic2any')).default;
      const converted = (await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.94,
      })) as Blob;
      element = await decodeImage(objectUrl(converted));
    }

    const { naturalWidth: w, naturalHeight: h } = element;
    const scale = Math.min(1, MAX_PREVIEW / Math.max(w, h));
    const pw = Math.max(1, Math.round(w * scale));
    const ph = Math.max(1, Math.round(h * scale));
    const preview = document.createElement('canvas');
    preview.width = pw;
    preview.height = ph;
    const ctx = preview.getContext('2d')!;
    ctx.drawImage(element, 0, 0, pw, ph);

    // EXIF lives in JPEG APP1; other formats simply yield null.
    let exif: ExifData | null = null;
    if (file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name)) {
      try {
        exif = parseExif(await file.arrayBuffer());
      } catch {
        exif = null;
      }
    }

    return {
      element,
      preview,
      name: file.name,
      width: w,
      height: h,
      fileSize: file.size,
      exif,
    };
  } finally {
    // Revoke after decode; the <img> element retains its bitmap.
    setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 0);
  }
}
