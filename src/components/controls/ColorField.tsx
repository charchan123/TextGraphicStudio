'use client';

import { useId } from 'react';
import { ColorPickerPopover, ColorHexInput } from '@/src/components/controls/ColorPickerPopover';

export interface ColorFieldProps {
  label: string;
  value: string;
  disabled?: boolean;
  onBegin: () => void;
  onPreview: (value: string) => void;
  onCommit: () => void;
}

export function ColorField(props: ColorFieldProps) {
  const fieldId = useId();
  return <div className="color-field">
    <label htmlFor={`${fieldId}-hex`}>{props.label}</label>
    <div className="color-input-row">
      <ColorPickerPopover {...props} />
      <ColorHexInput {...props} id={`${fieldId}-hex`} />
    </div>
  </div>;
}
