'use client';

import { useCallback, useId, useRef } from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Fired continuously during drag (commit=false). */
  onChange: (v: number) => void;
  /** Fired on release / commit (pushes history). */
  onCommit: () => void;
  /** Double-click resets to this (default 0). */
  defaultValue?: number;
  className?: string;
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  onCommit,
  defaultValue = 0,
  className = 'my-2.5',
}: SliderProps) {
  const decimals = step < 1 ? 2 : 0;
  const dragging = useRef(false);
  const id = useId();

  const handleReset = useCallback(() => {
    onChange(defaultValue);
    onCommit();
  }, [defaultValue, onChange, onCommit]);

  const active = Math.abs(value - defaultValue) > (step < 1 ? 0.001 : 0.5);
  const pct = ((value - min) / (max - min)) * 100;
  // Fill from default toward the current value (bipolar-aware).
  const defPct = ((defaultValue - min) / (max - min)) * 100;
  const fillLeft = Math.min(pct, defPct);
  const fillWidth = Math.abs(pct - defPct);

  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="cursor-default select-none text-[12px] text-text-dim"
          onDoubleClick={handleReset}
          title="Double-click to reset"
        >
          {label}
        </label>
        <input
          className={`slider-num w-[54px] appearance-none rounded border border-transparent bg-transparent px-1 py-px text-right font-[family-name:var(--font-mono)] text-[11px] tabular-nums outline-none transition-[border-color,color] duration-150 hover:border-border hover:text-text focus:border-border focus:text-text focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1 [-moz-appearance:textfield] ${
            active ? 'text-accent' : 'text-text-dim'
          }`}
          type="number"
          value={Number(value.toFixed(decimals))}
          min={min}
          max={max}
          step={step}
          aria-label={`${label} value`}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) {
              onChange(Math.min(max, Math.max(min, v)));
              onCommit();
            }
          }}
        />
      </div>
      <div className="relative flex h-[14px] items-center">
        <div className="pointer-events-none absolute inset-x-0 h-[3px] rounded-[2px] bg-track" />
        <div
          className="pointer-events-none absolute h-[3px] rounded-[2px] bg-accent/70"
          style={{ left: `${fillLeft}%`, width: `${fillWidth}%` }}
        />
        {/* Default tick for bipolar sliders */}
        {defaultValue > min && defaultValue < max && (
          <div
            className="pointer-events-none absolute top-1/2 h-2 w-px -translate-y-1/2 bg-border-strong"
            style={{ left: `${defPct}%` }}
            aria-hidden
          />
        )}
        <input
          id={id}
          className="slider-range relative z-[1] h-[14px] w-full cursor-pointer bg-transparent outline-none"
          type="range"
          value={value}
          min={min}
          max={max}
          step={step}
          onPointerDown={() => (dragging.current = true)}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          onPointerUp={() => {
            if (dragging.current) {
              dragging.current = false;
              onCommit();
            }
          }}
          onKeyUp={onCommit}
          onDoubleClick={handleReset}
        />
      </div>
    </div>
  );
}
