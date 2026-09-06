'use client';

import { useEffect, useRef, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { X } from 'lucide-react';
import { useEditorStore } from '@/src/store/editorStore';
import type { ColorFieldProps } from '@/src/components/controls/ColorField';

const HEX = /^#[0-9a-f]{6}$/i;
const normalized = (value: string) => /^#[0-9a-f]{3}$/i.test(value)
  ? '#' + value.slice(1).split('').map((part) => part + part).join('').toUpperCase() : value.toUpperCase();

export function ColorHexInput({ label, value, disabled, onBegin, onPreview, onCommit, id, inPopover = false }: ColorFieldProps & { id?: string; inPopover?: boolean }) {
  const [draft, setDraft] = useState(normalized(value));
  const editing = useRef(false);
  const before = useRef(value);
  useEffect(() => { if (!editing.current) setDraft(normalized(value)); }, [value]);
  const invalid = !HEX.test(draft);
  return <input id={id} type="text" className="color-hex-input" value={draft} maxLength={7} disabled={disabled}
    aria-label={`${label}${inPopover ? 'ポップオーバー' : ''}HEX値`} aria-invalid={invalid}
    onFocus={() => { editing.current = true; before.current = value; onBegin(); }}
    onChange={(event) => {
      const raw = event.currentTarget.value;
      const next = raw.startsWith('#') ? raw : '#' + raw;
      setDraft(next);
      if (HEX.test(next)) onPreview(next.toUpperCase());
    }}
    onBlur={() => { editing.current = false; setDraft(normalized(value)); onCommit(); }}
    onKeyDown={(event) => {
      if (event.key === 'Enter') event.currentTarget.blur();
      if (event.key === 'Escape') {
        event.stopPropagation(); onPreview(before.current); setDraft(normalized(before.current)); event.currentTarget.blur();
      }
    }} />;
}

export function ColorPickerPopover(props: ColorFieldProps) {
  const { label, value, disabled = false, onBegin, onPreview, onCommit } = props;
  const palette = useEditorStore((state) => state.project.palette);
  const safeColor = HEX.test(normalized(value)) ? normalized(value) : '#000000';
  const nativePicker = useRef<HTMLInputElement>(null);
  const openNativePicker = () => {
    const input = nativePicker.current;
    if (!input) return;
    onBegin();
    try {
      if (typeof input.showPicker === 'function') input.showPicker();
      else input.click();
    } catch {
      // showPicker can be unavailable or rejected by an older browser. A
      // click from the same user gesture preserves the native fallback.
      input.click();
    }
  };
  return <Popover.Root onOpenChange={(open) => { if (!open) onCommit(); }}>
    <Popover.Trigger type="button" className="color-swatch-trigger" disabled={disabled}
      aria-label={`${label}カラーピッカー`} title={`${label}を選ぶ`} style={{ backgroundColor: safeColor }} />
    <Popover.Portal>
      <Popover.Positioner className="color-picker-positioner" side="left" align="start" sideOffset={10} collisionPadding={12}>
        <Popover.Popup className="color-picker-popover" aria-label={`${label}の色を選択`}>
          <div className="color-picker-heading"><Popover.Title>{label}</Popover.Title><Popover.Close className="color-picker-close" aria-label="カラーピッカーを閉じる" title="閉じる"><X size={16} /></Popover.Close></div>
          <fieldset className="color-palette-chips" aria-label={`${label}のパレット`}>
            <legend>基本6色</legend>
            {palette.map((color, index) => <button key={index} type="button" className="color-palette-chip"
              style={{ backgroundColor: color }} aria-label={`${label}を${color}に設定`} title={`${color}を適用`}
              onClick={() => { onBegin(); onPreview(color); onCommit(); }} />)}
          </fieldset>
          <button type="button" className="color-picker-detail" disabled={disabled} onClick={openNativePicker}>
            詳細カラーを選択…
          </button>
          <input ref={nativePicker} type="color" className="color-picker-native" tabIndex={-1}
            aria-label={`${label}詳細カラーピッカー`} value={safeColor}
            onInput={(event) => onPreview(event.currentTarget.value.toUpperCase())}
            onChange={onCommit} />
          <ColorHexInput {...props} inPopover />
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>;
}
