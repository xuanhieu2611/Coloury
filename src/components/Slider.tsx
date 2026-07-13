'use client';

import { useCallback, useRef } from 'react';

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
  className = 'my-[9px]',
}: SliderProps) {
  const decimals = step < 1 ? 2 : 0;
  const dragging = useRef(false);

  const handleReset = useCallback(() => {
    onChange(defaultValue);
    onCommit();
  }, [defaultValue, onChange, onCommit]);

  const active = Math.abs(value - defaultValue) > (step < 1 ? 0.001 : 0.5);

  return (
    <div className={className}>
      <div className="mb-[3px] flex items-center justify-between">
        <span
          className="cursor-default select-none text-text-dim"
          onDoubleClick={handleReset}
          title="Double-click to reset"
        >
          {label}
        </span>
        <input
          className={`slider-num w-[54px] appearance-none rounded border border-transparent bg-transparent px-1 py-px text-right text-xs outline-none hover:border-border hover:text-text focus:border-border focus:text-text [-moz-appearance:textfield] ${
            active ? 'text-accent' : 'text-text-dim'
          }`}
          type="number"
          value={Number(value.toFixed(decimals))}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) {
              onChange(Math.min(max, Math.max(min, v)));
              onCommit();
            }
          }}
        />
      </div>
      <input
        className="slider-range h-[3px] w-full rounded-[2px] bg-track outline-none"
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
  );
}
