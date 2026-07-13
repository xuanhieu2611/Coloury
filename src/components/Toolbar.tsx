'use client';

import { useEffect, useState } from 'react';
import { exportImage } from '@/lib/gl/renderer';
import { useEditor } from '@/lib/store';
import { brandGradient, btn, btnPrimary } from '@/lib/ui';

const FORMATS = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
} as const;
type Format = keyof typeof FORMATS;

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
  const [busy, setBusy] = useState(false);

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

  if (!image) return null;

  const doExport = async () => {
    setBusy(true);
    try {
      const blob = await exportImage(image.element, recipe, format, quality);
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
    <div className="flex h-[46px] shrink-0 items-center justify-between border-b border-border bg-panel px-3.5">
      <div className="flex min-w-0 items-baseline gap-3.5">
        <span className={`font-bold ${brandGradient}`}>Coloury</span>
        <span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-dim">
          {image.name} · {image.width}×{image.height} · {(image.fileSize / 1024 / 1024).toFixed(1)} MB
        </span>
      </div>
      <div className="flex gap-2">
        <button className={btn} disabled={past.length === 0} onClick={undo} title="Undo (⌘Z)">
          Undo
        </button>
        <button className={btn} disabled={future.length === 0} onClick={redo} title="Redo (⇧⌘Z)">
          Redo
        </button>
        <button className={btn} onClick={resetAll} title="Reset all edits">
          Reset
        </button>
        <button className={btn} onClick={() => location.reload()} title="Open a different photo">
          New
        </button>
        <button className={btnPrimary} onClick={() => setShowExport(true)}>
          Export
        </button>
      </div>

      {showExport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => !busy && setShowExport(false)}
        >
          <div
            className="w-[340px] rounded-[10px] border border-border bg-panel px-[22px] py-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="m-0 mb-1">Export Photo</h3>
            <p className="mb-4 mt-0 text-xs text-text-dim">
              Rendered at full resolution ({image.width}×{image.height}).
            </p>
            <label className="my-3 flex items-center justify-between gap-3">
              <span>Format</span>
              <select
                className="rounded border border-border bg-panel-2 px-2 py-1 text-text"
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
            {format !== 'image/png' && (
              <label className="my-3 flex items-center justify-between gap-3">
                <span>Quality {Math.round(quality * 100)}%</span>
                <input
                  className="flex-1"
                  type="range"
                  min={0.4}
                  max={1}
                  step={0.01}
                  value={quality}
                  onChange={(e) => setQuality(parseFloat(e.target.value))}
                />
              </label>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button className={btn} onClick={() => setShowExport(false)} disabled={busy}>
                Cancel
              </button>
              <button className={btnPrimary} onClick={doExport} disabled={busy}>
                {busy ? 'Exporting…' : 'Download'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
