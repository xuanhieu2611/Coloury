# Product Requirements Document: AI-Assisted Photo Editor

## 1. Overview

### 1.1 Purpose
A web-based photo editor that gives casual users a Lightroom-style editing experience (exposure, curves, HSL, color grading, etc.) combined with an AI "Auto Edit" feature that analyzes a photo and suggests professional-grade adjustments automatically. Users can accept the AI suggestion as-is, or use it as a starting point and fine-tune manually.

### 1.2 Problem Statement
Photographers and casual users often have unedited photos (straight from a camera or phone) that look flat or unbalanced, but lack the skill or time to manually color-grade them the way a professional editor would in Lightroom. This app closes that gap by letting an AI vision model "read" the photo like a photographer would and translate that judgment into concrete, adjustable edit parameters — not by generating a new image, but by computing real edit values applied through a standard non-destructive editing pipeline.

### 1.3 Goals
- Provide a real-time, non-destructive photo editing engine equivalent to Lightroom's core color/tone tools.
- Provide a one-click "AI Auto Edit" that analyzes the photo and proposes a full set of adjustment values.
- Let users fine-tune AI suggestions with the same manual sliders/curves used for manual editing.
- Support exporting edited photos in common formats (JPEG, PNG, and ideally TIFF/WebP).
- Run entirely in the browser for the editing/rendering pipeline (fast, private, no round-trip needed for manual edits).

### 1.4 Non-Goals (out of scope for v1)
- Generative fill / content-aware fill / object removal.
- Background removal or subject segmentation.
- Blemish/wrinkle/skin retouching.
- Batch editing across many photos at once (v2 candidate).
- Mobile native apps (v1 is web only).
- RAW file decoding (v1 supports JPEG/PNG/WebP/HEIC input; RAW is a v2 candidate).

---

## 2. Target User

- Hobbyist photographers and everyday people who take photos on a phone or camera and want them to look better without learning color theory or Lightroom.
- Users who know roughly what "looks good" but don't know which sliders to move to get there.

---

## 3. Core Concepts

### 3.1 Non-Destructive Editing Model
All edits are stored as a **JSON "edit recipe"** — a set of named parameters — never baked into the pixels until export. The original image is preserved; the recipe is applied live in a rendering pipeline (GPU shader) for real-time preview. This is the same model Lightroom uses (XMP sidecar-style edits).

Example edit recipe schema:
```json
{
  "exposure": 0.0,
  "contrast": 0,
  "highlights": 0,
  "shadows": 0,
  "whites": 0,
  "blacks": 0,
  "temperature": 0,
  "tint": 0,
  "vibrance": 0,
  "saturation": 0,
  "curves": {
    "rgb": [[0,0],[255,255]],
    "red": [[0,0],[255,255]],
    "green": [[0,0],[255,255]],
    "blue": [[0,0],[255,255]]
  },
  "hsl": {
    "red":     { "hue": 0, "saturation": 0, "luminance": 0 },
    "orange":  { "hue": 0, "saturation": 0, "luminance": 0 },
    "yellow":  { "hue": 0, "saturation": 0, "luminance": 0 },
    "green":   { "hue": 0, "saturation": 0, "luminance": 0 },
    "aqua":    { "hue": 0, "saturation": 0, "luminance": 0 },
    "blue":    { "hue": 0, "saturation": 0, "luminance": 0 },
    "purple":  { "hue": 0, "saturation": 0, "luminance": 0 },
    "magenta": { "hue": 0, "saturation": 0, "luminance": 0 }
  },
  "splitToning": {
    "shadowHue": 0, "shadowSaturation": 0,
    "highlightHue": 0, "highlightSaturation": 0,
    "balance": 0
  },
  "sharpening": 0,
  "vignette": 0,
  "grain": 0
}
```

### 3.2 AI Auto Edit
A multimodal (vision-capable) model receives the image plus a system prompt instructing it to act like a professional photo editor and return an edit recipe in the schema above (strict JSON output, matching section 3.1). The app applies that recipe through the same rendering pipeline used for manual edits — the AI never touches pixels directly, it only proposes parameter values. This guarantees:
- AI edits are just a starting point in the same editable format as manual edits.
- No unpredictable AI-generated pixels — output is fully deterministic given the recipe.
- Users can see exactly which sliders changed and why (see 4.3).

---

## 4. Functional Requirements

### 4.1 Import
- Drag-and-drop or file picker upload.
- Supported formats: JPEG, PNG, WebP, HEIC (convert HEIC client-side or server-side on upload).
- Show original image dimensions, file size, and EXIF data (camera, lens, exposure settings) if present.

### 4.2 Manual Editing Panel
Organized into collapsible sections, mirroring Lightroom's Develop module:

| Section | Controls |
|---|---|
| Basic | Exposure, Contrast, Highlights, Shadows, Whites, Blacks, Temperature, Tint |
| Presence | Vibrance, Saturation, Clarity/Texture (optional stretch), Sharpening |
| Tone Curve | RGB curve + separate R/G/B channel curves, draggable control points |
| Color (HSL) | 8-channel Hue/Saturation/Luminance sliders (red, orange, yellow, green, aqua, blue, purple, magenta) |
| Split Toning / Color Grading | Shadow/highlight hue+saturation, balance slider |
| Detail | Sharpening amount/radius, noise reduction (basic) |
| Effects | Vignette (amount, midpoint, feather), Grain (amount, size) |
| Crop & Transform | Crop, straighten/rotate, aspect ratio presets |

- All sliders update the live preview in real time (target: <50ms perceived latency on typical images).
- Reset button per section and global "Reset All."
- Before/After toggle (press-and-hold or split-screen slider).

### 4.3 AI Auto Edit
- "Auto Edit" button, prominently placed.
- On click: image is sent to the backend, which calls the vision model; response is parsed into an edit recipe and applied to the sliders/curves.
- Show a brief "what changed" summary (e.g., "Increased shadows +15, warmed temperature +8, boosted blue saturation +12") — a plain-language explanation generated alongside the JSON, so non-experts understand what happened and can learn from it.
- Optional style/intent input before running Auto Edit: user can type a short preference (e.g., "warmer and moodier," "bright and airy," "natural, minimal edit") which is passed into the model prompt to steer the suggested recipe.
- Auto Edit result lands directly in the manual sliders — fully editable afterward. Nothing is locked.
- Allow re-rolling: "Try another style" regenerates a different recipe/interpretation.

### 4.4 Presets
- Save current edit recipe as a named preset.
- Apply saved presets to other photos.
- A small set of built-in starter presets (e.g., "Neutral," "Warm Film," "Cool Moody," "High Contrast B&W") for users who want a manual starting point without AI.

### 4.5 Export
- Export as JPEG (quality slider), PNG, WebP.
- Choose export resolution (original / custom).
- Export applies the current edit recipe to the full-resolution original (not the downsampled preview) — see 5.3.

### 4.6 History / Undo
- Standard undo/redo stack for all edits (manual and AI-applied).
- Non-destructive: user can always return to the original unedited image.

---

## 5. Technical Architecture

### 5.1 High-Level Stack
- **Frontend**: React + TypeScript, Vite or Next.js.
- **Rendering engine**: WebGL (via GLSL fragment shaders) or WebGPU where available, for real-time application of exposure/curves/HSL/etc. to the image. Canvas 2D is not sufficient for real-time HSL/curve performance at full resolution — GPU shaders are required for a responsive feel.
- **State management**: the edit recipe (JSON) is the single source of truth; React state (e.g., Zustand or Redux) holds it, and the renderer re-runs the shader pipeline whenever it changes.
- **Backend**: Node.js/Express (or serverless functions) — needed only for: (a) proxying the AI vision model call (keep API keys server-side), (b) optional HEIC conversion, (c) optional cloud storage for saved projects/presets.
- **AI integration**: Anthropic API call (Claude with vision) from the backend, using a structured-JSON-output prompt (see 3.2). See implementation note in 5.4.

### 5.2 Rendering Pipeline (order of operations matters — mirrors Lightroom's actual pipeline)
1. White balance (temperature/tint)
2. Exposure
3. Tone (contrast, highlights, shadows, whites, blacks) — typically via a parametric tone curve
4. Custom tone curve (RGB + per-channel)
5. HSL adjustments (per 8-color-band hue/sat/luminance shifts)
6. Vibrance/saturation
7. Split toning / color grading
8. Sharpening
9. Vignette
10. Grain

Each step should be implemented as a composable shader stage so the order is explicit and testable.

### 5.3 Preview vs. Export Resolution
- Live preview renders a downsampled version of the image (e.g., max 2048px long edge) for performance.
- Export re-runs the identical shader pipeline against the full-resolution original image using the final edit recipe, ensuring preview and export are visually identical, just at different resolutions.

### 5.4 AI Model Integration Details
- Send the (downsampled, e.g., 1024px) image + a system prompt to a vision-capable Claude model via the Anthropic API.
- System prompt instructs the model to act as a professional photo editor and to respond with **only** a JSON object matching the edit recipe schema (3.1), no prose — enables direct parsing.
- Backend validates the JSON against the schema (reject/retry on malformed output, clamp values to valid ranges) before returning it to the frontend.
- Optionally request a second short text field (`explanation`) alongside the JSON for the "what changed" summary in 4.3 — either as a second field in the same JSON object, or a second lightweight follow-up call.
- Cache/store the last N auto-edit results client-side so "Try another style" doesn't always require a fresh network round trip if the user just wants to compare.

### 5.5 Data & Storage
- v1: edits and presets can be stored client-side (localStorage/IndexedDB) with no account system required.
- v2 candidate: user accounts + cloud storage for projects, presets, and history across devices.

---

## 6. UX / Design Notes
- Split-view layout: image canvas on left/center (majority of screen), collapsible adjustment panel on right — standard Lightroom-like layout.
- Sliders should show numeric values and support keyboard fine-tuning (arrow keys) in addition to drag.
- Histogram displayed above the Basic panel, updating live.
- Before/after comparison should be a single keypress or hold-to-compare, not just a static split.
- Loading state on Auto Edit should feel purposeful (e.g., "Analyzing light and color…") since the AI call takes a few seconds.

---

## 7. Success Metrics
- % of uploaded photos where user clicks "Auto Edit" at least once.
- % of Auto Edit results exported without further manual changes (signals AI quality).
- Average number of manual slider adjustments after Auto Edit (lower over time signals AI improving or users trusting it more).
- Time from upload to export (efficiency).
- Retention: % of users who return to edit a second photo.

---

## 8. Milestones (Suggested Build Order)

1. **M1 — Core rendering engine**: Upload image, implement GPU shader pipeline for exposure/contrast/HSL/curves, live preview, export. No AI yet.
2. **M2 — Full manual editing UI**: All panels from 4.2, histogram, before/after, undo/redo, presets.
3. **M3 — AI Auto Edit integration**: Backend endpoint, prompt design, JSON schema validation, wiring results into the existing slider state from M2.
4. **M4 — Polish**: Style/intent input for Auto Edit, "what changed" explanations, re-roll, built-in presets, performance tuning for large images.
5. **M5 (stretch)**: Accounts/cloud storage, batch editing, RAW support.

---

## 9. Open Questions
- Should Auto Edit offer multiple style variants at once (e.g., 3 thumbnails to choose from) instead of one recipe per click?
- What's the max input image resolution/file size to support, and how should very large files (e.g., 50MP) be handled for performance?
- Should there be a limit/quota on AI Auto Edit calls per user (cost control), and if so, should manual editing remain fully unlimited regardless?
