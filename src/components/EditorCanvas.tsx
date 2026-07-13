'use client';

import { useEffect, useRef, useState } from 'react';
import { Renderer } from '@/lib/gl/renderer';
import { useEditor } from '@/lib/store';
import { computeHistogram, useHistogram } from '@/lib/histogram';
import { defaultCrop, type Crop } from '@/lib/recipe';
import { CropOverlay } from './CropOverlay';
import { CropBar, fitRectToRatio } from './CropBar';

export function EditorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const histCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const [showOriginal, setShowOriginal] = useState(false);
  const [splitOn, setSplitOn] = useState(false);
  const [splitFrac, setSplitFrac] = useState(0.5);
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

  // Render on any recipe/mode change, coalesced to a frame. In crop mode the
  // crop is bypassed (cropPreview) so the whole image shows under the overlay.
  const split = splitOn && !cropMode ? splitFrac : null;
  useEffect(() => {
    if (!rendererRef.current) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const renderer = rendererRef.current;
      const canvas = canvasRef.current;
      if (!renderer || !canvas) return;
      renderer.render(recipe, showOriginal, split, cropMode);

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
    <div className="canvas-stage">
      {glError ? (
        <div className="canvas-error">{glError}</div>
      ) : (
        <div className={`canvas-wrap ${cropMode ? 'cropping' : ''}`}>
          <canvas
            ref={canvasRef}
            className="edit-canvas"
            style={cropMode ? { transform: `rotate(${previewRotate}deg)` } : undefined}
          />
          {splitOn && !cropMode && (
            <div className="split-divider" style={{ left: `${splitFrac * 100}%` }}>
              <div className="split-handle" onPointerDown={onDividerDrag}>
                ⟺
              </div>
              <span className="split-tag before">Before</span>
              <span className="split-tag after">After</span>
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
        <div className="canvas-controls">
          <button className="compare-btn" title="Crop & transform" onClick={enterCrop}>
            Crop
          </button>
          <button
            className={`compare-btn ${splitOn ? 'active' : ''}`}
            title="Split before/after"
            onClick={() => setSplitOn((s) => !s)}
          >
            Split
          </button>
          <button
            className="compare-btn"
            title="Hold to view original"
            onPointerDown={() => setShowOriginal(true)}
            onPointerUp={() => setShowOriginal(false)}
            onPointerLeave={() => setShowOriginal(false)}
          >
            {showOriginal ? 'Original' : 'Hold to Compare'}
          </button>
        </div>
      )}
    </div>
  );
}
