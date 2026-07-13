'use client';

import { useEffect, useState } from 'react';
import { exportImage } from '@/lib/gl/renderer';
import { useEditor } from '@/lib/store';

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
    <div className="toolbar">
      <div className="toolbar-left">
        <span className="brand">Coloury</span>
        <span className="file-meta">
          {image.name} · {image.width}×{image.height} · {(image.fileSize / 1024 / 1024).toFixed(1)} MB
        </span>
      </div>
      <div className="toolbar-right">
        <button className="tb-btn" disabled={past.length === 0} onClick={undo} title="Undo (⌘Z)">
          Undo
        </button>
        <button className="tb-btn" disabled={future.length === 0} onClick={redo} title="Redo (⇧⌘Z)">
          Redo
        </button>
        <button className="tb-btn" onClick={resetAll} title="Reset all edits">
          Reset
        </button>
        <button className="tb-btn" onClick={() => location.reload()} title="Open a different photo">
          New
        </button>
        <button className="tb-btn primary" onClick={() => setShowExport(true)}>
          Export
        </button>
      </div>

      {showExport && (
        <div className="modal-backdrop" onClick={() => !busy && setShowExport(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Export Photo</h3>
            <p className="modal-sub">
              Rendered at full resolution ({image.width}×{image.height}).
            </p>
            <label className="modal-row">
              <span>Format</span>
              <select value={format} onChange={(e) => setFormat(e.target.value as Format)}>
                {Object.entries(FORMATS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            {format !== 'image/png' && (
              <label className="modal-row">
                <span>Quality {Math.round(quality * 100)}%</span>
                <input
                  type="range"
                  min={0.4}
                  max={1}
                  step={0.01}
                  value={quality}
                  onChange={(e) => setQuality(parseFloat(e.target.value))}
                />
              </label>
            )}
            <div className="modal-actions">
              <button className="tb-btn" onClick={() => setShowExport(false)} disabled={busy}>
                Cancel
              </button>
              <button className="tb-btn primary" onClick={doExport} disabled={busy}>
                {busy ? 'Exporting…' : 'Download'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
