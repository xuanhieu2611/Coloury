// Client side of the AI Auto Edit feature (PRD 4.3 / M3). The heavy lifting —
// the Anthropic vision call — happens server-side in /api/auto-edit so the API
// key never reaches the browser. This module only downsizes the image and
// speaks the request/response contract.

import type { EditRecipe } from './recipe';

// Long-edge cap for the image we send to the model (PRD 5.4 suggests ~1024px).
// The model judges tone/color, not fine detail, so a small JPEG is plenty and
// keeps the upload — and the vision token cost — low.
const AI_MAX_EDGE = 1024;
const AI_JPEG_QUALITY = 0.85;

export interface AutoEditRequest {
  image: string; // base64 JPEG, no data: prefix
  mediaType: 'image/jpeg';
  style?: string; // optional user intent, e.g. "warmer and moodier"
  reroll?: boolean; // "try another style" — nudge the model to a fresh take
}

export interface AutoEditResult {
  recipe: EditRecipe; // already validated + clamped server-side
  explanation: string; // plain-language "what changed" summary
  style?: string; // echoes the intent this result was generated for
}

// Downscale the (already preview-sized) canvas to a small JPEG for the model.
function encodeForModel(preview: HTMLCanvasElement): string {
  const { width: w, height: h } = preview;
  const scale = Math.min(1, AI_MAX_EDGE / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));

  let source: HTMLCanvasElement = preview;
  if (scale < 1) {
    const small = document.createElement('canvas');
    small.width = tw;
    small.height = th;
    const ctx = small.getContext('2d')!;
    ctx.drawImage(preview, 0, 0, tw, th);
    source = small;
  }

  const dataUrl = source.toDataURL('image/jpeg', AI_JPEG_QUALITY);
  return dataUrl.slice(dataUrl.indexOf(',') + 1); // strip "data:image/jpeg;base64,"
}

/**
 * Ask the backend to analyze the photo and return a full edit recipe plus a
 * plain-language summary. Throws with a user-readable message on failure.
 */
export async function requestAutoEdit(
  preview: HTMLCanvasElement,
  opts: { style?: string; reroll?: boolean } = {},
): Promise<AutoEditResult> {
  const body: AutoEditRequest = {
    image: encodeForModel(preview),
    mediaType: 'image/jpeg',
    style: opts.style?.trim() || undefined,
    reroll: opts.reroll,
  };

  const res = await fetch('/api/auto-edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as Partial<AutoEditResult> & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || `Auto Edit failed (${res.status}).`);
  }
  if (!data.recipe) {
    throw new Error('Auto Edit returned an unexpected response.');
  }
  return { recipe: data.recipe, explanation: data.explanation ?? '', style: opts.style?.trim() };
}
