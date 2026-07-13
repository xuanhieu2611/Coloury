'use client';

import { useEffect, useState } from 'react';
import { useEditor } from '@/lib/store';
import {
  BUILTIN_PRESETS,
  deleteUserPreset,
  loadUserPresets,
  saveUserPreset,
  type Preset,
} from '@/lib/presets';
import { cloneRecipe } from '@/lib/recipe';
import { btn, btnPrimary, chip, groupLabel } from '@/lib/ui';

export function Presets() {
  const recipe = useEditor((s) => s.recipe);
  const setRecipe = useEditor((s) => s.setRecipe);
  const [userPresets, setUserPresets] = useState<Preset[]>([]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  // localStorage is client-only; hydrate after mount.
  useEffect(() => {
    setUserPresets(loadUserPresets());
  }, []);

  const apply = (p: Preset) => setRecipe(cloneRecipe(p.recipe)); // commits to history

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setUserPresets(saveUserPreset(trimmed, recipe));
    setName('');
    setNaming(false);
  };

  const remove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setUserPresets(deleteUserPreset(id));
  };

  return (
    <div>
      <div className={`${groupLabel} mt-0.5 mb-1.5`}>Built-in</div>
      <div className="flex flex-wrap gap-1.5">
        {BUILTIN_PRESETS.map((p) => (
          <button key={p.id} className={chip} onClick={() => apply(p)}>
            {p.name}
          </button>
        ))}
      </div>

      <div className={`${groupLabel} mt-2.5 mb-1.5`}>Your presets</div>
      {userPresets.length === 0 && !naming && (
        <div className="text-xs text-text-dim italic">No saved presets yet.</div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {userPresets.map((p) => (
          <button key={p.id} className={`${chip} pr-1.5`} onClick={() => apply(p)} title={p.name}>
            <span>{p.name}</span>
            <span
              className="inline-flex h-4 w-4 items-center justify-center rounded-full text-sm leading-none text-text-dim hover:bg-[rgba(255,122,122,0.12)] hover:text-danger"
              title="Delete preset"
              onClick={(e) => remove(p.id, e)}
            >
              ×
            </span>
          </button>
        ))}
      </div>

      {naming ? (
        <div className="mt-3 flex items-center gap-1.5">
          <input
            className="min-w-0 flex-1 rounded border border-border bg-panel-2 px-2 py-[5px] text-xs text-text outline-none focus:border-accent"
            autoFocus
            placeholder="Preset name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') {
                setNaming(false);
                setName('');
              }
            }}
          />
          <button className={btnPrimary} onClick={save} disabled={!name.trim()}>
            Save
          </button>
          <button className={btn} onClick={() => setNaming(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          className="mt-3 w-full rounded-md border border-dashed border-border bg-transparent py-[7px] text-xs text-text-dim hover:border-accent hover:text-text"
          onClick={() => setNaming(true)}
        >
          + Save current as preset
        </button>
      )}
    </div>
  );
}
