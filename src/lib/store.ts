import { create } from 'zustand';
import { cloneRecipe, defaultRecipe, type EditRecipe } from './recipe';

export interface LoadedImage {
  element: HTMLImageElement; // full-resolution decoded image
  preview: HTMLCanvasElement; // downsampled (<= MAX_PREVIEW) for live editing
  name: string;
  width: number;
  height: number;
  fileSize: number;
}

const MAX_PREVIEW = 2048; // long-edge cap for the live preview (PRD 5.3)
const HISTORY_LIMIT = 100;

interface EditorState {
  image: LoadedImage | null;
  recipe: EditRecipe;
  past: EditRecipe[];
  future: EditRecipe[];
  // Recipe as it was before the current uncommitted (drag) edit sequence began.
  pending: EditRecipe | null;

  setImage: (img: LoadedImage) => void;
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
}

export const useEditor = create<EditorState>((set, get) => ({
  image: null,
  recipe: defaultRecipe(),
  past: [],
  future: [],
  pending: null,

  setImage: (img) =>
    set({ image: img, recipe: defaultRecipe(), past: [], future: [], pending: null }),

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
}));

/**
 * Decode a File into a full-res HTMLImageElement plus a downsampled preview
 * canvas. Handles HEIC gracefully by relying on browser-native decode (Safari)
 * and surfacing a clear error elsewhere.
 */
export async function loadImageFile(file: File): Promise<LoadedImage> {
  const url = URL.createObjectURL(file);
  try {
    const element = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(
          new Error(
            `Could not decode ${file.name}. HEIC may be unsupported in this browser — try JPEG/PNG/WebP.`,
          ),
        );
      img.src = url;
    });

    const { naturalWidth: w, naturalHeight: h } = element;
    const scale = Math.min(1, MAX_PREVIEW / Math.max(w, h));
    const pw = Math.max(1, Math.round(w * scale));
    const ph = Math.max(1, Math.round(h * scale));
    const preview = document.createElement('canvas');
    preview.width = pw;
    preview.height = ph;
    const ctx = preview.getContext('2d')!;
    ctx.drawImage(element, 0, 0, pw, ph);

    return {
      element,
      preview,
      name: file.name,
      width: w,
      height: h,
      fileSize: file.size,
    };
  } finally {
    // Revoke after decode; the <img> element retains its bitmap.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
