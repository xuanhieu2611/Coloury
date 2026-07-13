// Presets (PRD 4.4). A preset is just a named EditRecipe — the recipe stays the
// contract (CLAUDE.md), so applying a preset is nothing more than dropping its
// recipe into the store. Built-in starters ship in code; user presets persist
// in localStorage (PRD 5.5 v1 — client-side, no account).

import { cloneRecipe, defaultRecipe, normalizeRecipe, type EditRecipe } from './recipe';

export interface Preset {
  id: string;
  name: string;
  recipe: EditRecipe;
  builtIn?: boolean;
}

// --- Built-in starter presets ---------------------------------------------
// Each is defaultRecipe() with a few deliberate moves, so they read as small,
// legible diffs rather than opaque blobs.

function make(name: string, tweak: (r: EditRecipe) => void): Preset {
  const recipe = defaultRecipe();
  tweak(recipe);
  return { id: `builtin:${name}`, name, recipe, builtIn: true };
}

export const BUILTIN_PRESETS: Preset[] = [
  make('Neutral', () => {
    // Intentionally the identity recipe — a clean starting point.
  }),
  make('Warm Film', (r) => {
    r.temperature = 22;
    r.tint = 6;
    r.contrast = 12;
    r.highlights = -18;
    r.shadows = 14;
    r.blacks = 8; // lifted blacks = faded-film toe
    r.vibrance = 10;
    r.saturation = -6;
    r.splitToning.highlightHue = 45; // warm highlights
    r.splitToning.highlightSaturation = 18;
    r.splitToning.shadowHue = 30; // warm-brown shadows
    r.splitToning.shadowSaturation = 14;
    r.splitToning.balance = 10;
    r.grain = 22;
    r.vignette = 12;
  }),
  make('Cool Moody', (r) => {
    r.temperature = -20;
    r.tint = -4;
    r.contrast = 18;
    r.highlights = -24;
    r.shadows = 20;
    r.blacks = -14;
    r.whites = -8;
    r.vibrance = -8;
    r.saturation = -14;
    r.splitToning.shadowHue = 220; // teal/blue shadows
    r.splitToning.shadowSaturation = 22;
    r.splitToning.highlightHue = 210;
    r.splitToning.highlightSaturation = 8;
    r.splitToning.balance = -12;
    r.vignette = 24;
  }),
  make('High Contrast B&W', (r) => {
    r.saturation = -100; // full desaturate
    r.contrast = 32;
    r.highlights = -12;
    r.shadows = 10;
    r.whites = 16;
    r.blacks = -18;
    r.grain = 14;
    r.vignette = 16;
  }),
];

// --- User presets (localStorage) ------------------------------------------

const STORAGE_KEY = 'coloury.presets.v1';

function safeParse(raw: string | null): Preset[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Trust but verify: each entry must at least have a recipe shape, and we
    // normalize so presets saved before a field existed stay complete.
    return parsed
      .filter(
        (p): p is Preset =>
          p && typeof p.id === 'string' && typeof p.name === 'string' && p.recipe,
      )
      .map((p) => ({ ...p, recipe: normalizeRecipe(p.recipe) }));
  } catch {
    return [];
  }
}

export function loadUserPresets(): Preset[] {
  if (typeof window === 'undefined') return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

function persist(presets: Preset[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function saveUserPreset(name: string, recipe: EditRecipe): Preset[] {
  const presets = loadUserPresets();
  const preset: Preset = {
    id: `user:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || 'Untitled',
    recipe: cloneRecipe(recipe),
  };
  const next = [...presets, preset];
  persist(next);
  return next;
}

export function deleteUserPreset(id: string): Preset[] {
  const next = loadUserPresets().filter((p) => p.id !== id);
  persist(next);
  return next;
}
