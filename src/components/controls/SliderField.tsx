'use client';

import { Slider } from '@/components/ui/slider';

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  onBegin: () => void;
  onPreview: (value: number) => void;
  onCommit: () => void;
}

const readSliderValue = (value: number | readonly number[]): number =>
  typeof value === 'number' ? value : value[0] ?? 0;

export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  disabled = false,
  onBegin,
  onPreview,
  onCommit,
}: SliderFieldProps) {
  const clamp = (nextValue: number) => Math.min(max, Math.max(min, nextValue));
  return (
    <div className="slider-field">
      <div className="control-row">
        <label>{label}</label>
        <div className="number-with-unit">
          <input
            type="number"
            value={Number.isInteger(step) ? Math.round(value) : value}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            aria-label={`${label}の数値`}
            onFocus={onBegin}
            onChange={(event) => onPreview(clamp(event.currentTarget.valueAsNumber || 0))}
            onBlur={onCommit}
          />
          {unit && <span>{unit}</span>}
        </div>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={label}
        onPointerDown={onBegin}
        onKeyDown={onBegin}
        onValueChange={(nextValue) => onPreview(clamp(readSliderValue(nextValue)))}
        onValueCommitted={onCommit}
      />
    </div>
  );
}
