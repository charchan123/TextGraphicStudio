'use client';

import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Checkbox } from '@/components/ui/checkbox';
import { ColorField } from '@/src/components/controls/ColorField';
import { SliderField } from '@/src/components/controls/SliderField';
import { ToggleRow } from '@/src/components/controls/ToggleRow';
import { useObjectEditor } from '@/src/hooks/useObjectEditor';
import {
  clearRangeStrokeLeaf,
  getRangeStrokeOverrideState,
  getStrokeLayers,
  setRangeStrokeLeaf,
  strokeLayersInRange,
  STROKE_KEYS,
  updateStrokeLayer,
} from '@/src/services/strokes';
import type { GraphicTextObject } from '@/src/types/editor';

export function StrokeEditor({ selected }: { selected: GraphicTextObject }) {
  const editor = useObjectEditor(selected.id);
  const layers = getStrokeLayers(selected);
  return <section className="panel-section stroke-section">
    <div className="section-heading"><div><h2>フチ</h2><p>フチ1が最内周、フチ3が最外周</p></div></div>
    <p className="panel-note">外側は内側がONのとき使えます。OFFにしても色・幅は残ります。</p>
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

export function PartialStrokeEditor({ selected, start, end }: { selected: GraphicTextObject; start: number; end: number }) {
  const editor = useObjectEditor(selected.id);
  const ranges = strokeLayersInRange(selected, start, end);
  const valid = start < end && end <= selected.text.length;
  const update = (
    key: typeof STROKE_KEYS[number],
    property: 'enabled' | 'color' | 'width',
    value: boolean | string | number,
    preview = false,
  ) => {
    const apply = (object: GraphicTextObject): GraphicTextObject => ({
      ...object,
      partialStyles: setRangeStrokeLeaf(object.partialStyles, start, end, key, property, value as never),
    });
    if (preview) editor.preview(apply); else editor.commit(apply);
  };
  const clear = (key: typeof STROKE_KEYS[number], property: 'enabled' | 'color' | 'width') =>
    editor.commit((object) => ({
      ...object,
      partialStyles: clearRangeStrokeLeaf(object.partialStyles, start, end, key, property),
    }));
  return <div className="partial-stroke-section"><h3>部分フチ設定</h3><p className="panel-note">各checkboxをOFFにすると、その項目だけ全体設定へ戻ります。</p>
    {STROKE_KEYS.map((key, index) => {
      const active = ranges.map((layers) => layers[index]);
      const effective = active.every((layer) => layer.enabled) ? 'ON' : active.every((layer) => !layer.enabled) ? 'OFF' : '混在';
      const definitelyOff = effective === 'OFF';
      const parentOn = index === 0 || ranges.every((layers) => layers[index - 1].enabled);
      const enabledState = getRangeStrokeOverrideState(selected.partialStyles, start, end, key, 'enabled');
      const colorState = getRangeStrokeOverrideState(selected.partialStyles, start, end, key, 'color');
      const widthState = getRangeStrokeOverrideState(selected.partialStyles, start, end, key, 'width');
      const fallback = active[0] ?? getStrokeLayers(selected)[index];
      const option = (
        property: 'enabled' | 'color' | 'width',
        label: string,
        state: { presence: 'none' | 'all' | 'mixed' },
      ) => <div className="checkbox-row">
        <Checkbox
          id={`range-stroke-${key}-${property}`}
          checked={state.presence === 'all'}
          indeterminate={state.presence === 'mixed'}
          disabled={!valid}
          onCheckedChange={(checked) => {
            if (!checked) clear(key, property);
            else update(key, property, property === 'enabled' ? fallback.enabled : property === 'color' ? fallback.color : fallback.width);
          }}
        />
        <label htmlFor={`range-stroke-${key}-${property}`}>{label}{state.presence === 'mixed' ? '（混在）' : ''}</label>
      </div>;
      return <details key={key} className="stroke-editor partial-stroke-editor" data-partial-stroke-layer={key}><summary><span>フチ{key}</span><span className="stroke-summary">実効：{effective}</span></summary><div className="stroke-details">
        {option('enabled', `フチ${key}の使用状態を部分適用`, enabledState)}
        {enabledState.presence !== 'none' && <NativeSelect aria-label={`フチ${key}の使用状態`} value={String(enabledState.value ?? fallback.enabled)} disabled={!parentOn && !enabledState.value} onChange={(event) => update(key, 'enabled', event.currentTarget.value === 'true')}>
          <NativeSelectOption value="true">ON</NativeSelectOption>
          <NativeSelectOption value="false">OFF</NativeSelectOption>
        </NativeSelect>}
        {option('color', `フチ${key}の色を部分適用`, colorState)}
        {colorState.presence !== 'none' && <ColorField label={`範囲のフチ${key}の色`} value={colorState.value ?? fallback.color} disabled={definitelyOff} onBegin={editor.begin} onPreview={(color) => update(key, 'color', color, true)} onCommit={editor.finish} />}
        {option('width', `フチ${key}の幅を部分適用`, widthState)}
        {widthState.presence !== 'none' && <>
          {widthState.presence === 'mixed' && <p className="panel-note">現在値：混在</p>}
          <SliderField label={`範囲のフチ${key}の幅`} value={widthState.value ?? fallback.width} min={0} max={40} unit="px" disabled={definitelyOff} onBegin={editor.begin} onPreview={(width) => update(key, 'width', width, true)} onCommit={editor.finish} />
        </>}
      </div></details>;
    })}
  </div>;
}
