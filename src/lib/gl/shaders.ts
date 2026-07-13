// WebGL2 (GLSL ES 3.00) shaders implementing the render pipeline in the exact
// order of PRD 5.2. Each stage is its own function so the order is explicit and
// individually testable; main() composes them.

export const VERTEX_SHADER = /* glsl */ `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  // Flip Y so the image isn't upside down (textures origin bottom-left).
  vUv = vec2((aPos.x + 1.0) * 0.5, 1.0 - (aPos.y + 1.0) * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uImage;
uniform sampler2D uCurveLut;   // 256x1 RGBA, composed tone curves
uniform vec2  uTexel;          // 1/width, 1/height for spatial ops

// Crop/transform sampling affine: sourceUV = uSampO + vUv.x*uSampU + vUv.y*uSampV
uniform vec2  uSampO;
uniform vec2  uSampU;
uniform vec2  uSampV;

// Source coordinate for the current fragment (set in main from the affine).
vec2 gSrc;

// Basic
uniform float uExposure;       // stops
uniform float uContrast;       // -1..1
uniform float uHighlights;     // -1..1
uniform float uShadows;        // -1..1
uniform float uWhites;         // -1..1
uniform float uBlacks;         // -1..1
uniform float uTemperature;    // -1..1
uniform float uTint;           // -1..1

// Presence
uniform float uVibrance;       // -1..1
uniform float uSaturation;     // -1..1
uniform float uClarity;        // -1..1 (midtone local contrast)
uniform float uTexture;        // -1..1 (fine high-frequency detail)

// Toggles
uniform bool  uUseCurve;

// HSL: 8 bands, each vec3(hueShift, satShift, lumShift) in -1..1
uniform vec3 uHsl[8];

// Split toning
uniform vec3  uSplitShadow;    // rgb tint color
uniform vec3  uSplitHighlight; // rgb tint color
uniform float uSplitShadowAmt;
uniform float uSplitHighlightAmt;
uniform float uSplitBalance;   // -1..1

// Effects / detail
uniform float uSharpen;        // 0..1 (amount)
uniform float uSharpenRadius;  // px radius for the sharpen/texture kernel
uniform float uNoise;          // 0..1 (luminance denoise)
uniform float uVignette;       // -1..1 (amount)
uniform float uVigMid;         // 0..1 (falloff start)
uniform float uVigFeather;     // 0..1 (falloff softness)
uniform float uGrain;          // 0..1 (amount)
uniform float uGrainSize;      // 0..1 (coarseness)
uniform float uSeed;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

float luma(vec3 c) { return dot(c, LUMA); }

// ---- color space helpers ----
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// ---- 1. White balance ----
vec3 whiteBalance(vec3 c) {
  // Temperature warms (R up / B down); tint pushes green<->magenta.
  c.r *= 1.0 + 0.35 * uTemperature;
  c.b *= 1.0 - 0.35 * uTemperature;
  c.g *= 1.0 - 0.20 * uTint;
  c.r *= 1.0 + 0.10 * uTint;
  c.b *= 1.0 + 0.10 * uTint;
  return max(c, 0.0);
}

// ---- 2. Exposure ----
vec3 exposure(vec3 c) {
  return c * pow(2.0, uExposure);
}

// ---- 3. Tone: contrast, highlights, shadows, whites, blacks ----
vec3 tone(vec3 c) {
  // Contrast around mid gray.
  c = (c - 0.5) * (1.0 + uContrast) + 0.5;

  float l = luma(clamp(c, 0.0, 1.0));
  // Region masks.
  float shadowMask    = 1.0 - smoothstep(0.0, 0.5, l);
  float highlightMask = smoothstep(0.5, 1.0, l);
  float blackMask     = 1.0 - smoothstep(0.0, 0.35, l);
  float whiteMask     = smoothstep(0.65, 1.0, l);

  c += uShadows    * 0.5  * shadowMask;
  c += uHighlights * 0.5  * highlightMask;
  c += uBlacks     * 0.35 * blackMask;
  c += uWhites     * 0.35 * whiteMask;
  return c;
}

// ---- 4. Custom tone curve (master + per-channel), via composed LUT ----
vec3 toneCurve(vec3 c) {
  if (!uUseCurve) return c;
  c = clamp(c, 0.0, 1.0);
  float r = texture(uCurveLut, vec2(c.r, 0.5)).r;
  float g = texture(uCurveLut, vec2(c.g, 0.5)).g;
  float b = texture(uCurveLut, vec2(c.b, 0.5)).b;
  return vec3(r, g, b);
}

// ---- 5. HSL per-band adjustments ----
float bandWeight(float hueDeg, float centerDeg) {
  float d = abs(hueDeg - centerDeg);
  d = min(d, 360.0 - d);
  // Smooth falloff over ~45 degrees on each side.
  return 1.0 - smoothstep(0.0, 45.0, d);
}
vec3 hslAdjust(vec3 c) {
  vec3 hsv = rgb2hsv(clamp(c, 0.0, 1.0));
  float hueDeg = hsv.x * 360.0;
  const float centers[8] = float[8](0.0, 30.0, 60.0, 120.0, 180.0, 240.0, 270.0, 300.0);

  float hueShift = 0.0;
  float satShift = 0.0;
  float lumShift = 0.0;
  float totalW = 0.0;
  for (int i = 0; i < 8; i++) {
    float w = bandWeight(hueDeg, centers[i]) * hsv.y; // weight by existing saturation
    hueShift += uHsl[i].x * w;
    satShift += uHsl[i].y * w;
    lumShift += uHsl[i].z * w;
    totalW += w;
  }
  if (totalW > 0.0) {
    hsv.x = fract(hsv.x + (hueShift / max(totalW, 1.0)) * (30.0 / 360.0));
    hsv.y = clamp(hsv.y * (1.0 + satShift / max(totalW, 1.0)), 0.0, 1.0);
    hsv.z = clamp(hsv.z * (1.0 + 0.5 * lumShift / max(totalW, 1.0)), 0.0, 1.0);
  }
  return hsv2rgb(hsv);
}

// ---- 6. Vibrance / saturation ----
vec3 vibranceSaturation(vec3 c) {
  float l = luma(c);
  // Global saturation.
  c = mix(vec3(l), c, 1.0 + uSaturation);
  // Vibrance boosts less-saturated pixels more.
  float sat = max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
  float amt = uVibrance * (1.0 - sat);
  c = mix(vec3(l), c, 1.0 + amt);
  return c;
}

// ---- 7. Split toning / color grading ----
vec3 splitTone(vec3 c) {
  float l = luma(clamp(c, 0.0, 1.0));
  float balance = uSplitBalance * 0.5 + 0.5; // 0..1 pivot
  float shadowW = (1.0 - smoothstep(0.0, balance + 0.001, l)) * uSplitShadowAmt;
  float highW = smoothstep(balance - 0.001, 1.0, l) * uSplitHighlightAmt;
  c += (uSplitShadow - 0.5) * shadowW * 0.5;
  c += (uSplitHighlight - 0.5) * highW * 0.5;
  return c;
}

// Box-ish blur of the SOURCE around gSrc at a given pixel radius (8 taps + center).
vec3 srcBlur(float radPx) {
  vec2 r = uTexel * radPx;
  vec3 sum = texture(uImage, gSrc).rgb * 4.0;
  sum += texture(uImage, gSrc + vec2(-r.x, 0.0)).rgb;
  sum += texture(uImage, gSrc + vec2(r.x, 0.0)).rgb;
  sum += texture(uImage, gSrc + vec2(0.0, -r.y)).rgb;
  sum += texture(uImage, gSrc + vec2(0.0, r.y)).rgb;
  sum += texture(uImage, gSrc + vec2(-r.x, -r.y)).rgb;
  sum += texture(uImage, gSrc + vec2(r.x, -r.y)).rgb;
  sum += texture(uImage, gSrc + vec2(-r.x, r.y)).rgb;
  sum += texture(uImage, gSrc + vec2(r.x, r.y)).rgb;
  return sum / 12.0;
}

// ---- Clarity: midtone local contrast (large-radius luminance unsharp) ----
vec3 clarity(vec3 c) {
  if (uClarity == 0.0) return c;
  vec3 blur = srcBlur(12.0);
  vec3 orig = texture(uImage, gSrc).rgb;
  float hp = luma(orig) - luma(blur);       // local-contrast highpass
  float l = luma(clamp(c, 0.0, 1.0));
  float midMask = 1.0 - abs(l - 0.5) * 2.0;  // strongest in midtones
  midMask = clamp(midMask, 0.0, 1.0);
  return c + hp * uClarity * midMask * 1.5;
}

// ---- Texture: fine high-frequency detail (small-radius unsharp) ----
vec3 textureDetail(vec3 c) {
  if (uTexture == 0.0) return c;
  vec3 blur = srcBlur(1.5);
  vec3 orig = texture(uImage, gSrc).rgb;
  vec3 hp = orig - blur;
  return c + hp * uTexture * 1.5;
}

// ---- Detail: luminance noise reduction (blend toward a source blur) ----
vec3 denoise(vec3 c) {
  if (uNoise <= 0.0) return c;
  vec3 blur = srcBlur(1.5);
  vec3 orig = texture(uImage, gSrc).rgb;
  return c + (blur - orig) * uNoise;         // pull toward the smoothed source
}

// ---- 8. Sharpening (unsharp mask on source neighborhood, radius-scaled) ----
vec3 sharpen(vec3 c) {
  if (uSharpen <= 0.0) return c;
  vec3 blur = srcBlur(uSharpenRadius);
  vec3 orig = texture(uImage, gSrc).rgb;
  vec3 highpass = orig - blur;
  return c + highpass * uSharpen * 2.0;
}

// ---- 9. Vignette (amount + midpoint + feather) ----
vec3 vignette(vec3 c) {
  if (uVignette == 0.0) return c;
  vec2 p = vUv - 0.5;
  float dist = length(p) * 1.41421356; // 0 at center, 1 at corners
  // Midpoint sets where darkening reaches full; feather sets the ramp width.
  float outer = mix(0.35, 1.15, uVigMid);
  float inner = outer - mix(0.06, 0.9, uVigFeather);
  float v = smoothstep(inner, outer, dist);
  c *= 1.0 - v * uVignette;
  return c;
}

// ---- 10. Grain (amount + size) ----
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453);
}
vec3 grain(vec3 c) {
  if (uGrain <= 0.0) return c;
  // Larger size = coarser grain = lower sampling frequency.
  float scale = mix(2200.0, 300.0, uGrainSize);
  float n = hash(vUv * scale) - 0.5;
  return c + n * uGrain * 0.15;
}

void main() {
  // Map the output pixel to a source coordinate (crop / straighten / rotate).
  gSrc = uSampO + vUv.x * uSampU + vUv.y * uSampV;
  vec3 c = texture(uImage, gSrc).rgb;
  c = whiteBalance(c);        // 1
  c = exposure(c);            // 2
  c = tone(c);                // 3
  c = toneCurve(c);           // 4
  c = hslAdjust(c);           // 5
  c = clarity(c);             // 5b (presence: midtone local contrast)
  c = textureDetail(c);       // 5c (presence: fine detail)
  c = vibranceSaturation(c);  // 6
  c = splitTone(c);           // 7
  c = denoise(c);             // 7b (detail: noise reduction, before sharpen)
  c = sharpen(c);             // 8
  c = vignette(c);            // 9
  c = grain(c);               // 10
  fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;
