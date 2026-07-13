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
import { btn, btnPrimary, chip, field, groupLabel } from '@/lib/ui';
import { IconClose } from './Icons';
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
        <p className="m-0 text-xs text-text-dim">No saved presets yet. Save the current look below.</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {userPresets.map((p) => (
          <button key={p.id} className={`${chip} pr-1.5`} onClick={() => apply(p)} title={p.name}>
            <span>{p.name}</span>
            <span
              role="button"
              tabIndex={0}
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-text-dim transition-colors duration-150 hover:bg-[rgba(255,122,122,0.12)] hover:text-danger focus-visible:outline-2 focus-visible:outline-ring"
              title="Delete preset"
              aria-label={`Delete ${p.name}`}
              onClick={(e) => remove(p.id, e)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  setUserPresets(deleteUserPreset(p.id));
                }
              }}
            >
              <IconClose size={10} />
            </span>
          </button>
        ))}
      </div>

      {naming ? (
        <div className="mt-3 flex items-center gap-1.5">
          <input
            className={`${field} min-w-0 flex-1`}
            autoFocus
            placeholder="Preset name"
            value={name}
            aria-label="Preset name"
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
          className="mt-3 w-full rounded-md border border-dashed border-border bg-transparent py-2 text-xs text-text-dim transition-[border-color,color] duration-150 hover:border-accent hover:text-text focus-visible:outline-2 focus-visible:outline-ring"
          onClick={() => setNaming(true)}
        >
          Save current as preset
        </button>
      )}
    </div>
  );
}
