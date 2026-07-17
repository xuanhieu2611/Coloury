'use client';

import { useEditor, type EditMode } from '@/lib/store';

const MODES: { id: EditMode; label: string; hint: string }[] = [
  { id: 'simple', label: 'Simple', hint: 'Filters and one-tap looks' },
  { id: 'advanced', label: 'Advanced', hint: 'Manual panels and curves' },
];

/**
 * Segmented Simple/Advanced switch — the front door to the pro cockpit. A single
 * accent thumb slides between the two slots; the pressed segment carries dark
 * on-accent text. Motion is motivated (it tracks the active mode) and honors the
 * global reduced-motion reset in globals.css.
 */
export function ModeToggle() {
  const mode = useEditor((s) => s.mode);
  const setMode = useEditor((s) => s.setMode);

  return (
    <div className="px-3.5 pt-3.5">
      <div
        role="tablist"
        aria-label="Editing mode"
        className="relative flex rounded-full border border-border bg-panel-2/50 p-1 shadow-[var(--shadow-raised)]"
      >
        <span
          aria-hidden
          className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-accent shadow-[0_2px_10px_rgba(107,179,255,0.28)] transition-transform duration-[var(--duration-med)] ease-[var(--ease-out)]"
          style={{
            transform: mode === 'advanced' ? 'translateX(calc(100% + 4px))' : 'translateX(0)',
          }}
        />
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={active}
              title={m.hint}
              onClick={() => setMode(m.id)}
              className={`relative z-10 flex-1 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 ${
                active ? 'text-[#06121f]' : 'text-text-dim hover:text-text'
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
