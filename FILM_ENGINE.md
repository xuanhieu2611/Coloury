# Film-Emulation Engine — roadmap (deferred)

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
