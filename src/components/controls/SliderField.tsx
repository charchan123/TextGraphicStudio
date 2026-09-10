'use client';

import { useRef, useState } from 'react';

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

const numericDraftPattern = /^-?(?:\d+)?(?:\.\d*)?$/;

// Remove floating-point display noise (for example 110.00000000000001) without
// changing the value passed to preview/persistence. While editing, the draft is
// shown verbatim so intermediate input such as `110.` remains stable.
const formatValue = (value: number): string => {
  const compact = Number(value.toPrecision(12));
  return String(Object.is(compact, -0) ? 0 : compact);
};

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
  const [draft, setDraft] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const editStartValueRef = useRef(value);
  const cancelNextBlurRef = useRef(false);
  const displayedValue = draft ?? formatValue(value);

  const updateDraft = (nextDraft: string) => {
    draftRef.current = nextDraft;
    setDraft(nextDraft);
  };

  const stopEditing = () => {
    draftRef.current = null;
    setDraft(null);
  };

  const commitDraft = () => {
    const currentDraft = draftRef.current;
    const parsed = currentDraft === null || currentDraft === '' ? Number.NaN : Number(currentDraft);
    if (!Number.isFinite(parsed)) {
      stopEditing();
      onCommit();
      return;
    }

    const nextValue = clamp(parsed);
    stopEditing();
    onPreview(nextValue);
    onCommit();
  };

  return (
    <div className="slider-field">
      <div className="control-row">
        <label>{label}</label>
        <div className="number-with-unit">
          <input
            type="text"
            inputMode="decimal"
            role="spinbutton"
            value={displayedValue}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={
              Number.isFinite(Number(displayedValue)) && displayedValue !== ''
                ? Number(displayedValue)
                : undefined
            }
            disabled={disabled}
            aria-label={`${label}の数値`}
            onFocus={() => {
              editStartValueRef.current = value;
              cancelNextBlurRef.current = false;
              updateDraft(formatValue(value));
              onBegin();
            }}
            onChange={(event) => {
              const nextDraft = event.currentTarget.value;
              if (numericDraftPattern.test(nextDraft)) {
                updateDraft(nextDraft);
                const parsed = Number(nextDraft);
                if (nextDraft !== '' && nextDraft !== '-' && Number.isFinite(parsed)) onPreview(clamp(parsed));
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.currentTarget.blur();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                cancelNextBlurRef.current = true;
                updateDraft(formatValue(editStartValueRef.current));
                onPreview(editStartValueRef.current);
                event.currentTarget.blur();
              }
            }}
            onBlur={() => {
              if (cancelNextBlurRef.current) {
                cancelNextBlurRef.current = false;
                stopEditing();
                onCommit();
                return;
              }
              commitDraft();
            }}
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
