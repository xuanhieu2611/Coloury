@AGENTS.md

# Coloury — project guide for Claude

AI-assisted, Lightroom-style photo editor. Full product spec is in `PRD.md` — read it for feature intent; this file is the working guide for *how the code is built and how to work in it*.

## What this is / current state

- **Built & verified: M1 + M2 (complete)** (PRD §8) — rendering engine (WebGL2 pipeline, live preview, export, all manual panels + histogram + undo/redo) **plus** M2: presets, before/after split-slider, crop/transform, **and** the §4.2 stretch controls (Clarity, Texture, Noise Reduction, Sharpen radius, Vignette midpoint/feather, Grain size). Straighten now auto-insets (no clamped-edge corners).
- **Built & verified: M3 (AI Auto Edit) — with M4's §4.3 UX** — real `claude-sonnet-5` vision call via a server route; style/intent input, "what changed" explanation, and re-roll ("Try another style" + cached looks). See the M3 notes below. Verified end-to-end with a live key: "warm and moody" returned a coherent grade (temperature +25, lowered exposure/highlights, deepened shadows, split-tone + vignette), the explanation matched the numbers, sliders moved, the WebGL center pixel shifted warm+dark, and undo reverted both pixels and sliders.
- **Not built yet:** rest of M4 polish (perf tuning), M5.
- **AI plan (done):** the Auto Edit uses a **real Anthropic vision call**, not a stub, exactly as the user wanted.

## Architecture (the one thing to understand first)

The **`EditRecipe`** (JSON, `src/lib/recipe.ts`) is the single source of truth. Nothing is baked into pixels until export. Everything flows one direction:

```
UI slider / (future) AI  →  update EditRecipe in Zustand store  →  WebGL renderer re-runs the shader  →  canvas
```

This means: **the AI integration (M3) does not touch the pipeline.** The vision model just returns an `EditRecipe`; validate it, clamp to `PARAM_RANGE`, drop it into the store. Keep `recipe.ts` as the exact contract the model must satisfy — if you change the schema, change the AI prompt and the shader together.

### File map
| File | Role |
|---|---|
| `src/lib/recipe.ts` | `EditRecipe` type, `defaultRecipe()`, `PARAM_RANGE` (now carries per-param `default`), HSL band definitions, `Crop` type + `defaultCrop`/`isIdentityCrop`, `clamp`/`cloneRecipe`, `normalizeRecipe` (merge partial→complete), **`recipeFromAi(partial)`** (M3 validation: untrusted model JSON → clamped full recipe; ignores curves/crop/garbage). **Single source of truth.** |
| `src/lib/aiEdit.ts` | M3 client side: downscales the preview to a ~1024px JPEG, POSTs to `/api/auto-edit`, and the `AutoEditRequest`/`AutoEditResult` contract. No API key in the browser. |
| `src/app/api/auto-edit/route.ts` | M3 backend (Next route handler): real `claude-sonnet-5` vision call. System prompt + JSON schema are **generated from `PARAM_RANGE`/`HSL_BANDS`** so they can't drift from the contract; parses the model JSON, runs it through `recipeFromAi`, returns `{recipe, explanation}`. Reads `process.env.ANTHROPIC_API_KEY`. |
| `src/lib/crop.ts` | Crop geometry: `computeCropTransform()` turns `recipe.crop` into an affine sampling map (`origin`,`u`,`v`) + output dims; `ASPECT_PRESETS`. |
| `src/lib/presets.ts` | `Preset` type, 4 built-in starters, localStorage load/save/delete for user presets. |
| `src/lib/gl/shaders.ts` | GLSL ES 3.00 vertex + fragment. Pipeline is **10 stages in PRD §5.2 order**, each its own function; `main()` composes them. |
| `src/lib/gl/renderer.ts` | `Renderer` class (WebGL2, uniforms, curve LUT texture) + `exportImage()` (full-res offscreen render). |
| `src/lib/curves.ts` | Control points → 256-entry LUT (monotone cubic), composed into an RGBA texture. |
| `src/lib/store.ts` | Zustand store: image, recipe, undo/redo history, image decode + preview downscale. |
| `src/lib/histogram.ts` | Separate store + 64-bin compute for the live histogram. |
| `src/components/` | `Uploader`, `EditorCanvas`, `Panels`, `Slider`, `CurveEditor`, `Histogram`, `Toolbar`, `Presets`, `CropOverlay` (crop rect + handles), `CropBar` (aspect/straighten/rotate toolbar), `AutoEdit` (M3 panel at top of side-col: intent input, Auto Edit / re-roll, explanation, cached looks). |
| `src/app/{page,layout}.tsx`, `globals.css` | Shell + Tailwind v4 theme (`@theme` tokens in `globals.css`). Shared button/chip class strings in `src/lib/ui.ts`. Residual CSS only for range thumbs + crop-handle `::after`. |

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
- **[preference] Tailwind v4 + existing dark tokens.** Lightroom-style dark theme lives in `@theme` (`globals.css`); use utilities in components. Shared patterns (`btn`, `btnPrimary`, …) live in `src/lib/ui.ts`. Keep residual CSS only for things utilities can't express (range thumbs, crop-handle `::after`).
- **[preference] Recipe stays the contract.** Any new adjustment = add to `EditRecipe` + `PARAM_RANGE` + a shader stage + a Panel control, in that mental order. Don't add UI-only edits that bypass the recipe.
- **[M2, verified] Crop/transform lives in `recipe.crop` as geometry, applied as an affine sampling transform — never a second pass.** `computeCropTransform` (crop.ts) maps output→source as `sUv = uSampO + vUv.x*uSampU + vUv.y*uSampV`; the renderer resizes the drawing buffer to the crop's output dims each `render()` and sets those 3 uniforms. Straighten rotates **about the image center** so a CSS `rotate()` on the canvas (transform-origin = center) is a truthful live preview. Orientation (90° turns) = rotate the output-op square + swap out dims. Verified: 1:1→600×600, one 90° turn→dims swap, export carries crop to full res (600×800 file).
- **[M2, gotcha] Once crop sampling exists, every `uImage` read must use the mapped source coord, not `vUv`.** The fragment sets a global `gSrc` in `main()`; `sharpen()` samples `gSrc ± uTexel` (source space). `vignette`/`grain` intentionally stay in `vUv` (output/framing space). Miss this and sharpen samples the wrong pixels under a crop.
- **[M2, decision] Before/after keeps the crop framing.** `render(recipe, bypass, split)` computes geometry from the *real* `recipe.crop` for both passes and only zeroes the color params for the original — so the split slider / hold-to-compare don't make the frame jump. Split is done with a GL **scissor** re-draw of the original into the left region (single canvas, one frame), divider measured against the canvas element box (aspect-preserved, no letterbox).
- **[M2, gotcha] Crop edits use the Slider drag/commit history pattern.** `applyCrop(mut, false)` during a handle drag (sets `pending`), `commit()` on release; discrete ops (rotate/aspect/reset) do `update(mut,false)` then `commit()` for one undo step. Verified undo/redo moves the crop dims.
- **[M2] Presets = named `EditRecipe`s.** Applying one is just `setRecipe(cloneRecipe(preset.recipe))` (commits history). Built-ins in code, user presets in `localStorage` (`coloury.presets.v1`), hydrated after mount (client-only). B&W preset verified via pixels (R=G=B). `loadUserPresets` runs each through `normalizeRecipe` so presets saved before a field existed stay complete — **use `normalizeRecipe` for the M3 AI's partial recipe too.**
- **[M2, verified] §4.2 stretch controls added.** Recipe fields: `clarity`,`texture` (Presence), `sharpenRadius`,`noiseReduction` (Detail), `vignetteMidpoint`,`vignetteFeather`,`grainSize` (Effects). Some have **non-zero defaults** (sharpenRadius 1, vignette mid/feather 50, grainSize 25) — `PARAM_RANGE[k].default` drives the Slider's double-click reset and the section Reset; `ScalarSlider` reads it. Shader: clarity/texture/denoise/sharpen all share one `srcBlur(radPx)` source-neighborhood helper (samples `gSrc`, not `vUv`); clarity is midtone-masked large-radius luma highpass, denoise pulls toward the blur, sharpen radius scales the kernel.
- **[M2, verified] Straighten auto-insets so corners never sample outside the image** (`fitScale` in crop.ts): shrink the rect about its center until all 4 rotated corners fit in [0,1], scaling output dims by the same factor. Verified: 400²+15° → 327² output, corner regions have real detail (variance ~4100, zero black) — no letterbox, no clamped-edge smear. Identity/1:1/edge crops give scale 1 (no unwanted shrink). Note: the live CSS-rotate preview shows the *un-inset* rect, so the framing tightens slightly on Done — acceptable.
- **[rule, verify] Spatial ops need a high-frequency test image.** Clarity/texture/sharpen/noise produce ~0 highpass on a smooth gradient, so they can't be verified on `test.jpg`. Generate a checkerboard+noise PNG (see `.playwright-mcp/checker.png`, made with Python PIL) and assert on **central-region luminance variance**: texture/clarity/sharpen raise it, noise reduction lowers it (and restores to the exact baseline when zeroed). Vignette params verified via a mid-radius band's mean.
- **[M3, decision] The AI never touches the pipeline — it only returns a recipe.** Flow: `AutoEdit` → `requestAutoEdit` (downscale to ~1024px JPEG) → `POST /api/auto-edit` → real `claude-sonnet-5` vision call → parse JSON → **`recipeFromAi` clamps/validates** → `setRecipe(recipe)` (commits to undo history, so the AI edit is fully editable + undoable like any manual edit). Model config: `claude-sonnet-5`, adaptive thinking, effort `medium`, non-streaming, `max_tokens` 8000. Auth: `ANTHROPIC_API_KEY` in `.env.local` (gitignored), read server-side only.
- **[M3, rule] `recipeFromAi` is the trust boundary — the model output is untrusted.** It starts from `defaultRecipe()`, copies only recognized finite numbers (clamped to `PARAM_RANGE`/band ranges), deep-merges partial HSL bands (so a band with only `saturation` keeps default hue/luminance — **not** NaN, which `normalizeRecipe`'s shallow band merge would have produced), and **ignores curves + crop entirely** (a bad curve/crop is far more destructive than a clamped slider). Malformed/`null`/string input → full default (no-op, never a crash). Verified with 18 node assertions (out-of-range clamp, garbage ignored, partial band, split-tone ranges, curves/crop dropped).
- **[M3, rule] Prompt schema is generated from `PARAM_RANGE`/`HSL_BANDS`, not hand-written.** `scalarRangeLines()` in the route builds the schema/ranges block from the contract so the prompt can't silently drift when a param is added. If you add an AI-controllable field: add it to `PROMPTED_KEYS` (route) **and** `AI_SCALAR_KEYS` (recipe.ts) — the prompt and the validator must agree.
- **[M3, verified] Proven end-to-end with a live key.** build + typecheck clean; `recipeFromAi` unit tests (18/18); running app with a real `ANTHROPIC_API_KEY` — `AutoEdit` downscales+base64-encodes the image (~28KB), POSTs `{image, mediaType, style}`, the `claude-sonnet-5` call returns a coherent recipe + matching explanation, sliders move, the WebGL center pixel shifts (edited `[104,95,41]` warm+dark vs original `[127,127,57]`), and ⌘Z reverts both pixels and sliders (recipe is on the undo stack via `setRecipe`). The empty-key path surfaces the exact "not configured" error. Note the model correctly identified `test.jpg` as a synthetic gradient — proof the image reached the vision model.
- **[preference, UI] Coloury visual language = colorist's desk, not generic SaaS.** Keep the Lightroom dark chrome (deep charcoal panels, dense controls, photo-first canvas). Signature is the HSL **spectrum bar** under the Coloury wordmark + empty-state wash (cool left / warm right). Type: **Syne** (brand) + **IBM Plex Sans/Mono** (UI/values) — not Inter, not purple-violet accent packs. Accent stays cool daylight blue (`#6bb3ff`). Prefer SVG icons over emoji; visible `:focus-visible` rings; `prefers-reduced-motion`; stack canvas-over-panels below `md`.
