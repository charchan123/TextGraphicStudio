'use client';

import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { ColorField } from '@/src/components/controls/ColorField';
import { SliderField } from '@/src/components/controls/SliderField';
import { ToggleRow } from '@/src/components/controls/ToggleRow';
import { useObjectEditor } from '@/src/hooks/useObjectEditor';
import { applyPartialStrokeEdits, getStrokeLayers, strokeLayersInRange, STROKE_KEYS, updateStrokeLayer, type PartialStrokeEdits } from '@/src/services/strokes';
import type { GraphicTextObject } from '@/src/types/editor';

const noop = () => undefined;
export function StrokeEditor({ selected }: { selected: GraphicTextObject }) {
  const editor = useObjectEditor(selected.id);
  const layers = getStrokeLayers(selected);
  return <section className="panel-section stroke-section"><h2>フチ</h2>
    <p className="panel-note">フチ1が最内周、フチ3が最外周。外側は内側がONのとき使えます。OFFにしても色・幅は残ります。</p>
    {layers.map((layer, index) => <details key={index} className="stroke-editor" data-stroke-layer={index + 1}>
      <summary><span>フチ{index + 1}</span><span className="stroke-summary"><i style={{ background: layer.color }} />{layer.enabled ? `${layer.width} px` : 'OFF'}</span></summary>
      <div className="stroke-details">
        <ToggleRow label={`フチ${index + 1}を使用`} checked={layer.enabled} disabled={index > 0 && !layers[index - 1].enabled} onCheckedChange={(enabled) => editor.commit((object) => updateStrokeLayer(object, index, { enabled }))} />
        <ColorField label={`フチ${index + 1}の色`} value={layer.color} disabled={!layer.enabled} onBegin={editor.begin} onPreview={(color) => editor.preview((object) => updateStrokeLayer(object, index, { color }))} onCommit={editor.finish} />
        <SliderField label={`フチ${index + 1}の幅`} value={layer.width} min={0} max={40} unit="px" disabled={!layer.enabled} onBegin={editor.begin} onPreview={(width) => editor.preview((object) => updateStrokeLayer(object, index, { width }))} onCommit={editor.finish} />
      </div>
    </details>)}
  </section>;
}

export function PartialStrokeEditor({ selected, start, end, edits, onChange }: { selected: GraphicTextObject; start: number; end: number; edits: PartialStrokeEdits; onChange: (edits: PartialStrokeEdits) => void }) {
  const previewModel = { ...selected, partialStyles: applyPartialStrokeEdits(selected.partialStyles, start, end, edits) };
  const ranges = strokeLayersInRange(previewModel, start, end);
  const update = (key: typeof STROKE_KEYS[number], patch: Partial<PartialStrokeEdits[typeof key]>) => {
    const index = STROKE_KEYS.indexOf(key);
    const updated: PartialStrokeEdits = { ...edits, [key]: { ...edits[key], ...patch } };
    const globalLayerIsOff = !getStrokeLayers(selected)[index].enabled;
    if (patch.enabled === 'off' || (patch.enabled === 'inherit' && globalLayerIsOff)) {
      for (let outer = index + 1; outer < STROKE_KEYS.length; outer += 1) {
        const outerKey = STROKE_KEYS[outer];
        updated[outerKey] = { ...updated[outerKey], enabled: 'off' };
      }
    }
    onChange(updated);
  };
  return <div className="partial-stroke-section"><h3>部分フチ設定</h3><p className="panel-note">「変更しない」は現在の部分指定を保持し、「全体設定を使用」はその項目の部分指定だけを解除します。</p>
    {STROKE_KEYS.map((key, index) => {
      const edit = edits[key];
      const active = ranges.map((layers) => layers[index]);
      const effective = active.every((layer) => layer.enabled) ? 'ON' : active.every((layer) => !layer.enabled) ? 'OFF' : '混在';
      const definitelyOff = effective === 'OFF';
      const parentOn = index === 0 || ranges.every((layers) => layers[index - 1].enabled);
      return <details key={key} className="stroke-editor partial-stroke-editor" data-partial-stroke-layer={key}><summary><span>フチ{key}</span><span className="stroke-summary">実効：{effective}</span></summary><div className="stroke-details">
        <label className="field-label" htmlFor={`range-stroke-${key}-enabled`}>使用状態</label>
        <NativeSelect id={`range-stroke-${key}-enabled`} aria-label={`フチ${key}の使用状態`} value={edit.enabled} onChange={(event) => update(key, { enabled: event.currentTarget.value as typeof edit.enabled })}>
          <NativeSelectOption value="keep">変更しない</NativeSelectOption>
          <NativeSelectOption value="inherit">全体設定を使用</NativeSelectOption>
          <NativeSelectOption value="on" disabled={!parentOn}>この範囲でON</NativeSelectOption>
          <NativeSelectOption value="off">この範囲でOFF</NativeSelectOption>
        </NativeSelect>
        <label className="field-label" htmlFor={`range-stroke-${key}-color-mode`}>色</label>
        <NativeSelect id={`range-stroke-${key}-color-mode`} aria-label={`フチ${key}の色設定`} value={edit.color} disabled={definitelyOff} onChange={(event) => update(key, { color: event.currentTarget.value as typeof edit.color })}>
          <NativeSelectOption value="keep">変更しない</NativeSelectOption>
          <NativeSelectOption value="inherit">全体設定を使用</NativeSelectOption>
          <NativeSelectOption value="change">この範囲で変更</NativeSelectOption>
        </NativeSelect>
        {edit.color === 'change' && <ColorField label={`範囲のフチ${key}の色`} value={edit.colorValue} disabled={definitelyOff} onBegin={noop} onPreview={(colorValue) => update(key, { colorValue })} onCommit={noop} />}
        <label className="field-label" htmlFor={`range-stroke-${key}-width-mode`}>幅</label>
        <NativeSelect id={`range-stroke-${key}-width-mode`} aria-label={`フチ${key}の幅設定`} value={edit.width} disabled={definitelyOff} onChange={(event) => update(key, { width: event.currentTarget.value as typeof edit.width })}>
          <NativeSelectOption value="keep">変更しない</NativeSelectOption>
          <NativeSelectOption value="inherit">全体設定を使用</NativeSelectOption>
          <NativeSelectOption value="change">この範囲で変更</NativeSelectOption>
        </NativeSelect>
        {edit.width === 'change' && <SliderField label={`範囲のフチ${key}の幅`} value={edit.widthValue} min={0} max={40} unit="px" disabled={definitelyOff} onBegin={noop} onPreview={(widthValue) => update(key, { widthValue })} onCommit={noop} />}
      </div></details>;
    })}
  </div>;
}
