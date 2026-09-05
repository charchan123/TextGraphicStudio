'use client';

import { useId, useState } from 'react';
import { useEditorStore } from '@/src/store/editorStore';

interface ColorFieldProps {
  label: string;
  value: string;
  disabled?: boolean;
  onBegin: () => void;
  onPreview: (value: string) => void;
  onCommit: () => void;
}

const HEX_PATTERN = /^#[0-9A-F]{6}$/i;

export function ColorField({
  label,
  value,
  disabled = false,
  onBegin,
  onPreview,
  onCommit,
}: ColorFieldProps) {
  const fieldId = useId();
  const [invalid, setInvalid] = useState(false);
  const palette = useEditorStore((state) => state.project.palette);

  const updateDraft = (nextValue: string) => {
    const prefixed = nextValue.startsWith('#') ? nextValue : `#${nextValue}`;
    const valid = HEX_PATTERN.test(prefixed);
    setInvalid(!valid);
    if (valid) onPreview(prefixed.toUpperCase());
  };

  return (
    <div className="color-field">
      <label htmlFor={`${fieldId}-hex`}>{label}</label>
      <div className="color-input-row">
        <input
          type="color"
          value={HEX_PATTERN.test(value) ? value : '#000000'}
          disabled={disabled}
          aria-label={`${label}カラーピッカー`}
          onPointerDown={onBegin}
          onInput={(event) => updateDraft(event.currentTarget.value)}
          onChange={onCommit}
        />
        <input
          id={`${fieldId}-hex`}
          type="text"
          key={value}
          defaultValue={value.toUpperCase()}
          disabled={disabled}
          aria-label={`${label}HEX値`}
          aria-invalid={invalid}
          maxLength={7}
          onFocus={onBegin}
          onChange={(event) => updateDraft(event.currentTarget.value)}
          onBlur={(event) => {
            if (invalid) event.currentTarget.value = value.toUpperCase();
            setInvalid(false);
            onCommit();
          }}
        />
      </div>
      <fieldset className="color-palette-chips" aria-label={`${label}のパレット`}>
        <legend className="sr-only">{label}のパレット</legend>
        {palette.map((color, index) => (
          <button
            key={`${color}-${index}`}
            type="button"
            className="color-palette-chip"
            style={{ backgroundColor: color }}
            disabled={disabled}
            aria-label={`${label}を${color}に設定`}
            title={`${color}を適用`}
            onClick={() => {
              onBegin();
              onPreview(color);
              onCommit();
              setInvalid(false);
            }}
          />
        ))}
      </fieldset>
      {invalid && <span className="field-error">6桁のHEX値を入力してください</span>}
    </div>
  );
}
