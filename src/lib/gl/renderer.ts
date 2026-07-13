import { VERTEX_SHADER, FRAGMENT_SHADER } from './shaders';
import { buildCurveTextureData, isIdentityCurves } from '../curves';
import { HSL_BANDS, type EditRecipe } from '../recipe';
import { computeCropTransform, identityTransform } from '../crop';

// Convert an HSV (h in degrees) to RGB for split-tone tint colors, matching
// the shader's hsv2rgb so tinting is consistent.
function hsvToRgb(hDeg: number, s: number, v: number): [number, number, number] {
  const h = ((hDeg % 360) + 360) % 360 / 60;
  const c = v * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = v - c;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 1) [r, g, b] = [c, x, 0];
  else if (h < 2) [r, g, b] = [x, c, 0];
  else if (h < 3) [r, g, b] = [0, c, x];
  else if (h < 4) [r, g, b] = [0, x, c];
  else if (h < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [r + m, g + m, b + m];
}

export type ImageSource = TexImageSource & { width: number; height: number };

/**
 * WebGL2 renderer that applies an EditRecipe to an image through the shader
 * pipeline. One instance owns a canvas + GL context; used both for the live
 * preview (downsampled) and for full-res export.
 */
export class Renderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private imageTex: WebGLTexture;
  private curveTex: WebGLTexture;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private imgWidth = 1;
  private imgHeight = 1;
  private seed = Math.random() * 1000;

  constructor(private canvas: HTMLCanvasElement | OffscreenCanvas) {
    const gl = (canvas as HTMLCanvasElement).getContext('webgl2', {
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
    }) as WebGL2RenderingContext | null;
    if (!gl) throw new Error('WebGL2 is not supported in this browser.');
    this.gl = gl;

    this.program = this.createProgram(VERTEX_SHADER, FRAGMENT_SHADER);
    gl.useProgram(this.program);

    // Fullscreen quad.
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(this.program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    this.imageTex = gl.createTexture()!;
    this.curveTex = gl.createTexture()!;
    this.cacheUniformLocations();
  }

  private createProgram(vsSrc: string, fsSrc: string): WebGLProgram {
    const gl = this.gl;
    const compile = (type: number, src: string): WebGLShader => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh);
        gl.deleteShader(sh);
        throw new Error('Shader compile error: ' + log);
      }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, vsSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Program link error: ' + gl.getProgramInfoLog(program));
    }
    return program;
  }

  private cacheUniformLocations() {
    const gl = this.gl;
    const names = [
      'uImage',
      'uCurveLut',
      'uTexel',
      'uExposure',
      'uContrast',
      'uHighlights',
      'uShadows',
      'uWhites',
      'uBlacks',
      'uTemperature',
      'uTint',
      'uVibrance',
      'uSaturation',
      'uClarity',
      'uTexture',
      'uUseCurve',
      'uHsl[0]',
      'uSplitShadow',
      'uSplitHighlight',
      'uSplitShadowAmt',
      'uSplitHighlightAmt',
      'uSplitBalance',
      'uSharpen',
      'uSharpenRadius',
      'uNoise',
      'uVignette',
      'uVigMid',
      'uVigFeather',
      'uGrain',
      'uGrainSize',
      'uFade',
      'uHalation',
      'uSeed',
      'uSampO',
      'uSampU',
      'uSampV',
    ];
    for (const n of names) {
      this.uniforms[n] = gl.getUniformLocation(this.program, n);
    }
  }

  /** Upload a new source image and size the drawing buffer to match. */
  setImage(source: ImageSource) {
    const gl = this.gl;
    this.imgWidth = source.width;
    this.imgHeight = source.height;
    this.canvas.width = source.width;
    this.canvas.height = source.height;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.imageTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  private updateCurveTexture(recipe: EditRecipe) {
    const gl = this.gl;
    const data = buildCurveTextureData(recipe.curves);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.curveTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  /**
   * Render the recipe. When `bypass` is true the whole canvas shows the
   * untouched original (before/after hold-to-compare). When `split` is a
   * fraction in 0..1, the left `split` portion shows the original and the rest
   * shows the edit — the before/after split slider (PRD 4.2). When
   * `cropPreview` is true the crop is bypassed so the full frame is visible for
   * the crop tool overlay.
   */
  render(recipe: EditRecipe, bypass = false, split: number | null = null, cropPreview = false) {
    const gl = this.gl;
    const u = this.uniforms;
    gl.useProgram(this.program);

    // Crop/transform geometry decides the output size (may differ from source).
    const tf = cropPreview
      ? identityTransform(this.imgWidth, this.imgHeight)
      : computeCropTransform(recipe.crop, this.imgWidth, this.imgHeight);
    if (this.canvas.width !== tf.outW || this.canvas.height !== tf.outH) {
      this.canvas.width = tf.outW;
      this.canvas.height = tf.outH;
    }
    gl.viewport(0, 0, tf.outW, tf.outH);
    gl.uniform2f(u['uSampO'], tf.origin[0], tf.origin[1]);
    gl.uniform2f(u['uSampU'], tf.u[0], tf.u[1]);
    gl.uniform2f(u['uSampV'], tf.v[0], tf.v[1]);

    this.updateCurveTexture(recipe);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.imageTex);
    gl.uniform1i(u['uImage'], 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.curveTex);
    gl.uniform1i(u['uCurveLut'], 1);

    // Texel is in *source* space — spatial ops (sharpen) sample the source.
    gl.uniform2f(u['uTexel'], 1 / this.imgWidth, 1 / this.imgHeight);
    gl.uniform1f(u['uSeed'], this.seed);

    // Main pass fills the whole frame (edited, or original if bypassed).
    this.drawPass(bypass ? ZERO_RECIPE : recipe);

    // Split slider: re-draw the original into just the left region via scissor.
    if (split != null) {
      const sx = Math.round(Math.min(1, Math.max(0, split)) * tf.outW);
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(0, 0, sx, tf.outH);
      this.drawPass(ZERO_RECIPE);
      gl.disable(gl.SCISSOR_TEST);
    }
  }

  /** Set all per-recipe uniforms and draw the fullscreen quad once. */
  private drawPass(r: EditRecipe) {
    const gl = this.gl;
    const u = this.uniforms;

    gl.uniform1f(u['uExposure'], r.exposure);
    gl.uniform1f(u['uContrast'], r.contrast / 100);
    gl.uniform1f(u['uHighlights'], r.highlights / 100);
    gl.uniform1f(u['uShadows'], r.shadows / 100);
    gl.uniform1f(u['uWhites'], r.whites / 100);
    gl.uniform1f(u['uBlacks'], r.blacks / 100);
    gl.uniform1f(u['uTemperature'], r.temperature / 100);
    gl.uniform1f(u['uTint'], r.tint / 100);
    gl.uniform1f(u['uVibrance'], r.vibrance / 100);
    gl.uniform1f(u['uSaturation'], r.saturation / 100);
    gl.uniform1f(u['uClarity'], r.clarity / 100);
    gl.uniform1f(u['uTexture'], r.texture / 100);

    gl.uniform1i(u['uUseCurve'], isIdentityCurves(r.curves) ? 0 : 1);

    // HSL: pack 8 bands into a flat Float32Array of vec3s.
    const hsl = new Float32Array(8 * 3);
    HSL_BANDS.forEach((band, i) => {
      const c = r.hsl[band];
      hsl[i * 3 + 0] = c.hue / 100;
      hsl[i * 3 + 1] = c.saturation / 100;
      hsl[i * 3 + 2] = c.luminance / 100;
    });
    gl.uniform3fv(u['uHsl[0]'], hsl);

    const st = r.splitToning;
    gl.uniform3fv(u['uSplitShadow'], hsvToRgb(st.shadowHue, 1, 1));
    gl.uniform3fv(u['uSplitHighlight'], hsvToRgb(st.highlightHue, 1, 1));
    gl.uniform1f(u['uSplitShadowAmt'], st.shadowSaturation / 100);
    gl.uniform1f(u['uSplitHighlightAmt'], st.highlightSaturation / 100);
    gl.uniform1f(u['uSplitBalance'], st.balance / 100);

    gl.uniform1f(u['uSharpen'], r.sharpening / 100);
    gl.uniform1f(u['uSharpenRadius'], r.sharpenRadius);
    gl.uniform1f(u['uNoise'], r.noiseReduction / 100);
    gl.uniform1f(u['uVignette'], r.vignette / 100);
    gl.uniform1f(u['uVigMid'], r.vignetteMidpoint / 100);
    gl.uniform1f(u['uVigFeather'], r.vignetteFeather / 100);
    gl.uniform1f(u['uGrain'], r.grain / 100);
    gl.uniform1f(u['uGrainSize'], r.grainSize / 100);
    gl.uniform1f(u['uFade'], r.fade / 100);
    gl.uniform1f(u['uHalation'], r.halation / 100);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  dispose() {
    const gl = this.gl;
    gl.deleteTexture(this.imageTex);
    gl.deleteTexture(this.curveTex);
    gl.deleteProgram(this.program);
  }
}

import { defaultRecipe } from '../recipe';
const ZERO_RECIPE = defaultRecipe();

// The GPU's max texture dimension caps both the uploaded source and the output
// canvas. Probe it once via a throwaway context and cache the result.
let cachedMaxTexSize = 0;
export function maxTextureSize(): number {
  if (cachedMaxTexSize) return cachedMaxTexSize;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    cachedMaxTexSize = gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 4096;
  } catch {
    cachedMaxTexSize = 4096;
  }
  return cachedMaxTexSize;
}

/** Full-resolution output dimensions for a recipe (accounts for crop/rotate). */
export function outputDimensions(
  recipe: EditRecipe,
  srcW: number,
  srcH: number,
): { w: number; h: number } {
  const tf = computeCropTransform(recipe.crop, srcW, srcH);
  return { w: tf.outW, h: tf.outH };
}

export interface ExportPlan {
  /** Long edge of the exported image after any clamping. */
  outW: number;
  outH: number;
  /** True when the result was shrunk below the ideal (GPU cap or user choice). */
  downscaled: boolean;
  /** True when the GPU's MAX_TEXTURE_SIZE forced a smaller size than requested. */
  gpuClamped: boolean;
}

/**
 * Resolve the final export size given a desired output long edge (or null for
 * full/original). Never upscales; clamps to the GPU limit so huge images can't
 * silently fail the texture upload (PRD 4.5 + M4 large-image perf).
 */
export function planExport(
  recipe: EditRecipe,
  srcW: number,
  srcH: number,
  desiredLongEdge: number | null,
): ExportPlan & { sourceScale: number } {
  const full = outputDimensions(recipe, srcW, srcH);
  const fullLong = Math.max(full.w, full.h);
  const maxTex = maxTextureSize();

  // Scale to hit the requested output long edge (never > 1 / upscale).
  const requestScale = desiredLongEdge ? Math.min(1, desiredLongEdge / fullLong) : 1;
  // Scale so neither the source texture nor the output canvas exceeds the cap.
  const srcLong = Math.max(srcW, srcH);
  const capScale = Math.min(maxTex / srcLong, maxTex / fullLong, 1);

  const sourceScale = Math.min(requestScale, capScale);
  const outW = Math.max(1, Math.round(full.w * sourceScale));
  const outH = Math.max(1, Math.round(full.h * sourceScale));
  return {
    outW,
    outH,
    sourceScale,
    downscaled: sourceScale < 1,
    gpuClamped: capScale < requestScale,
  };
}

/** Draw a source image onto a 2D canvas at a reduced scale for export. */
function scaleSource(source: ImageSource, scale: number): HTMLCanvasElement {
  const w = Math.max(1, Math.round((source.width as number) * scale));
  const h = Math.max(1, Math.round((source.height as number) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source as CanvasImageSource, 0, 0, w, h);
  return canvas;
}

/**
 * One-shot export: render the recipe against the original image on an offscreen
 * canvas and return a Blob. Preview and export share the identical shader, so
 * they match (PRD 5.3). `desiredLongEdge` picks a custom output size (PRD 4.5);
 * the source is downscaled first when it (or the request) exceeds the GPU cap.
 */
export async function exportImage(
  source: ImageSource,
  recipe: EditRecipe,
  format: 'image/jpeg' | 'image/png' | 'image/webp',
  quality = 0.92,
  desiredLongEdge: number | null = null,
): Promise<Blob> {
  const plan = planExport(recipe, source.width, source.height, desiredLongEdge);
  // Downscaling the source proportionally yields the planned output size and
  // keeps the source texture under MAX_TEXTURE_SIZE.
  const effective: ImageSource =
    plan.sourceScale < 1 ? scaleSource(source, plan.sourceScale) : source;

  const canvas = document.createElement('canvas');
  const renderer = new Renderer(canvas);
  renderer.setImage(effective);
  renderer.render(recipe);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, format, quality),
  );
  renderer.dispose();
  if (!blob) throw new Error('Export failed to produce an image.');
  return blob;
}
