'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { exportImage, planExport } from '@/lib/gl/renderer';
import { useEditor } from '@/lib/store';
import { summarizeExif } from '@/lib/exif';
import { brandWordmark, btn, btnPrimary } from '@/lib/ui';
import { IconSpinner } from './Icons';

const FORMATS = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
} as const;
type Format = keyof typeof FORMATS;

/** Human-readable file size — KB below 1 MB so small files don't read "0.0 MB". */
function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function Toolbar() {
  const image = useEditor((s) => s.image);
  const recipe = useEditor((s) => s.recipe);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const resetAll = useEditor((s) => s.resetAll);
  const past = useEditor((s) => s.past);
  const future = useEditor((s) => s.future);

  const [showExport, setShowExport] = useState(false);
  const [format, setFormat] = useState<Format>('image/jpeg');
  const [quality, setQuality] = useState(0.92);
  // Export size: null = original/full; a number = custom long-edge in px.
  const [sizeChoice, setSizeChoice] = useState<'original' | 'custom' | number>('original');
  const [customEdge, setCustomEdge] = useState('2048');
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Requested output long edge (null = original), and the resolved plan (which
  // may clamp below that for the GPU's max texture size).
  const desiredLongEdge =
    sizeChoice === 'original'
      ? null
      : sizeChoice === 'custom'
        ? Math.max(16, parseInt(customEdge, 10) || 0) || null
        : sizeChoice;
  const plan = useMemo(
    () => (image ? planExport(recipe, image.width, image.height, desiredLongEdge) : null),
    [image, recipe, desiredLongEdge],
  );

  // Long-edge presets smaller than the full output make sense to offer.
  const sizePresets = useMemo(() => {
    if (!image) return [];
    const full = planExport(recipe, image.width, image.height, null);
    const fullLong = Math.max(full.outW, full.outH);
    return [4096, 2048, 1024].filter((p) => p < fullLong);
  }, [image, recipe]);

  // Keyboard: undo/redo shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // Escape closes export dialog.
  useEffect(() => {
    if (!showExport) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) setShowExport(false);
    };
    window.addEventListener('keydown', onKey);
    dialogRef.current?.querySelector<HTMLElement>('button, select, input')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [showExport, busy]);

  if (!image) return null;

  const doExport = async () => {
    setBusy(true);
    try {
      const blob = await exportImage(image.element, recipe, format, quality, desiredLongEdge);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ext = format === 'image/jpeg' ? 'jpg' : format === 'image/png' ? 'png' : 'webp';
      const base = image.name.replace(/\.[^.]+$/, '');
      a.href = url;
      a.download = `${base}-edited.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setShowExport(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-border bg-panel px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex shrink-0 flex-col gap-1">
          <span className={`${brandWordmark} text-[15px] leading-none`}>Coloury</span>
          <span className="spectrum-bar w-10" aria-hidden />
        </div>
        <span className="hidden min-w-0 truncate text-xs text-text-dim lg:inline">
          {image.name}
          <span className="mx-1.5 text-border-strong">·</span>
          {image.width}×{image.height}
          <span className="mx-1.5 text-border-strong">·</span>
          {formatBytes(image.fileSize)}
          {image.exif && summarizeExif(image.exif) && (
            <>
              <span className="mx-1.5 text-border-strong">·</span>
              <span className="text-text-dim/80">{summarizeExif(image.exif)}</span>
            </>
          )}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5" role="toolbar" aria-label="Edit actions">
        <button
          className={btn}
          disabled={past.length === 0}
          onClick={undo}
          title="Undo (⌘Z)"
          aria-label="Undo"
        >
          Undo
        </button>
        <button
          className={btn}
          disabled={future.length === 0}
          onClick={redo}
          title="Redo (⇧⌘Z)"
          aria-label="Redo"
        >
          Redo
        </button>
        <button className={btn} onClick={resetAll} title="Reset all edits" aria-label="Reset all edits">
          Reset
        </button>
        <button
          className={btn}
          onClick={() => location.reload()}
          title="Open a different photo"
          aria-label="Open a different photo"
        >
          New
        </button>
        <button className={`${btnPrimary} ml-1`} onClick={() => setShowExport(true)}>
          Export
        </button>
      </div>

      {showExport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]"
          onClick={() => !busy && setShowExport(false)}
          role="presentation"
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-[min(360px,100%)] rounded-[var(--radius-lg)] border border-border bg-panel px-5 py-5 shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id={titleId} className="m-0 font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
              Export photo
            </h3>
            <p className="mb-4 mt-1.5 text-xs leading-relaxed text-text-dim">
              Rendered from the full-resolution original. Nothing is baked until you download.
            </p>
            <label className="my-3 flex items-center justify-between gap-3 text-sm">
              <span>Format</span>
              <select
                className="rounded-md border border-border bg-panel-2 px-2.5 py-1.5 text-text focus-visible:outline-2 focus-visible:outline-ring"
                value={format}
                onChange={(e) => setFormat(e.target.value as Format)}
              >
                {Object.entries(FORMATS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="my-3 flex items-center justify-between gap-3 text-sm">
              <span>Size</span>
              <select
                className="rounded-md border border-border bg-panel-2 px-2.5 py-1.5 text-text focus-visible:outline-2 focus-visible:outline-ring"
                value={String(sizeChoice)}
                onChange={(e) => {
                  const v = e.target.value;
                  setSizeChoice(v === 'original' || v === 'custom' ? v : Number(v));
                }}
              >
                <option value="original">Original</option>
                {sizePresets.map((p) => (
                  <option key={p} value={p}>
                    {p}px long edge
                  </option>
                ))}
                <option value="custom">Custom…</option>
              </select>
            </label>
            {sizeChoice === 'custom' && (
              <label className="my-3 flex items-center justify-between gap-3 text-sm">
                <span>Long edge (px)</span>
                <input
                  type="number"
                  min={16}
                  className="w-28 rounded-md border border-border bg-panel-2 px-2.5 py-1.5 text-text focus-visible:outline-2 focus-visible:outline-ring"
                  value={customEdge}
                  onChange={(e) => setCustomEdge(e.target.value)}
                />
              </label>
            )}
            {plan && (
              <p className="mb-1 text-xs text-text-dim">
                Output: {plan.outW}×{plan.outH} px
                {plan.gpuClamped && (
                  <span className="text-danger">
                    {' '}
                    · capped to this GPU&apos;s max texture size
                  </span>
                )}
              </p>
            )}
            {format !== 'image/png' && (
              <label className="my-3 flex items-center justify-between gap-3 text-sm">
                <span>Quality {Math.round(quality * 100)}%</span>
                <input
                  className="slider-range h-[3px] flex-1 rounded-[2px] bg-track"
                  type="range"
                  min={0.4}
                  max={1}
                  step={0.01}
                  value={quality}
                  onChange={(e) => setQuality(parseFloat(e.target.value))}
                  aria-label="Export quality"
                />
              </label>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button className={btn} onClick={() => setShowExport(false)} disabled={busy}>
                Cancel
              </button>
              <button className={btnPrimary} onClick={doExport} disabled={busy} aria-busy={busy}>
                {busy ? (
                  <>
                    <IconSpinner />
                    Exporting…
                  </>
                ) : (
                  'Download'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
