'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ColorField } from '@/src/components/controls/ColorField';
import { SliderField } from '@/src/components/controls/SliderField';
import { useObjectEditor } from '@/src/hooks/useObjectEditor';
import { clearRangeStyles } from '@/src/services/partialStyles';
import type { GraphicTextObject, PartialTextStyle } from '@/src/types/editor';

const noop = () => undefined;
export function PartialStyleEditor({ selected, start, end }: { selected: GraphicTextObject; start: number; end: number }) {
  const editor = useObjectEditor(selected.id);
  const [color, setColor] = useState('#D20A11');
  const [size, setSize] = useState(selected.typography.fontSize);
  const [spacing, setSpacing] = useState(selected.typography.letterSpacing);
  const [bold, setBold] = useState(true);
  const [enabled, setEnabled] = useState({ color: true, size: false, spacing: false, bold: false });
  const valid = start < end && end <= selected.text.length;
  const option = (key: keyof typeof enabled, label: string) => <div className="checkbox-row"><Checkbox id={`range-${key}`} checked={enabled[key]} onCheckedChange={(checked) => setEnabled((value) => ({ ...value, [key]: Boolean(checked) }))} /><label htmlFor={`range-${key}`}>{label}</label></div>;
  return <details className="partial-style-editor" open={valid}>
    <summary>選択範囲にスタイルを適用</summary>
    <p className="panel-note">上のテキスト欄で文字を選択してください。部分設定は全体設定より優先されます。</p>
    <p className="range-selection" aria-live="polite" data-range-start={start} data-range-end={end}>{valid ? `選択範囲：${start + 1}–${end}「${selected.text.slice(start, end)}」` : '範囲が選択されていません'}</p>
    {option('color', '文字色を部分適用')}
    {enabled.color && <ColorField label="範囲の文字色" value={color} onBegin={noop} onPreview={setColor} onCommit={noop} />}
    {option('size', '文字サイズを部分適用')}
    {enabled.size && <SliderField label="範囲の文字サイズ" value={size} min={8} max={400} unit="px" onBegin={noop} onPreview={setSize} onCommit={noop} />}
    {option('spacing', '文字間隔を部分適用')}
    {enabled.spacing && <SliderField label="範囲の文字間隔" value={spacing} min={-40} max={160} unit="px" onBegin={noop} onPreview={setSpacing} onCommit={noop} />}
    {option('bold', '太字を部分適用')}
    {enabled.bold && <Button variant={bold ? 'default' : 'outline'} aria-pressed={bold} onClick={() => setBold(!bold)}>範囲の太字 {bold ? 'ON' : 'OFF'}</Button>}
    <div className="inline-actions">
      <Button disabled={!valid || !Object.values(enabled).some(Boolean)} onClick={() => {
        const style: PartialTextStyle = { start, end };
        if (enabled.color) style.fill = { type: 'solid', color };
        if (enabled.size) style.fontSize = size;
        if (enabled.spacing) style.letterSpacing = spacing;
        if (enabled.bold) style.fontWeight = bold ? 900 : 400;
        editor.commit((object) => ({ ...object, partialStyles: [...object.partialStyles, style] }));
      }}>選択範囲に適用</Button>
      <Button variant="outline" disabled={!valid || !selected.partialStyles.length} onClick={() => editor.commit((object) => ({ ...object, partialStyles: clearRangeStyles(object.partialStyles, start, end) }))}>選択範囲を解除</Button>
    </div>
    <Button className="range-reset" variant="ghost" disabled={!selected.partialStyles.length} onClick={() => editor.commit((object) => ({ ...object, partialStyles: [] }))}>部分スタイルをすべて解除</Button>
    <p className="panel-note">適用済み：{selected.partialStyles.length}範囲。挿入・置換した文字は全体設定を使います。</p>
  </details>;
}
