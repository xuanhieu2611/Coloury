'use client';

import { useEffect, useRef, useState } from 'react';
import { Renderer } from '@/lib/gl/renderer';
import { composeOverlays, computeFrame, drawOverlays } from '@/lib/overlays';
import { useEditor } from '@/lib/store';
import { computeHistogram, useHistogram } from '@/lib/histogram';
import { defaultCrop, type Crop } from '@/lib/recipe';
import { compareBtn, compareBtnActive } from '@/lib/ui';
import { CropOverlay } from './CropOverlay';
import { CropBar, fitRectToRatio } from './CropBar';

export function EditorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const histCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const [showOriginal, setShowOriginal] = useState(false);
  const [splitOn, setSplitOn] = useState(false);
  const [splitFrac, setSplitFrac] = useState(0.5);
  // One-shot before→after reveal wipe (null = idle). Fraction of the frame still
  // showing the original: animates 1 → 0 so the edit wipes in left-to-right.
  const [revealFrac, setRevealFrac] = useState<number | null>(null);
  const [cropMode, setCropMode] = useState(false);
  const [aspect, setAspect] = useState<{ label: string; ratio: number | null }>({
    label: 'Free',
    ratio: null,
  });
  const [glError, setGlError] = useState<string | null>(null);

  const image = useEditor((s) => s.image);
  const recipe = useEditor((s) => s.recipe);
  const update = useEditor((s) => s.update);
  const commit = useEditor((s) => s.commit);
  const reveal = useEditor((s) => s.reveal);
  const setHistogram = useHistogram((s) => s.set);

  const imageAspect = image ? image.width / image.height : 1;

  // (Re)create the renderer whenever a new image is loaded.
  useEffect(() => {
    if (!image || !canvasRef.current) return;
    try {
      rendererRef.current?.dispose();
      const renderer = new Renderer(canvasRef.current);
      renderer.setImage(image.preview);
      rendererRef.current = renderer;
      setGlError(null);
    } catch (e) {
      setGlError(e instanceof Error ? e.message : 'WebGL initialization failed.');
    }
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [image]);

  // A one-shot reveal wipe (when a filter is tapped) takes precedence over the
  // manual split slider. In crop mode neither applies.
  const split = cropMode ? null : revealFrac != null ? revealFrac : splitOn ? splitFrac : null;

  // Play the before→after wipe when the store's `reveal` nonce bumps. Honors
  // prefers-reduced-motion (skips the animation, just shows the result).
  useEffect(() => {
    if (!reveal || cropMode) return; // reveal starts at 0 → no wipe on mount
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    setSplitOn(false);
    const DUR = 650;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DUR);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setRevealFrac(1 - eased); // 1 (all before) → 0 (all after)
      if (t < 1) raf = requestAnimationFrame(tick);
      else setRevealFrac(null);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal]);

  // Render on any recipe/mode change, coalesced to a frame. In crop mode the
  // crop is bypassed (cropPreview) so the whole image shows under the overlay.
  useEffect(() => {
    if (!rendererRef.current) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const renderer = rendererRef.current;
      const canvas = canvasRef.current;
      if (!renderer || !canvas) return;
      renderer.render(recipe, showOriginal, split, cropMode);

      // Overlays draw on a canvas layered over the GL output. Two cases:
      //  - a border expands the frame → the overlay canvas composites the whole
      //    framed result (border + image + leak/dust/stamp) and the GL canvas is
      //    hidden beneath it (its pixels are still read for the histogram);
      //  - no border → the overlay is the same size as the GL canvas and just
      //    draws the leak/dust/stamp transparently on top of the visible GL image.
      // Hidden while comparing to the original or cropping (they're an edit).
      const oc = overlayRef.current;
      const ov = recipe.overlays;
      const showOverlays = !showOriginal && !cropMode;
      const borderOn = ov.border.style !== 'none' && ov.border.size > 0;
      if (oc) {
        const octx = oc.getContext('2d');
        if (octx) {
          if (showOverlays && borderOn) {
            const frame = computeFrame(canvas.width, canvas.height, ov.border);
            oc.width = frame.outW;
            oc.height = frame.outH;
            octx.clearRect(0, 0, oc.width, oc.height);
            composeOverlays(octx, canvas, ov);
            canvas.style.opacity = '0';
          } else {
            oc.width = canvas.width;
            oc.height = canvas.height;
            octx.clearRect(0, 0, oc.width, oc.height);
            if (showOverlays) {
              drawOverlays(octx, { x: 0, y: 0, w: oc.width, h: oc.height }, ov);
            }
            canvas.style.opacity = '1';
          }
        }
      }

      // Live histogram: downscale the GL canvas onto a small 2D canvas and bin it.
      if (!histCanvasRef.current) {
        histCanvasRef.current = document.createElement('canvas');
        histCanvasRef.current.width = 256;
        histCanvasRef.current.height = 256;
      }
      const hc = histCanvasRef.current;
      const hctx = hc.getContext('2d', { willReadFrequently: true })!;
      hctx.drawImage(canvas, 0, 0, hc.width, hc.height);
      const { data } = hctx.getImageData(0, 0, hc.width, hc.height);
      setHistogram(computeHistogram(data));
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [recipe, showOriginal, split, cropMode, setHistogram]);

  // Live-apply a crop change: mutate recipe.crop through the drag/commit pattern
  // so undo/redo treats each gesture as one step (mirrors the Slider pattern).
  const applyCrop = (mut: (c: Crop) => void, doCommit: boolean) => {
    update((r) => mut(r.crop), false);
    if (doCommit) commit();
  };

  const enterCrop = () => {
    setSplitOn(false);
    setShowOriginal(false);
    setCropMode(true);
  };

  const onAspect = (label: string, ratio: number | null) => {
    setAspect({ label, ratio });
    applyCrop((c) => Object.assign(c, fitRectToRatio(imageAspect, ratio)), true);
  };

  const resetCrop = () => {
    setAspect({ label: 'Free', ratio: null });
    applyCrop((c) => Object.assign(c, defaultCrop()), true);
  };

  // Drag the split divider against the canvas element box.
  const onDividerDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    const move = (clientX: number) => {
      const el = canvasRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setSplitFrac(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)));
    };
    move(e.clientX);
    const onMove = (ev: PointerEvent) => move(ev.clientX);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Live straighten/orientation preview: rotate the canvas element about its
  // center — matches the renderer's rotation pivot for a truthful preview.
  const previewRotate = cropMode ? recipe.crop.angle + recipe.crop.orientation * 90 : 0;

  return (
    <div className="absolute inset-0 flex items-center justify-center p-5">
      {glError ? (
        <div className="max-w-[340px] text-center text-danger">{glError}</div>
      ) : (
        <div className="relative inline-flex max-h-full max-w-full">
          <canvas
            ref={canvasRef}
            className={`max-h-full max-w-full object-contain ${
              cropMode ? '' : 'shadow-[0_4px_30px_rgba(0,0,0,0.5)]'
            }`}
            style={cropMode ? { transform: `rotate(${previewRotate}deg)` } : undefined}
          />
          <canvas
            ref={overlayRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[3] h-full w-full object-contain"
          />
          {revealFrac != null && !cropMode && (
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-[4] w-0 border-l-2 border-white shadow-[0_0_10px_rgba(0,0,0,0.7)]"
              style={{ left: `${(1 - revealFrac) * 100}%` }}
            />
          )}
          {splitOn && !cropMode && revealFrac == null && (
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-[4] w-0 border-l-2 border-white/90 shadow-[0_0_6px_rgba(0,0,0,0.6)]"
              style={{ left: `${splitFrac * 100}%` }}
            >
              <div
                className="pointer-events-auto absolute top-1/2 left-0 flex h-[30px] w-[30px] -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none select-none items-center justify-center rounded-full bg-white/95 text-sm text-[#222]"
                onPointerDown={onDividerDrag}
              >
                ⟺
              </div>
              <span className="absolute top-3 right-1.5 rounded-[3px] bg-black/55 px-[7px] py-0.5 text-[10px] tracking-[0.5px] text-white uppercase">
                Before
              </span>
              <span className="absolute top-3 left-1.5 rounded-[3px] bg-black/55 px-[7px] py-0.5 text-[10px] tracking-[0.5px] text-white uppercase">
                After
              </span>
            </div>
          )}
          {cropMode && (
            <CropOverlay
              crop={recipe.crop}
              imageAspect={imageAspect}
              ratio={aspect.ratio}
              onChange={applyCrop}
            />
          )}
        </div>
      )}

      {cropMode ? (
        <CropBar
          crop={recipe.crop}
          imageAspect={imageAspect}
          activeAspect={aspect.label}
          onAspect={onAspect}
          onChange={applyCrop}
          onReset={resetCrop}
          onDone={() => setCropMode(false)}
        />
      ) : (
        <div
          className="absolute bottom-4 left-1/2 z-[5] flex -translate-x-1/2 gap-2"
          role="toolbar"
          aria-label="Compare and crop"
        >
          <button className={compareBtn} title="Crop & transform" onClick={enterCrop}>
            Crop
          </button>
          <button
            className={`${compareBtn} ${splitOn ? compareBtnActive : ''}`}
            title="Split before/after"
            aria-pressed={splitOn}
            onClick={() => setSplitOn((s) => !s)}
          >
            Split
          </button>
          <button
            className={`${compareBtn} ${showOriginal ? compareBtnActive : ''}`}
            title="Hold to view original"
            aria-pressed={showOriginal}
            onPointerDown={() => setShowOriginal(true)}
            onPointerUp={() => setShowOriginal(false)}
            onPointerLeave={() => setShowOriginal(false)}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                setShowOriginal(true);
              }
            }}
            onKeyUp={(e) => {
              if (e.key === ' ' || e.key === 'Enter') setShowOriginal(false);
            }}
            onBlur={() => setShowOriginal(false)}
          >
            {showOriginal ? 'Original' : 'Hold to Compare'}
          </button>
        </div>
      )}
    </div>
  );
}
