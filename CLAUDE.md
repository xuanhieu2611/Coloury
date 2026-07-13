@AGENTS.md

# Coloury — project guide for Claude

AI-assisted, Lightroom-style photo editor. Full product spec is in `PRD.md` — read it for feature intent; this file is the working guide for *how the code is built and how to work in it*.

## What this is / current state

- **Built & verified: M1 + M2 (complete)** (PRD §8) — rendering engine (WebGL2 pipeline, live preview, export, all manual panels + histogram + undo/redo) **plus** M2: presets, before/after split-slider, crop/transform, **and** the §4.2 stretch controls (Clarity, Texture, Noise Reduction, Sharpen radius, Vignette midpoint/feather, Grain size). Straighten now auto-insets (no clamped-edge corners).
- **Not built yet:** M3 (AI Auto Edit), M4/M5.
- **AI plan:** the user wants a **real Anthropic vision call** for Auto Edit (not a stub) when M3 is built.

## Architecture (the one thing to understand first)

The **`EditRecipe`** (JSON, `src/lib/recipe.ts`) is the single source of truth. Nothing is baked into pixels until export. Everything flows one direction:

```
UI slider / (future) AI  →  update EditRecipe in Zustand store  →  WebGL renderer re-runs the shader  →  canvas
```

This means: **the AI integration (M3) does not touch the pipeline.** The vision model just returns an `EditRecipe`; validate it, clamp to `PARAM_RANGE`, drop it into the store. Keep `recipe.ts` as the exact contract the model must satisfy — if you change the schema, change the AI prompt and the shader together.

### File map
| File | Role |
|---|---|
| `src/lib/recipe.ts` | `EditRecipe` type, `defaultRecipe()`, `PARAM_RANGE` (now carries per-param `default`), HSL band definitions, `Crop` type + `defaultCrop`/`isIdentityCrop`, `clamp`/`cloneRecipe`, `normalizeRecipe` (merge partial→complete). **Single source of truth.** |
| `src/lib/crop.ts` | Crop geometry: `computeCropTransform()` turns `recipe.crop` into an affine sampling map (`origin`,`u`,`v`) + output dims; `ASPECT_PRESETS`. |
| `src/lib/presets.ts` | `Preset` type, 4 built-in starters, localStorage load/save/delete for user presets. |
| `src/lib/gl/shaders.ts` | GLSL ES 3.00 vertex + fragment. Pipeline is **10 stages in PRD §5.2 order**, each its own function; `main()` composes them. |
| `src/lib/gl/renderer.ts` | `Renderer` class (WebGL2, uniforms, curve LUT texture) + `exportImage()` (full-res offscreen render). |
| `src/lib/curves.ts` | Control points → 256-entry LUT (monotone cubic), composed into an RGBA texture. |
| `src/lib/store.ts` | Zustand store: image, recipe, undo/redo history, image decode + preview downscale. |
| `src/lib/histogram.ts` | Separate store + 64-bin compute for the live histogram. |
| `src/components/` | `Uploader`, `EditorCanvas`, `Panels`, `Slider`, `CurveEditor`, `Histogram`, `Toolbar`, `Presets`, `CropOverlay` (crop rect + handles), `CropBar` (aspect/straighten/rotate toolbar). |
| `src/app/{page,layout}.tsx`, `editor.css`, `globals.css` | Shell + all styling (custom dark CSS, no Tailwind). |

### Pipeline order (do not reorder without reason — mirrors Lightroom)
white balance → exposure → tone (contrast/highlights/shadows/whites/blacks) → custom curve (LUT) → HSL → vibrance/saturation → split toning → sharpening → vignette → grain.

## Commands
- `npm run dev` — dev server (Next 16 + Turbopack) on :3000.
- `npm run build` — production build (also runs TS). Use to catch build-time issues.
- `npx tsc --noEmit` — typecheck.

## How to verify changes (expected workflow)

**Runtime observation, not tests.** This app's whole surface is pixels + WebGL, so:
1. Start the dev server, drive it in a browser (Playwright MCP).
2. Confirm edits by **reading canvas pixels** via `getImageData`, not by eyeballing — e.g. exposure +3 must ~8× the pixel; saturation −100 must collapse to grayscale (R=G=B).
3. Screenshot for the visual, check the console for errors, test export produces a non-empty Blob.
- Playwright gotcha: file uploads must live **inside the repo root** (e.g. `.playwright-mcp/`), not `/tmp` — uploads from outside allowed roots are denied.

## Lessons / rules — log everything here (per user request)

The user explicitly asked: **log every mistake, rule, or significant preference here** so it isn't repeated. Append to this list whenever something is learned.

- **[bug, fixed] Undo/redo must snapshot the PRE-edit recipe.** First attempt had `commit()` push the *current* (post-edit) recipe, so undo after a slider drag was a no-op. Fix: the store captures a `pending` snapshot on the first uncommitted (`commit=false`) edit of a drag, and `commit()` pushes *that*. Slider/curve pattern: fire `update(mut, false)` during drag, `commit()` on release. If you touch history, re-verify undo→redo actually moves pixels.
- **[rule] Verify by observation, every non-trivial change.** Don't report done from a passing typecheck/build alone — drive the running app and read pixels. This is how the undo bug was caught.
- **[gotcha] Next.js 16 is not your training data.** Breaking changes vs. older Next. Read `node_modules/next/dist/docs/` before writing Next-specific code (see AGENTS.md).
- **[gotcha] Project dir is `Coloury` (capital C).** npm rejects capitals in package names, so `create-next-app .` fails; the package name in `package.json` is lowercase `coloury`. Scaffold into a temp lowercase dir and move if re-scaffolding.
- **[preference] Custom dark CSS, no Tailwind.** Match the existing Lightroom-style dark theme in `editor.css` (CSS variables in `globals.css`).
- **[preference] Recipe stays the contract.** Any new adjustment = add to `EditRecipe` + `PARAM_RANGE` + a shader stage + a Panel control, in that mental order. Don't add UI-only edits that bypass the recipe.
- **[M2, verified] Crop/transform lives in `recipe.crop` as geometry, applied as an affine sampling transform — never a second pass.** `computeCropTransform` (crop.ts) maps output→source as `sUv = uSampO + vUv.x*uSampU + vUv.y*uSampV`; the renderer resizes the drawing buffer to the crop's output dims each `render()` and sets those 3 uniforms. Straighten rotates **about the image center** so a CSS `rotate()` on the canvas (transform-origin = center) is a truthful live preview. Orientation (90° turns) = rotate the output-op square + swap out dims. Verified: 1:1→600×600, one 90° turn→dims swap, export carries crop to full res (600×800 file).
- **[M2, gotcha] Once crop sampling exists, every `uImage` read must use the mapped source coord, not `vUv`.** The fragment sets a global `gSrc` in `main()`; `sharpen()` samples `gSrc ± uTexel` (source space). `vignette`/`grain` intentionally stay in `vUv` (output/framing space). Miss this and sharpen samples the wrong pixels under a crop.
- **[M2, decision] Before/after keeps the crop framing.** `render(recipe, bypass, split)` computes geometry from the *real* `recipe.crop` for both passes and only zeroes the color params for the original — so the split slider / hold-to-compare don't make the frame jump. Split is done with a GL **scissor** re-draw of the original into the left region (single canvas, one frame), divider measured against the canvas element box (aspect-preserved, no letterbox).
- **[M2, gotcha] Crop edits use the Slider drag/commit history pattern.** `applyCrop(mut, false)` during a handle drag (sets `pending`), `commit()` on release; discrete ops (rotate/aspect/reset) do `update(mut,false)` then `commit()` for one undo step. Verified undo/redo moves the crop dims.
- **[M2] Presets = named `EditRecipe`s.** Applying one is just `setRecipe(cloneRecipe(preset.recipe))` (commits history). Built-ins in code, user presets in `localStorage` (`coloury.presets.v1`), hydrated after mount (client-only). B&W preset verified via pixels (R=G=B). `loadUserPresets` runs each through `normalizeRecipe` so presets saved before a field existed stay complete — **use `normalizeRecipe` for the M3 AI's partial recipe too.**
- **[M2, verified] §4.2 stretch controls added.** Recipe fields: `clarity`,`texture` (Presence), `sharpenRadius`,`noiseReduction` (Detail), `vignetteMidpoint`,`vignetteFeather`,`grainSize` (Effects). Some have **non-zero defaults** (sharpenRadius 1, vignette mid/feather 50, grainSize 25) — `PARAM_RANGE[k].default` drives the Slider's double-click reset and the section Reset; `ScalarSlider` reads it. Shader: clarity/texture/denoise/sharpen all share one `srcBlur(radPx)` source-neighborhood helper (samples `gSrc`, not `vUv`); clarity is midtone-masked large-radius luma highpass, denoise pulls toward the blur, sharpen radius scales the kernel.
- **[M2, verified] Straighten auto-insets so corners never sample outside the image** (`fitScale` in crop.ts): shrink the rect about its center until all 4 rotated corners fit in [0,1], scaling output dims by the same factor. Verified: 400²+15° → 327² output, corner regions have real detail (variance ~4100, zero black) — no letterbox, no clamped-edge smear. Identity/1:1/edge crops give scale 1 (no unwanted shrink). Note: the live CSS-rotate preview shows the *un-inset* rect, so the framing tightens slightly on Done — acceptable.
- **[rule, verify] Spatial ops need a high-frequency test image.** Clarity/texture/sharpen/noise produce ~0 highpass on a smooth gradient, so they can't be verified on `test.jpg`. Generate a checkerboard+noise PNG (see `.playwright-mcp/checker.png`, made with Python PIL) and assert on **central-region luminance variance**: texture/clarity/sharpen raise it, noise reduction lowers it (and restores to the exact baseline when zeroed). Vignette params verified via a mid-radius band's mean.
