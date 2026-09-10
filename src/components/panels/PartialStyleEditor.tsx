'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { ColorField } from '@/src/components/controls/ColorField';
import { SliderField } from '@/src/components/controls/SliderField';
import { FontFamilySelect } from '@/src/components/FontPicker';
import { useObjectEditor } from '@/src/hooks/useObjectEditor';
import {
  clearRangeStyleLeaf,
  clearRangeStyles,
  getRangeOverrideState,
  setRangeStyleLeaf,
  shiftRangeNumericLeaf,
  type PartialStyleLeaf,
} from '@/src/services/partialStyles';
import type { FillStyle, GraphicTextObject, PartialTextStyle } from '@/src/types/editor';
import { PartialStrokeEditor } from '@/src/components/panels/StrokeEditor';
import { createPartialStrokeEdits, getRangeStrokeOverrideState, strokeLayersInRange, STROKE_KEYS } from '@/src/services/strokes';
import { QuickPartialPresets } from '@/src/components/panels/QuickPartialPresets';
import { createQuickPartialOperation } from '@/src/services/quickPartialPresets';

const stateLabel = (presence: 'none' | 'all' | 'mixed'): string => presence === 'mixed' ? '（混在）' : '';

export function PartialStyleEditor({
  selected,
  start,
  end,
  expanded,
  onExpandedChange,
}: {
  selected: GraphicTextObject;
  start: number;
  end: number;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}) {
  const editor = useObjectEditor(selected.id);
  const valid = start < end && end <= selected.text.length;
  const selectionKey = selected.id + ':' + start + ':' + end;
  const [mixedXState, setMixedXState] = useState({ key: selectionKey, value: 0 });
  const mixedXDelta = mixedXState.key === selectionKey ? mixedXState.value : 0;
  const xBaseStylesRef = useRef(selected.partialStyles);
  const xStartValueRef = useRef(0);

  const fill = getRangeOverrideState(selected.partialStyles, start, end, 'fill');
  const size = getRangeOverrideState(selected.partialStyles, start, end, 'fontSize');
  const spacing = getRangeOverrideState(selected.partialStyles, start, end, 'letterSpacing');
  const glyphWidth = getRangeOverrideState(selected.partialStyles, start, end, 'glyphScaleX');
  const glyphHeight = getRangeOverrideState(selected.partialStyles, start, end, 'glyphScaleY');
  const bold = getRangeOverrideState(selected.partialStyles, start, end, 'fontWeight');
  const weightAdjust = getRangeOverrideState(selected.partialStyles, start, end, 'fontWeightAdjust');
  const font = getRangeOverrideState(selected.partialStyles, start, end, 'fontFamily');
  const fontRef = getRangeOverrideState(selected.partialStyles, start, end, 'fontRefId');
  const glyphOffsetX = getRangeOverrideState(selected.partialStyles, start, end, 'glyphOffsetX');
  const glyphOffsetY = getRangeOverrideState(selected.partialStyles, start, end, 'glyphOffsetY');

  const updateLeaf = (leaf: PartialStyleLeaf, value: unknown, preview = false) => {
    const apply = (object: GraphicTextObject): GraphicTextObject => ({
      ...object,
      partialStyles: setRangeStyleLeaf(object.partialStyles, start, end, leaf, value as never),
    });
    if (preview) editor.preview(apply); else editor.commit(apply);
  };
  const clearLeaf = (leaf: PartialStyleLeaf) => editor.commit((object) => ({
    ...object,
    partialStyles: clearRangeStyleLeaf(object.partialStyles, start, end, leaf),
  }));
  const option = (leaf: PartialStyleLeaf, label: string, fallback: unknown) => {
    const state = getRangeOverrideState(selected.partialStyles, start, end, leaf);
    const id = 'range-' + leaf;
    return <div className="checkbox-row">
      <Checkbox
        id={id}
        checked={state.presence === 'all'}
        indeterminate={state.presence === 'mixed'}
        disabled={!valid || selected.fullyLocked}
        onCheckedChange={(checked) => { if (checked) updateLeaf(leaf, state.value ?? fallback); else clearLeaf(leaf); }}
      />
      <label htmlFor={id}>{label}{stateLabel(state.presence)}</label>
    </div>;
  };

  const style: Omit<PartialTextStyle, 'start' | 'end' | 'strokes' | 'glyphOffsetX' | 'glyphOffsetY'> = {};
  if (fill.presence === 'all' && fill.value) style.fill = fill.value;
  if (size.presence === 'all') style.fontSize = size.value;
  if (spacing.presence === 'all') style.letterSpacing = spacing.value;
  if (glyphWidth.presence === 'all') style.glyphScaleX = glyphWidth.value;
  if (glyphHeight.presence === 'all') style.glyphScaleY = glyphHeight.value;
  if (bold.presence === 'all') style.fontWeight = bold.value;
  if (weightAdjust.presence === 'all') style.fontWeightAdjust = weightAdjust.value;
  if (font.presence === 'all') {
    style.fontFamily = font.value;
    if (fontRef.presence === 'all') style.fontRefId = fontRef.value;
  }
  const strokeEdits = createPartialStrokeEdits(selected, start, end);
  STROKE_KEYS.forEach((key) => {
    const enabled = getRangeStrokeOverrideState(selected.partialStyles, start, end, key, 'enabled');
    const color = getRangeStrokeOverrideState(selected.partialStyles, start, end, key, 'color');
    const width = getRangeStrokeOverrideState(selected.partialStyles, start, end, key, 'width');
    if (enabled.presence === 'all') strokeEdits[key].enabled = enabled.value ? 'on' : 'off';
    if (color.presence === 'all') { strokeEdits[key].color = 'change'; strokeEdits[key].colorValue = color.value!; }
    if (width.presence === 'all') { strokeEdits[key].width = 'change'; strokeEdits[key].widthValue = width.value!; }
  });
  const currentOperation = createQuickPartialOperation(style, strokeEdits);
  const validStrokes = strokeLayersInRange(selected, start, end)
    .every((layers) => (!layers[1].enabled || layers[0].enabled) && (!layers[2].enabled || layers[1].enabled));
  const currentFill: FillStyle = fill.value ?? selected.fill;

  const numeric = (
    leaf: PartialStyleLeaf, label: string, state: typeof size, fallback: number,
    min: number, max: number, unit: string, scale = 1,
  ) => <>
    {option(leaf, label + 'を部分適用', fallback)}
    {state.presence !== 'none' && <>
      {state.presence === 'mixed' && <p className="panel-note">現在値：混在</p>}
      <SliderField
        label={label}
        value={Number(state.value ?? fallback) * scale}
        min={min}
        max={max}
        unit={unit}
        disabled={!valid || selected.fullyLocked}
        onBegin={editor.begin}
        onPreview={(value) => updateLeaf(leaf, value / scale, true)}
        onCommit={editor.finish}
      />
    </>}
  </>;

  return <details
    className="partial-style-editor"
    open={expanded}
    onToggle={(event) => onExpandedChange(event.currentTarget.open)}
  >
    <summary>選択範囲のスタイル</summary>
    <p className="panel-note">文字範囲を選び、変更する項目だけONにします。値の操作はCanvasへ即時反映されます。</p>
    <QuickPartialPresets selected={selected} start={start} end={end} currentOperation={currentOperation} currentOperationValid={validStrokes} />
    <p className="range-selection" aria-live="polite" data-range-start={start} data-range-end={end}>
      {valid ? '選択範囲：' + (start + 1) + '–' + end + '「' + selected.text.slice(start, end) + '」' : '範囲が選択されていません'}
    </p>

    {option('fill', '文字色を部分適用', selected.fill)}
    {fill.presence !== 'none' && <div className="range-fill-controls">
      {fill.presence === 'mixed' && <p className="panel-note">現在値：混在</p>}
      <label className="field-label" htmlFor="range-fill-type">範囲の塗り</label>
      <NativeSelect id="range-fill-type" value={currentFill.type} onChange={(event) => {
        const next = event.currentTarget.value === 'solid'
          ? { type: 'solid' as const, color: currentFill.type === 'solid' ? currentFill.color : currentFill.stops[0]?.color ?? '#000000' }
          : { type: 'linear-gradient' as const, angle: 90, stops: [{ offset: 0, color: '#FFF000' }, { offset: 1, color: '#FF8500' }] };
        updateLeaf('fill', next);
      }}>
        <NativeSelectOption value="solid">単色</NativeSelectOption>
        <NativeSelectOption value="linear-gradient">1文字ずつグラデーション</NativeSelectOption>
      </NativeSelect>
      {currentFill.type === 'solid' ? <ColorField label="範囲の文字色" value={currentFill.color} onBegin={editor.begin} onPreview={(color) => updateLeaf('fill', { type: 'solid', color }, true)} onCommit={editor.finish} /> : <>
        <ColorField label="範囲の開始色" value={currentFill.stops[0]?.color ?? '#000000'} onBegin={editor.begin} onPreview={(color) => updateLeaf('fill', { ...currentFill, stops: currentFill.stops.map((stop, index) => index === 0 ? { ...stop, color } : stop) }, true)} onCommit={editor.finish} />
        <ColorField label="範囲の終了色" value={currentFill.stops.at(-1)?.color ?? '#FFFFFF'} onBegin={editor.begin} onPreview={(color) => updateLeaf('fill', { ...currentFill, stops: currentFill.stops.map((stop, index) => index === currentFill.stops.length - 1 ? { ...stop, color } : stop) }, true)} onCommit={editor.finish} />
        <SliderField label="範囲のグラデーション角度" value={currentFill.angle} min={-180} max={180} step={0.1} unit="°" onBegin={editor.begin} onPreview={(angle) => updateLeaf('fill', { ...currentFill, angle }, true)} onCommit={editor.finish} />
      </>}
    </div>}

    {numeric('fontSize', '文字サイズ', size, selected.typography.fontSize, 8, 400, 'px')}
    {numeric('letterSpacing', '文字間隔', spacing, selected.typography.letterSpacing, -40, 160, 'px')}
    {numeric('glyphScaleX', '文字幅', glyphWidth, selected.typography.glyphScaleX ?? 1, 50, 150, '%', 100)}
    {numeric('glyphScaleY', '文字高さ', glyphHeight, selected.typography.glyphScaleY ?? 1, 50, 150, '%', 100)}
    {numeric('fontWeightAdjust', '文字の太さ補正', weightAdjust, selected.typography.fontWeightAdjust ?? 0, 0, 16, 'px')}

    {option('fontWeight', '太字を部分適用', selected.typography.fontWeight)}
    {bold.presence !== 'none' && <Button type="button" variant={(bold.value ?? selected.typography.fontWeight) >= 700 ? 'default' : 'outline'} onClick={() => updateLeaf('fontWeight', (bold.value ?? selected.typography.fontWeight) >= 700 ? 400 : 900)}>
      範囲の太字 {(bold.value ?? selected.typography.fontWeight) >= 700 ? 'ON' : 'OFF'}
    </Button>}

    <div className="checkbox-row">
      <Checkbox
        id="range-fontFamily"
        checked={font.presence === 'all'}
        indeterminate={font.presence === 'mixed'}
        disabled={!valid || selected.fullyLocked}
        onCheckedChange={(checked) => {
          if (checked) {
            editor.commit((object) => {
              let partialStyles = setRangeStyleLeaf(object.partialStyles, start, end, 'fontFamily', font.value ?? selected.typography.fontFamily);
              const refId = fontRef.value ?? selected.typography.fontRefId;
              if (refId) partialStyles = setRangeStyleLeaf(partialStyles, start, end, 'fontRefId', refId);
              return { ...object, partialStyles };
            });
          } else {
            editor.commit((object) => ({
              ...object,
              partialStyles: clearRangeStyleLeaf(
                clearRangeStyleLeaf(object.partialStyles, start, end, 'fontFamily'),
                start,
                end,
                'fontRefId',
              ),
            }));
          }
        }}
      />
      <label htmlFor="range-fontFamily">フォントを部分適用{stateLabel(font.presence)}</label>
    </div>
    {font.presence !== 'none' && <div className="range-font-control">
      {font.presence === 'mixed' && <p className="panel-note">現在値：混在</p>}
      <label className="field-label" htmlFor="range-font-family">範囲のフォント</label>
      <FontFamilySelect id="range-font-family" value={font.value ?? selected.typography.fontFamily} refId={fontRef.value ?? selected.typography.fontRefId} onChange={({ family, refId }) => editor.commit((object) => {
        let partialStyles = clearRangeStyleLeaf(object.partialStyles, start, end, 'fontFamily');
        partialStyles = clearRangeStyleLeaf(partialStyles, start, end, 'fontRefId');
        partialStyles = setRangeStyleLeaf(partialStyles, start, end, 'fontFamily', family);
        if (refId) partialStyles = setRangeStyleLeaf(partialStyles, start, end, 'fontRefId', refId);
        return { ...object, partialStyles };
      })} />
    </div>}

    {option('glyphOffsetX', '文字の左右位置を部分適用', 0)}
    {glyphOffsetX.presence !== 'none' && <>
      {glyphOffsetX.presence === 'mixed' && <p className="panel-note">現在値：混在（入力値を全glyphへ差分加算）</p>}
      <SliderField
        label="文字の左右位置"
        value={glyphOffsetX.presence === 'mixed' ? mixedXDelta : Number(glyphOffsetX.value ?? 0)}
        min={-100}
        max={100}
        unit="px"
        onBegin={() => { xBaseStylesRef.current = selected.partialStyles; xStartValueRef.current = mixedXDelta; editor.begin(); }}
        onPreview={(value) => {
          setMixedXState({ key: selectionKey, value });
          if (glyphOffsetX.presence === 'mixed') {
            const base = xBaseStylesRef.current;
            const delta = value - xStartValueRef.current;
            editor.preview((object) => ({ ...object, partialStyles: shiftRangeNumericLeaf(base, start, end, 'glyphOffsetX', delta, 0) }));
          } else updateLeaf('glyphOffsetX', value, true);
        }}
        onCommit={() => { editor.finish(); setMixedXState({ key: selectionKey, value: 0 }); }}
      />
      <p className="panel-note">＋で右、－で左へ移動します。文字送りと改行位置は変わりません。</p>
    </>}
    {numeric('glyphOffsetY', '文字の上下位置', glyphOffsetY, 0, -100, 100, 'px')}

    <PartialStrokeEditor selected={selected} start={start} end={end} />
    {!validStrokes && <output className="panel-note">内側のフチをONにしてから外側のフチを使用してください。</output>}
    <Button type="button" variant="outline" className="range-reset" disabled={!valid || !selected.partialStyles.length} onClick={() => editor.commit((object) => ({ ...object, partialStyles: clearRangeStyles(object.partialStyles, start, end) }))}>
      部分スタイルをすべて解除
    </Button>
    <p className="panel-note">適用済み：{selected.partialStyles.length}範囲。挿入・置換した文字は全体設定を使います。</p>
  </details>;
}
