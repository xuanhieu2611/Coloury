/** Shared Tailwind class strings for repeated UI patterns. */

const focus =
  'focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2';

export const btn =
  `inline-flex items-center justify-center gap-1.5 bg-panel-2 text-text border border-border px-3 py-1.5 rounded-md text-xs font-medium transition-[background,border-color,opacity] duration-150 ease-[var(--ease-out)] hover:enabled:bg-panel-hover hover:enabled:border-border-strong active:enabled:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${focus}`;

export const btnPrimary =
  `inline-flex items-center justify-center gap-1.5 bg-accent-dim text-text border border-accent px-3 py-1.5 rounded-md text-xs font-medium transition-[background,border-color,opacity,transform] duration-150 ease-[var(--ease-out)] hover:enabled:bg-accent hover:enabled:text-[#0a0a0a] active:enabled:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${focus}`;

export const brandWordmark =
  'font-[family-name:var(--font-display),var(--font-ui),ui-sans-serif,sans-serif] font-bold tracking-[-0.02em] text-text';

export const compareBtn =
  `bg-[rgba(26,26,26,0.92)] text-text border border-border px-4 py-2 rounded-full text-xs font-medium select-none backdrop-blur-sm transition-[background,border-color,transform] duration-150 ease-[var(--ease-out)] hover:border-accent hover:bg-[rgba(36,36,36,0.95)] active:scale-[0.98] ${focus}`;

export const compareBtnActive = 'bg-accent-dim border-accent text-text';

export const chip =
  `bg-panel-2 border border-border text-text rounded-full px-3 py-1.5 text-xs inline-flex items-center gap-1.5 transition-[background,border-color] duration-150 ease-[var(--ease-out)] hover:border-accent hover:bg-[#1e2836] active:scale-[0.98] ${focus}`;

export const groupLabel =
  'text-text-dim text-[10px] font-medium uppercase tracking-[0.08em]';

export const field =
  `w-full rounded-md border border-border bg-panel-2 px-2.5 py-2 text-xs text-text outline-none transition-[border-color,background] duration-150 placeholder:text-text-dim/70 hover:border-border-strong focus:border-accent ${focus}`;

export const panelSection =
  'border-b border-border';
