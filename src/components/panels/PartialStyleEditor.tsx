'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { ColorField } from '@/src/components/controls/ColorField';
import { SliderField } from '@/src/components/controls/SliderField';
import { FontFamilySelect } from '@/src/components/FontPicker';
import { useObjectEditor } from '@/src/hooks/useObjectEditor';
import { clearRangeStyles } from '@/src/services/partialStyles';
import type { GraphicTextObject, PartialTextStyle } from '@/src/types/editor';
import { PartialStrokeEditor } from '@/src/components/panels/StrokeEditor';
import { applyPartialStrokeEdits, createPartialStrokeEdits, hasPartialStrokeEdits, strokeLayersInRange } from '@/src/services/strokes';

const noop = () => undefined;
export function PartialStyleEditor({ selected, start, end }: { selected: GraphicTextObject; start: number; end: number }) {
  const editor = useObjectEditor(selected.id);
  const [strokeEdits, setStrokeEdits] = useState(() => createPartialStrokeEdits(selected, start, end));
  const [fillType, setFillType] = useState<'solid' | 'linear-gradient'>('solid');
  const [color, setColor] = useState('#D20A11');
  const [gradientEnd, setGradientEnd] = useState('#F08A16');
  const [gradientAngle, setGradientAngle] = useState(90);
  const [size, setSize] = useState(selected.typography.fontSize);
  const [spacing, setSpacing] = useState(selected.typography.letterSpacing);
  const [glyphWidth, setGlyphWidth] = useState((selected.typography.glyphScaleX ?? 1) * 100);
  const [glyphHeight, setGlyphHeight] = useState((selected.typography.glyphScaleY ?? 1) * 100);
  const [bold, setBold] = useState(true);
  const [font, setFont] = useState({ family: selected.typography.fontFamily, refId: selected.typography.fontRefId });
  const [enabled, setEnabled] = useState({ fill: true, size: false, spacing: false, glyphWidth: false, glyphHeight: false, bold: false, font: false });
  const valid = start < end && end <= selected.text.length;
  const simulatedStyles = applyPartialStrokeEdits(selected.partialStyles, start, end, strokeEdits);
  const validStrokes = strokeLayersInRange({ ...selected, partialStyles: simulatedStyles }, start, end)
    .every((layers) => (!layers[1].enabled || layers[0].enabled) && (!layers[2].enabled || layers[1].enabled));
  const option = (key: keyof typeof enabled, label: string) => <div className="checkbox-row"><Checkbox id={`range-${key}`} checked={enabled[key]} onCheckedChange={(checked) => setEnabled((value) => ({ ...value, [key]: Boolean(checked) }))} /><label htmlFor={`range-${key}`}>{label}</label></div>;
  return <details className="partial-style-editor" open={valid}>
    <summary>選択範囲にスタイルを適用</summary>
    <p className="panel-note">上のテキスト欄で文字を選択してください。部分設定は全体設定より優先されます。</p>
    <p className="range-selection" aria-live="polite" data-range-start={start} data-range-end={end}>{valid ? `選択範囲：${start + 1}–${end}「${selected.text.slice(start, end)}」` : '範囲が選択されていません'}</p>
    {option('fill', '文字色を部分適用')}
    {enabled.fill && <div className="range-fill-controls">
      <label className="field-label" htmlFor="range-fill-type">範囲の塗り</label>
      <NativeSelect id="range-fill-type" aria-label="範囲の塗り" value={fillType} onChange={(event) => setFillType(event.currentTarget.value as typeof fillType)}>
        <NativeSelectOption value="solid">単色</NativeSelectOption>
        <NativeSelectOption value="linear-gradient">1文字ずつグラデーション</NativeSelectOption>
      </NativeSelect>
      {fillType === 'solid' ? <ColorField label="範囲の文字色" value={color} onBegin={noop} onPreview={setColor} onCommit={noop} /> : <>
        <ColorField label="範囲の開始色" value={color} onBegin={noop} onPreview={setColor} onCommit={noop} />
        <ColorField label="範囲の終了色" value={gradientEnd} onBegin={noop} onPreview={setGradientEnd} onCommit={noop} />
        <SliderField label="範囲のグラデーション角度" value={gradientAngle} min={-180} max={180} step={0.1} unit="°" onBegin={noop} onPreview={setGradientAngle} onCommit={noop} />
        <Button type="button" variant="outline" className="range-reset" onClick={() => setFillType('solid')}>範囲のグラデーションを単色へ戻す</Button>
      </>}
    </div>}
    {option('size', '文字サイズを部分適用')}
    {enabled.size && <SliderField label="範囲の文字サイズ" value={size} min={8} max={400} unit="px" onBegin={noop} onPreview={setSize} onCommit={noop} />}
    {option('spacing', '文字間隔を部分適用')}
    {enabled.spacing && <SliderField label="範囲の文字間隔" value={spacing} min={-40} max={160} unit="px" onBegin={noop} onPreview={setSpacing} onCommit={noop} />}
    {option('glyphWidth', '文字幅を部分適用')}
    {enabled.glyphWidth && <SliderField label="範囲の文字幅" value={glyphWidth} min={50} max={150} unit="%" onBegin={noop} onPreview={setGlyphWidth} onCommit={noop} />}
    {option('glyphHeight', '文字高さを部分適用')}
    {enabled.glyphHeight && <SliderField label="範囲の文字高さ" value={glyphHeight} min={50} max={150} unit="%" onBegin={noop} onPreview={setGlyphHeight} onCommit={noop} />}
    {option('bold', '太字を部分適用')}
    {enabled.bold && <Button variant={bold ? 'default' : 'outline'} aria-pressed={bold} onClick={() => setBold(!bold)}>範囲の太字 {bold ? 'ON' : 'OFF'}</Button>}
    {option('font', 'フォントを部分適用')}
    {enabled.font && <div className="range-font-control">
      <label className="field-label" htmlFor="range-font-family">範囲のフォント</label>
      <FontFamilySelect id="range-font-family" ariaLabel="範囲のフォント" value={font.family} refId={font.refId} onChange={({ family, refId }) => setFont({ family, refId })} />
    </div>}
    <PartialStrokeEditor selected={selected} start={start} end={end} edits={strokeEdits} onChange={setStrokeEdits} />
    {!validStrokes && <output className="panel-note">内側のフチをONにするか、外側の使用状態の指定を解除してください。</output>}
    <div className="inline-actions">
      <Button disabled={!valid || !validStrokes || (!Object.values(enabled).some(Boolean) && !hasPartialStrokeEdits(strokeEdits))} onClick={() => {
        const style: PartialTextStyle = { start, end };
        if (enabled.fill) style.fill = fillType === 'solid'
          ? { type: 'solid', color }
          : { type: 'linear-gradient', angle: gradientAngle, stops: [{ offset: 0, color }, { offset: 1, color: gradientEnd }] };
        if (enabled.size) style.fontSize = size;
        if (enabled.spacing) style.letterSpacing = spacing;
        if (enabled.glyphWidth) style.glyphScaleX = glyphWidth / 100;
        if (enabled.glyphHeight) style.glyphScaleY = glyphHeight / 100;
        if (enabled.bold) style.fontWeight = bold ? 900 : 400;
        if (enabled.font) { style.fontFamily = font.family; style.fontRefId = font.refId; }
        const hasGeneralStyle = Object.keys(style).some((key) => key !== 'start' && key !== 'end');
        editor.commit((object) => {
          const withStrokeEdits = applyPartialStrokeEdits(object.partialStyles, start, end, strokeEdits);
          return { ...object, partialStyles: hasGeneralStyle ? [...withStrokeEdits, style] : withStrokeEdits };
        });
        setStrokeEdits(createPartialStrokeEdits(selected, start, end));
      }}>選択範囲に適用</Button>
      <Button variant="outline" disabled={!valid || !selected.partialStyles.length} onClick={() => editor.commit((object) => ({ ...object, partialStyles: clearRangeStyles(object.partialStyles, start, end) }))}>選択範囲を解除</Button>
    </div>
    <Button className="range-reset" variant="ghost" disabled={!selected.partialStyles.length} onClick={() => editor.commit((object) => ({ ...object, partialStyles: [] }))}>部分スタイルをすべて解除</Button>
    <p className="panel-note">適用済み：{selected.partialStyles.length}範囲。挿入・置換した文字は全体設定を使います。</p>
  </details>;
}
