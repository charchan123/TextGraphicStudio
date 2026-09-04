'use client';

import { Button } from '@/components/ui/button';

interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  options: SegmentOption<T>[];
  disabled?: boolean;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  disabled = false,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="segmented-field">
      <span>{label}</span>
      <fieldset className="segmented-control">
        <legend className="sr-only">{label}</legend>
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={value === option.value ? 'default' : 'outline'}
            aria-pressed={value === option.value}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </fieldset>
    </div>
  );
}
