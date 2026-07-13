'use client';

import { useState } from 'react';
import { useEditor } from '@/lib/store';
import { requestAutoEdit, type AutoEditResult } from '@/lib/aiEdit';
import { btn, btnPrimary } from '@/lib/ui';

export function AutoEdit() {
  const image = useEditor((s) => s.image);
  const setRecipe = useEditor((s) => s.setRecipe);

  const [style, setStyle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cached looks (PRD 5.4) — switching between them re-applies with no network.
  const [looks, setLooks] = useState<AutoEditResult[]>([]);
  const [active, setActive] = useState(-1);

  if (!image) return null;

  const run = async (reroll: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const result = await requestAutoEdit(image.preview, { style, reroll });
      setRecipe(result.recipe); // commits to undo history — fully editable after
      setLooks((prev) => {
        const next = [...prev, result];
        setActive(next.length - 1);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Auto Edit failed.');
    } finally {
      setBusy(false);
    }
  };

  const applyLook = (i: number) => {
    setActive(i);
    setRecipe(looks[i].recipe);
  };

  const current = active >= 0 ? looks[active] : null;

  return (
    <div className="border-b border-border bg-linear-to-b from-accent-dim from-[-60%] to-panel to-[60%] px-3.5 py-3">
      <div className="mb-2">
        <span className="text-[13px] font-semibold text-text">✨ AI Auto Edit</span>
      </div>

      <input
        className="mb-2 w-full rounded-md border border-border bg-panel-2 px-[9px] py-[7px] text-xs text-text outline-none focus:border-accent"
        placeholder="Optional: a look, e.g. warm and moody"
        value={style}
        disabled={busy}
        onChange={(e) => setStyle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !busy) run(false);
        }}
      />

      <div className="flex gap-1.5">
        <button className={`${btnPrimary} flex-1`} disabled={busy} onClick={() => run(false)}>
          {busy ? 'Analyzing light and color…' : looks.length ? 'Auto Edit again' : 'Auto Edit'}
        </button>
        {looks.length > 0 && (
          <button className={btn} disabled={busy} onClick={() => run(true)} title="A fresh interpretation">
            Try another style
          </button>
        )}
      </div>

      {error && <div className="mt-2 text-xs leading-snug text-danger-soft">{error}</div>}

      {current && (
        <div className="mt-2.5">
          <div className="text-xs leading-normal text-text-dim">
            {current.explanation || 'Applied an AI edit.'}
          </div>
          {looks.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {looks.map((l, i) => (
                <button
                  key={i}
                  className={`cursor-pointer rounded-xl border px-2.5 py-1 text-[11px] ${
                    i === active
                      ? 'border-accent bg-accent-dim text-text'
                      : 'border-border bg-panel-2 text-text-dim'
                  }`}
                  onClick={() => applyLook(i)}
                  title={l.style ? `“${l.style}”` : 'AI look'}
                >
                  Look {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
