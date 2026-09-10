'use client';

import { useRef } from 'react';
import { Bold, Download, RotateCcw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ColorField } from '@/src/components/controls/ColorField';
import { SegmentedControl } from '@/src/components/controls/SegmentedControl';
import { SliderField } from '@/src/components/controls/SliderField';
import { ToggleRow } from '@/src/components/controls/ToggleRow';
import { SelectionEmpty } from '@/src/components/panels/SelectionEmpty';
import { useObjectEditor } from '@/src/hooks/useObjectEditor';
import { useEditorStore } from '@/src/store/editorStore';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { PaletteEditor } from '@/src/components/PaletteEditor';
import { StrokeEditor } from '@/src/components/panels/StrokeEditor';
import { FontPicker } from '@/src/components/FontPicker';
import { downloadTextDefaultsFile, readTextDefaultsFile } from '@/src/services/textDefaultsFileService';
import { toProjectTextDefaults } from '@/src/services/textDefaults';
import type { CharacterScaleStyle, FontStyleMode } from '@/src/types/editor';

const FONT_STYLE_OPTIONS: Array<{ value: FontStyleMode; label: string }> = [
  { value: 'normal', label: '通常' },
  { value: 'italic', label: '斜体' },
  { value: 'slant', label: 'スラント' },
];

const CHARACTER_SCALE_FIELDS: Array<{ key: keyof CharacterScaleStyle; label: string }> = [
  { key: 'kanji', label: '漢字' },
  { key: 'hiragana', label: 'ひらがな' },
  { key: 'katakana', label: 'カタカナ' },
  { key: 'number', label: '数字' },
  { key: 'latin', label: '英字' },
  { key: 'symbol', label: '記号' },
];

export function StylePanel() {
  const defaultsInputRef = useRef<HTMLInputElement>(null);
  const project = useEditorStore((state) => state.project);
  const studioProject = useEditorStore((state) => state.studioProject);
  const selectedId = useEditorStore((state) => state.selectedId);
  const selected = project.objects.find((object) => object.id === selectedId) ?? null;
  const editor = useObjectEditor(selectedId);
  const setProjectTextDefaults = useEditorStore((state) => state.setProjectTextDefaults);
  const setNotice = useEditorStore((state) => state.setNotice);

  if (!selected) return <SelectionEmpty />;
  const fillColor = selected.fill.type === 'solid' ? selected.fill.color : '#000000';

  return (
    <div className="panel-stack">
      <section className="panel-section">
        <div className="section-heading"><div><h2>書体</h2><p>フォントと文字形状</p></div></div>
        <label className="field-label" htmlFor="font-family">フォント</label>
        <FontPicker value={selected.typography.fontFamily} refId={selected.typography.fontRefId} onChange={({ family: fontFamily, refId }) => editor.commit((object) => ({ ...object, typography: { ...object.typography, fontFamily, fontRefId: refId } }))} />
        <Button type="button" variant={selected.typography.fontWeight >= 700 ? 'default' : 'outline'} className="bold-toggle" aria-pressed={selected.typography.fontWeight >= 700} onClick={() => editor.commit((object) => ({ ...object, typography: { ...object.typography, fontWeight: object.typography.fontWeight >= 700 ? 400 : 900 } }))}>
          <Bold aria-hidden="true" />太字
        </Button>
        <SegmentedControl label="字形の傾き" value={selected.typography.fontStyle ?? 'normal'} options={FONT_STYLE_OPTIONS} onChange={(fontStyle) => editor.commit((object) => ({ ...object, typography: { ...object.typography, fontStyle, slant: fontStyle === 'slant' && !object.typography.slant ? 12 : object.typography.slant } }))} />
        {selected.typography.fontStyle === 'slant' && <SliderField label="スラント角度" value={selected.typography.slant ?? 12} min={-25} max={25} step={0.5} unit="°" onBegin={editor.begin} onPreview={(slant) => editor.preview((object) => ({ ...object, typography: { ...object.typography, slant } }))} onCommit={editor.finish} />}
        <SliderField label="文字の太さ補正" value={selected.typography.fontWeightAdjust ?? 0} min={0} max={16} unit="px" onBegin={editor.begin} onPreview={(fontWeightAdjust) => editor.preview((object) => ({ ...object, typography: { ...object.typography, fontWeightAdjust } }))} onCommit={editor.finish} />
        <Button type="button" variant="outline" className="range-reset" disabled={(selected.typography.fontWeightAdjust ?? 0) === 0} onClick={() => editor.commit((object) => ({ ...object, typography: { ...object.typography, fontWeightAdjust: 0 } }))}>
          <RotateCcw aria-hidden="true" />文字の太さ補正をリセット
        </Button>
      </section>

      <section className="panel-section">
        <div className="section-heading"><div><h2>サイズ・文字組み</h2><p>文字サイズ、間隔、比率</p></div></div>
        <SliderField label="文字サイズ" value={selected.typography.fontSize} min={8} max={400} unit="px" onBegin={editor.begin} onPreview={(fontSize) => editor.preview((object) => ({ ...object, typography: { ...object.typography, fontSize } }))} onCommit={editor.finish} />
        <SliderField label="文字間隔" value={selected.typography.letterSpacing} min={-40} max={160} unit="px" onBegin={editor.begin} onPreview={(letterSpacing) => editor.preview((object) => ({ ...object, typography: { ...object.typography, letterSpacing } }))} onCommit={editor.finish} />
        <SliderField label="行間" value={selected.typography.lineHeight} min={0.5} max={3} step={0.05} onBegin={editor.begin} onPreview={(lineHeight) => editor.preview((object) => ({ ...object, typography: { ...object.typography, lineHeight } }))} onCommit={editor.finish} />
        <SliderField label="文字幅" value={(selected.typography.glyphScaleX ?? 1) * 100} min={50} max={150} unit="%" onBegin={editor.begin} onPreview={(value) => editor.preview((object) => ({ ...object, typography: { ...object.typography, glyphScaleX: value / 100 } }))} onCommit={editor.finish} />
        <SliderField label="文字高さ" value={(selected.typography.glyphScaleY ?? 1) * 100} min={50} max={150} unit="%" onBegin={editor.begin} onPreview={(value) => editor.preview((object) => ({ ...object, typography: { ...object.typography, glyphScaleY: value / 100 } }))} onCommit={editor.finish} />
        <details className="character-scale-editor"><summary>文字種別サイズ倍率</summary><div className="character-scale-fields">
          {CHARACTER_SCALE_FIELDS.map(({ key, label }) => <SliderField key={key} label={label} value={(selected.characterScale[key] ?? 1) * 100} min={50} max={150} unit="%" onBegin={editor.begin} onPreview={(value) => editor.preview((object) => ({ ...object, characterScale: { ...object.characterScale, [key]: value / 100 } }))} onCommit={editor.finish} />)}
        </div></details>
      </section>

      <PaletteEditor />
      <section className="panel-section">
        <div className="section-heading">
          <div>
            <h2>塗り</h2>
            <p>文字本体の単色とグラデーション</p>
          </div>
        </div>
        <label className="field-label" htmlFor="text-fill-type">文字の塗り</label>
        <NativeSelect id="text-fill-type" value={selected.fill.type} onChange={(event) => {
          const type = event.currentTarget.value;
          editor.commit((object) => ({ ...object, fill: type === 'solid' ? { type: 'solid', color: object.fill.type === 'solid' ? object.fill.color : object.fill.stops[0]?.color ?? '#000000' } : { type: 'linear-gradient', angle: 90, stops: [{ offset: 0, color: '#FFF000' }, { offset: 1, color: '#FF8500' }] } }));
        }}>
          <NativeSelectOption value="solid">単色</NativeSelectOption>
          <NativeSelectOption value="linear-gradient">線形グラデーション</NativeSelectOption>
        </NativeSelect>
        {selected.fill.type === 'solid' ?
        <ColorField
          label="文字色"
          value={fillColor}
          onBegin={editor.begin}
          onPreview={(color) => editor.preview((object) => ({ ...object, fill: { type: 'solid', color } }))}
          onCommit={editor.finish}
        />
        : <>
          {[{ index: 0, label: '開始色' }, { index: selected.fill.stops.length - 1, label: '終了色' }].map(({ index, label }) => <ColorField key={label} label={label} value={selected.fill.type === 'linear-gradient' ? selected.fill.stops[index].color : '#000000'} onBegin={editor.begin} onPreview={(color) => editor.preview((object) => object.fill.type === 'linear-gradient' ? { ...object, fill: { ...object.fill, stops: object.fill.stops.map((stop, stopIndex) => stopIndex === index ? { ...stop, color } : stop) } } : object)} onCommit={editor.finish} />)}
          <SliderField label="グラデーション角度" value={selected.fill.angle} min={-180} max={180} step={0.1} unit="°" onBegin={editor.begin} onPreview={(angle) => editor.preview((object) => object.fill.type === 'linear-gradient' ? { ...object, fill: { ...object.fill, angle } } : object)} onCommit={editor.finish} />
          <p className="panel-note">0°は左から右、90°は上から下。部分指定した文字色が優先されます。</p>
        </>}
      </section>

      <StrokeEditor selected={selected} />

      <section className="panel-section">
        <div className="section-heading"><div><h2>影</h2><p>文字外形に奥行きを追加</p></div></div>
        <ToggleRow
          label="影を使用"
          description="フチの外側に奥行きを追加"
          checked={selected.shadow.enabled}
          onCheckedChange={(enabled) => editor.commit((object) => ({
            ...object,
            shadow: { ...object.shadow, enabled },
          }))}
        />
        <ColorField
          label="影の色"
          value={selected.shadow.color}
          disabled={!selected.shadow.enabled}
          onBegin={editor.begin}
          onPreview={(color) => editor.preview((object) => ({
            ...object,
            shadow: { ...object.shadow, color },
          }))}
          onCommit={editor.finish}
        />
        <SliderField
          label="影の濃さ"
          value={selected.shadow.opacity * 100}
          min={0}
          max={100}
          unit="%"
          disabled={!selected.shadow.enabled}
          onBegin={editor.begin}
          onPreview={(opacity) => editor.preview((object) => ({
            ...object,
            shadow: { ...object.shadow, opacity: opacity / 100 },
          }))}
          onCommit={editor.finish}
        />
        <SliderField
          label="影のぼかし"
          value={selected.shadow.blur}
          min={0}
          max={50}
          unit="px"
          disabled={!selected.shadow.enabled}
          onBegin={editor.begin}
          onPreview={(blur) => editor.preview((object) => ({
            ...object,
            shadow: { ...object.shadow, blur },
          }))}
          onCommit={editor.finish}
        />
        <SliderField
          label="影の横位置"
          value={selected.shadow.offsetX}
          min={-100}
          max={100}
          unit="px"
          disabled={!selected.shadow.enabled}
          onBegin={editor.begin}
          onPreview={(offsetX) => editor.preview((object) => ({
            ...object,
            shadow: { ...object.shadow, offsetX },
          }))}
          onCommit={editor.finish}
        />
        <SliderField
          label="影の縦位置"
          value={selected.shadow.offsetY}
          min={-100}
          max={100}
          unit="px"
          disabled={!selected.shadow.enabled}
          onBegin={editor.begin}
          onPreview={(offsetY) => editor.preview((object) => ({
            ...object,
            shadow: { ...object.shadow, offsetY },
          }))}
          onCommit={editor.finish}
        />
      </section>

      <section className="panel-section panel-section-group-start">
        <div className="section-heading"><div><h2>Project共通Text基本設定</h2><p>既存Textは変更せず、今後追加するTextへ使用します</p></div></div>
        <div className="inline-actions">
          <Button type="button" variant="outline" onClick={() => {
            const defaults = studioProject.projectTextDefaults ?? toProjectTextDefaults(selected);
            const references = defaults.typography.fontRefId
              ? project.fontCatalog.filter((font) => font.id === defaults.typography.fontRefId)
              : [];
            downloadTextDefaultsFile(defaults, studioProject.projectName, references);
          }}><Download aria-hidden="true" />基本設定を書き出し</Button>
          <Button type="button" variant="outline" onClick={() => defaultsInputRef.current?.click()}><Upload aria-hidden="true" />基本設定を読み込み</Button>
        </div>
        <input ref={defaultsInputRef} className="sr-only" type="file" accept=".tgsstyle.json,.json,application/json" aria-label="Text基本設定ファイル" onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (!file) return;
          void readTextDefaultsFile(file).then(({ defaults, fontReferences }) => {
            setProjectTextDefaults(defaults, fontReferences);
            const reference = fontReferences.find((font) => font.id === defaults.typography.fontRefId);
            const missing = Boolean(defaults.typography.fontRefId && (!reference || reference.source === 'file'));
            setNotice(missing ? '基本設定を読み込みました。保存済みfontがこの環境に無いため、代替fontで表示される場合があります。' : '基本設定を読み込みました。今後追加するTextへ使用します。', missing ? 'warning' : 'success');
          }).catch((error) => setNotice(error instanceof Error ? error.message : '基本設定を読み込めませんでした。', 'error'));
        }} />
      </section>
    </div>
  );
}
