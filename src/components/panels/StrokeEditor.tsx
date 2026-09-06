'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { ColorField } from '@/src/components/controls/ColorField';
import { SliderField } from '@/src/components/controls/SliderField';
import { ToggleRow } from '@/src/components/controls/ToggleRow';
import { useObjectEditor } from '@/src/hooks/useObjectEditor';
import { getStrokeLayers, mergeStrokePatch, strokeLayersInRange, STROKE_KEYS, updateStrokeLayer } from '@/src/services/strokes';
import type { GraphicTextObject, PartialStrokeLayers, StrokeStyle } from '@/src/types/editor';

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

export function PartialStrokeEditor({ selected, start, end, patch, onChange }: { selected: GraphicTextObject; start: number; end: number; patch: PartialStrokeLayers; onChange: (patch: PartialStrokeLayers) => void }) {
  const ranges = strokeLayersInRange(selected, start, end).map((layers) => mergeStrokePatch(layers, patch));
  const defaults = ranges[0];
  const change = (key: typeof STROKE_KEYS[number], property: keyof StrokeStyle, value: boolean | string | number | undefined) => {
    const index = STROKE_KEYS.indexOf(key);
    if (property === 'enabled' && value === true && index > 0 && !ranges.every((layers) => layers[index - 1].enabled)) return;
    const next = { ...patch[key], [property]: value };
    const clean = Object.fromEntries(Object.entries(next).filter(([, item]) => item !== undefined));
    const updated = { ...patch };
    if (Object.keys(clean).length) updated[key] = clean; else delete updated[key];
    if (property === 'enabled' && value === false) {
      for (let outer = index + 1; outer < 3; outer += 1) updated[STROKE_KEYS[outer]] = { ...updated[STROKE_KEYS[outer]], enabled: false };
    }
    onChange(updated);
  };
  return <div className="partial-stroke-section"><h3>フチを部分適用</h3><p className="panel-note">チェックした項目だけを上書きします。内側OFF時は外側もOFF。外側ONには選択範囲すべてで内側ONが必要です。</p>
    {STROKE_KEYS.map((key, index) => {
      const layer = { ...defaults[index], enabled: ranges.every((layers) => layers[index].enabled) };
      const option = (property: keyof StrokeStyle, label: string) => <div className="checkbox-row"><Checkbox id={`range-stroke-${key}-${property}`} checked={patch[key]?.[property] !== undefined} onCheckedChange={(checked) => change(key, property, checked ? layer[property] : undefined)} /><label htmlFor={`range-stroke-${key}-${property}`}>{`フチ${key}の${label}を部分適用`}</label></div>;
      return <details key={key} className="stroke-editor" data-partial-stroke-layer={key}><summary><span>フチ{key}</span><span className="stroke-summary">{patch[key] ? '指定あり' : '継承'}</span></summary><div className="stroke-details">
        {option('enabled', '使用状態')}{patch[key]?.enabled !== undefined && <ToggleRow label={`範囲のフチ${key}を使用`} checked={layer.enabled} disabled={index > 0 && !ranges.every((layers) => layers[index - 1].enabled)} onCheckedChange={(value) => change(key, 'enabled', value)} />}
        {option('color', '色')}{patch[key]?.color !== undefined && <ColorField label={`範囲のフチ${key}の色`} value={layer.color} onBegin={noop} onPreview={(value) => change(key, 'color', value)} onCommit={noop} />}
        {option('width', '幅')}{patch[key]?.width !== undefined && <SliderField label={`範囲のフチ${key}の幅`} value={layer.width} min={0} max={40} unit="px" onBegin={noop} onPreview={(value) => change(key, 'width', value)} onCommit={noop} />}
      </div></details>;
    })}
  </div>;
}
