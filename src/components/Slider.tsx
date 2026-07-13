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
}: SliderProps) {
  const decimals = step < 1 ? 2 : 0;
  const dragging = useRef(false);

  const handleReset = useCallback(() => {
    onChange(defaultValue);
    onCommit();
  }, [defaultValue, onChange, onCommit]);

  const active = Math.abs(value - defaultValue) > (step < 1 ? 0.001 : 0.5);

  return (
    <div className="slider-row">
      <div className="slider-head">
        <span className="slider-label" onDoubleClick={handleReset} title="Double-click to reset">
          {label}
        </span>
        <input
          className={`slider-num ${active ? 'active' : ''}`}
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
        className="slider-range"
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
