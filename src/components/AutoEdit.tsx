'use client';

import { useId, useState } from 'react';
import { useEditor } from '@/lib/store';
import { requestAutoEdit, type AutoEditResult } from '@/lib/aiEdit';
import { btn, btnPrimary, field } from '@/lib/ui';
import { IconSpark, IconSpinner } from './Icons';

export function AutoEdit() {
  const image = useEditor((s) => s.image);
  const setRecipe = useEditor((s) => s.setRecipe);
  const styleId = useId();

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
    <section className="border-b border-border bg-linear-to-b from-[#1e2836] from-0% to-panel to-70% px-3.5 py-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <IconSpark className="text-accent" />
        <h2 className="m-0 text-[13px] font-semibold tracking-tight text-text">Auto Edit</h2>
      </div>

      <label htmlFor={styleId} className="sr-only">
        Style intent
      </label>
      <input
        id={styleId}
        className={`${field} mb-2`}
        placeholder="Optional look — e.g. warm and moody"
        value={style}
        disabled={busy}
        onChange={(e) => setStyle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !busy) run(false);
        }}
      />

      <div className="flex gap-1.5">
        <button
          className={`${btnPrimary} min-h-[34px] flex-1`}
          disabled={busy}
          onClick={() => run(false)}
          aria-busy={busy}
        >
          {busy ? (
            <>
              <IconSpinner />
              Analyzing…
            </>
          ) : looks.length ? (
            'Auto Edit again'
          ) : (
            'Auto Edit'
          )}
        </button>
        {looks.length > 0 && (
          <button
            className={btn}
            disabled={busy}
            onClick={() => run(true)}
            title="A fresh interpretation"
          >
            Try another
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="mt-2 text-xs leading-snug text-danger-soft">
          {error}
        </div>
      )}

      {current && (
        <div className="mt-3" aria-live="polite">
          <p className="m-0 text-xs leading-relaxed text-text-dim">
            {current.explanation || 'Applied an AI edit.'}
          </p>
          {looks.length > 1 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Cached looks">
              {looks.map((l, i) => (
                <button
                  key={i}
                  className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-medium transition-[background,border-color] duration-150 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 ${
                    i === active
                      ? 'border-accent bg-accent-dim text-text'
                      : 'border-border bg-panel-2 text-text-dim hover:border-border-strong hover:text-text'
                  }`}
                  onClick={() => applyLook(i)}
                  title={l.style ? `"${l.style}"` : 'AI look'}
                  aria-pressed={i === active}
                >
                  Look {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
