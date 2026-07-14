/** Shared Tailwind class strings for repeated UI patterns. */

const focus =
  'focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2';

export const btn =
  `inline-flex items-center justify-center gap-1.5 bg-panel-2 text-text border border-border px-3 py-1.5 rounded-md text-xs font-medium shadow-[var(--shadow-raised)] transition-[background,border-color,opacity,transform] duration-150 ease-[var(--ease-out)] hover:enabled:bg-panel-hover hover:enabled:border-border-strong active:enabled:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none ${focus}`;

export const btnPrimary =
  `inline-flex items-center justify-center gap-1.5 bg-accent text-[#06121f] border border-accent px-3 py-1.5 rounded-md text-xs font-semibold shadow-[0_2px_10px_rgba(107,179,255,0.25)] transition-[background,box-shadow,opacity,transform] duration-150 ease-[var(--ease-out)] hover:enabled:brightness-110 hover:enabled:shadow-[0_3px_16px_rgba(107,179,255,0.4)] active:enabled:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none ${focus}`;

export const brandWordmark =
  'font-[family-name:var(--font-display),var(--font-ui),ui-sans-serif,sans-serif] font-bold tracking-[-0.02em] text-text';

export const compareBtn =
  `bg-white/[0.04] text-text border border-white/10 px-4 py-2 rounded-full text-xs font-medium select-none backdrop-blur-md transition-[background,border-color,color] duration-150 ease-[var(--ease-out)] hover:border-accent/70 hover:bg-white/[0.09] ${focus}`;

export const compareBtnActive = 'bg-accent text-[#06121f] border-accent';

export const chip =
  `bg-panel-2 border border-border text-text rounded-full px-3 py-1.5 text-xs inline-flex items-center gap-1.5 shadow-[var(--shadow-raised)] transition-[background,border-color] duration-150 ease-[var(--ease-out)] hover:border-accent hover:bg-[#1e2836] active:scale-[0.98] ${focus}`;

export const groupLabel =
  'text-text-dim font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em]';

export const field =
  `w-full rounded-md border border-border bg-canvas/60 px-2.5 py-2 text-xs text-text outline-none transition-[border-color,background,box-shadow] duration-150 placeholder:text-text-dim/70 hover:border-border-strong focus:border-accent focus:shadow-[0_0_0_3px_rgba(107,179,255,0.12)] ${focus}`;

export const panelSection =
  'border-b border-border';
