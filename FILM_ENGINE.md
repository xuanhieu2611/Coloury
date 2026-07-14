# Film-Emulation Engine — roadmap

> **Status: Phase 1 + Phase 2 COMPLETE.** All steps below (overlay scaffold, date
> stamp, light leaks, dust/scratches, borders/frames, and the 3D LUT stage) are
> built and pixel-verified. This file is kept as the design record; the
> "deferred"/"remaining" framing below is historical. Future work: real `.cube`
> LUT uploads, curated leak/dust texture packs, and monetization gating.


The aesthetic direction: make Coloury the app a Pinterest/Instagram teen reaches for
to turn a phone photo into something that looks shot on a vintage digicam, a Canon,
or a Fujifilm — the "aesthetic hot girl" / Tezza look. **Phase 1 shipped** (see
CLAUDE.md); this file is the backlog for the deeper engine work the user explicitly
asked to capture for a future session.

## What already shipped (Phase 1)

- **Engine params** `fade` (lifted matte blacks) and `halation` (warm highlight glow)
  — full recipe → shader → panel → AI wiring, verified with pixels.
- **Filter pack** (`src/lib/filters.ts`): 12 curated looks across 4 categories
  (Digicam / Film / Fuji / Mood), each a named `EditRecipe`.
- **Filter strip UI** (`src/components/Filters.tsx`): category tabs, **live per-filter
  thumbnail previews** (real WebGL render of the user's image), and a **per-filter
  intensity slider** (Tezza-style strength via `lerpRecipe`).

Everything above stays inside the recipe/shader contract — no compositing, no overlays.

## Phase 2 progress

- **✅ Step 1 — overlay compositing scaffold (the enabler): built & verified.**
  `recipe.overlays` is now a first-class recipe section (`src/lib/recipe.ts`:
  `Overlays`/`DateStamp`, `defaultOverlays()`), backward-compatible through
  `normalizeRecipe` (deep-merges the date stamp) and ignored by `recipeFromAi`
  (overlays are a manual framing tool, not AI-graded). Chosen implementation is
  **option (a)**: a CSS/2D overlay canvas layered over the WebGL canvas for live
  preview (`EditorCanvas`), and **export-time canvas-2D compositing** in
  `exportImage` (draws the GL result onto a 2D canvas at full output dims, then
  `drawOverlays`). Shared draw path lives in `src/lib/overlays.ts` so preview ==
  export. Filters preserve `overlays` like they preserve `crop`.
- **✅ Step 2 — date stamp: built & verified.** Vintage-digicam orange
  `'YY MM DD` timestamp, drawn from **7-segment glyphs** (no bundled font, scales
  to any export size). Params under `recipe.overlays.dateStamp`: `enabled`,
  `corner` (tl/tr/bl/br), `text` (literal chars, auto-filled from EXIF
  `DateTimeOriginal` or today on first enable), `color` (classic amber `#ff7a1a`),
  `size`. UI: a new **Overlays** panel section (`Panels.tsx` `DateStampSection`).
  Verified with pixels: overlay canvas draws ~4966 amber `[255,118,25]` pixels
  anchored to the chosen corner (moves tl↔br correctly); the exported JPEG carries
  1239 tight-LED-amber pixels in the right corner (0 elsewhere — the warm gradient
  is excluded by a strict threshold); undo reverts overlay edits (they're on the
  history stack); build + typecheck clean.

- **✅ Step 3 — light leaks + dust/scratches: built & verified.** Both
  procedural (no binary assets), deterministic (fixed-seed PRNG so preview ==
  export). Light leak = an edge/corner radial gradient (warm/red/golden) screen-
  blended over the image (`recipe.overlays.lightLeak = {enabled,type,position,
  strength}`); verified warm pixels appear at the chosen edge. Dust = dark specks
  (`multiply`) + near-vertical bright scratches (`screen`), density via
  `recipe.overlays.dust = {enabled,amount}`; verified specks/scratches render.
- **✅ Step 4 — borders/frames: built & verified.** `recipe.overlays.border =
  {style,size}` with styles `white`/`black`/`film`(sprocket holes)/`polaroid`
  (thick bottom lip). The output canvas **EXPANDS** around the image (nothing
  cropped) — decided per the doc's open question. `computeFrame()` returns the
  expanded dims + image region; `composeOverlays()` draws frame bg + sprockets +
  image + overlays. Preview composites onto the overlay canvas (GL canvas hidden
  beneath); export composites onto a 2D canvas (no `MAX_TEXTURE_SIZE` limit, so
  frame padding can't hit the GPU cap). Verified: Polaroid preview & export both
  1296×1002 off-white; film 1296×944 with sprocket-hole pixels on the bar.
- **✅ Step 5 — 3D LUT film-sim stage: built & verified.** A real LUT stage in the
  shader (`applyLut`, after split-tone, before effects) sampling a **tiled 2D LUT
  texture** (N=17 cube, N slices across, trilinear = bilinear-in-slice + blue
  lerp) on `TEXTURE2`, blended by `recipe.lut = {id, amount}`. LUTs are
  **self-authored & procedurally generated** into the texture (`src/lib/lut.ts` —
  none/Kodak Warm/Teal·Orange/B&W Film/Faded Retro); no proprietary `.cube` files
  (licensing). Texture rebuilt only on id change. Verified: B&W → center pixel
  R=G=B `[95,95,95]`; teal-orange shifts blue +7, Kodak warms red +12; `none` and
  amount 0 are no-ops. Swap `TRANSFORMS`/data source for real `.cube` later
  without touching the shader.

**All Phase 2 steps complete.** Text below is the original design spec, retained
for reference.

## Phase 2 — the deferred work (user picked ALL of these)

The user selected date stamp, light leaks & halation overlays, and dust/scratches/borders.
These need a **compositing layer that overlays sit on top of the WebGL output**, plus a
**3D LUT stage** for authentic film sims. This is the architectural jump: today nothing
exists above the single shader pass.

### 1. Overlay compositing layer (the enabler)

- Add an `overlays` section to `EditRecipe` (new top-level, e.g. `recipe.overlays`).
  Keep it optional so `normalizeRecipe`/`recipeFromAi` stay backward-compatible.
- Two viable implementations:
  - **(a) DOM/CSS overlay** over the canvas for live preview + **canvas 2D compositing
    at export** (`exportImage` draws the WebGL result onto a 2D canvas, then blends
    overlay assets). Simplest; keeps overlays out of GLSL.
  - **(b) Second GL pass**: render base to an FBO/texture, then a compositing shader
    blends overlay textures. More powerful (blend modes, warping) but more code.
  - **Recommendation:** start with (a) — export-time 2D compositing + a CSS preview —
    because overlays are framing/texture, not per-pixel color math.
- Export must composite overlays at full resolution and **scale overlay assets to the
  output dims** (respect the M4 `planExport` source-scale so nothing breaks the GPU cap).

### 2. Date stamp (highest teen-appeal / lowest effort)

- The orange 7-segment `'YY MM DD` corner timestamp = the whole "vintage digicam" signal.
- Pure canvas 2D text — no external asset. Params: `enabled`, `corner`, `date` (default
  = EXIF `DateTimeOriginal` when present, else today), `color` (classic amber `#ff7a1a`),
  `size`. Render with a 7-segment / LCD-style font (bundle a small woff2, or draw segments).
- Ship this **first** in Phase 2 — it's self-contained and the biggest hook.

### 3. Light leaks & halation overlays

- Halation already exists as a *shader* effect; the overlay version is a **soft warm
  gradient/streak asset** blended `screen`/`lighten` over a frame edge or corner.
- Light leaks: a small set of hand-made or procedurally-generated RGBA gradients
  (warm reds/oranges, edge-anchored). Params: `type`, `strength`, `position`, `blend`.
- Keep assets tiny and inlineable; generate procedurally where possible to avoid binary
  assets in the repo.

### 4. Dust, scratches & film borders

- **Grain overlay** differs from the current procedural grain: real scanned-dust /
  scratch RGBA textures tiled/rotated over the frame (`multiply` for dust, `screen` for
  scratches). Params: `texture`, `amount`.
- **Borders/frames**: film-frame (sprocket holes), rounded Polaroid, white matte, 4:5
  social crops. This interacts with `recipe.crop`/output dims — the border expands the
  output canvas around the graded image; decide whether the border counts toward the
  requested export long-edge.

### 5. 3D LUT stage (authentic film sims)

- Parametric Fuji/Kodak looks get ~80% there; the last 20% (Classic Chrome's exact hue
  crosstalk, Portra's skin roll-off) is a **3D LUT**.
- Add a LUT stage to the shader: upload a `.cube` LUT as a tiled 2D texture (or WebGL2
  `TEXTURE_3D` / `sampler3D`), tetrahedral or trilinear interpolation, applied as a late
  color stage (after HSL/split-tone, before effects). Add `recipe.lut = { id, amount }`
  with an `amount` blend so it's dialable like intensity.
- Source LUTs: ship a few permissively-licensed / self-authored `.cube` files, or
  generate approximations. **Watch licensing** — do not bundle proprietary film LUTs.

## Ordering suggestion for Phase 2

1. Overlay compositing scaffold (recipe field + export path + CSS preview).
2. **Date stamp** (self-contained, highest impact).
3. Light leaks + dust/scratch textures (share the overlay asset pipeline).
4. Borders/frames (touches crop/output-dims math).
5. 3D LUT stage (separate, shader-side; biggest color-fidelity win).

## Guardrails (carry forward from CLAUDE.md)

- The recipe stays the single contract — overlays and LUT are new **recipe fields**, not
  side channels. Update `normalizeRecipe`, `recipeFromAi` (decide if AI may set them),
  and the AI prompt together.
- Verify by reading pixels / compositing output, not by eyeballing.
- Large-image export: overlay assets and LUT textures must respect `planExport`'s
  GPU-cap source scaling.
- Monetization (Tezza paywall) is intentionally **not** built yet — when it lands,
  gate filter/overlay *packs*, keeping the free set genuinely good.
