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
    <div className="presets">
      <div className="preset-group-label">Built-in</div>
      <div className="preset-list">
        {BUILTIN_PRESETS.map((p) => (
          <button key={p.id} className="preset-chip" onClick={() => apply(p)}>
            {p.name}
          </button>
        ))}
      </div>

      <div className="preset-group-label">Your presets</div>
      {userPresets.length === 0 && !naming && (
        <div className="preset-empty">No saved presets yet.</div>
      )}
      <div className="preset-list">
        {userPresets.map((p) => (
          <button key={p.id} className="preset-chip user" onClick={() => apply(p)} title={p.name}>
            <span className="preset-chip-name">{p.name}</span>
            <span className="preset-chip-x" title="Delete preset" onClick={(e) => remove(p.id, e)}>
              ×
            </span>
          </button>
        ))}
      </div>

      {naming ? (
        <div className="preset-save-row">
          <input
            className="preset-name-input"
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
          <button className="tb-btn primary" onClick={save} disabled={!name.trim()}>
            Save
          </button>
          <button className="tb-btn" onClick={() => setNaming(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button className="preset-save-btn" onClick={() => setNaming(true)}>
          + Save current as preset
        </button>
      )}
    </div>
  );
}
