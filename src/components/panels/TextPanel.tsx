'use client';

import { useState } from 'react';
import { Bold, Focus, MoveHorizontal, MoveVertical, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FontPicker } from '@/src/components/FontPicker';
import { SegmentedControl } from '@/src/components/controls/SegmentedControl';
import { SliderField } from '@/src/components/controls/SliderField';
import { SelectionEmpty } from '@/src/components/panels/SelectionEmpty';
import { PartialStyleEditor } from '@/src/components/panels/PartialStyleEditor';
import { LineGapEditor } from '@/src/components/panels/LineGapEditor';
import { updateGraphicTextContent } from '@/src/services/textContent';
import { useObjectEditor } from '@/src/hooks/useObjectEditor';
import { useEditorStore } from '@/src/store/editorStore';
import type { CharacterScaleStyle, FontStyleMode, TextAlignment } from '@/src/types/editor';

const ALIGN_OPTIONS: Array<{ value: TextAlignment; label: string }> = [
  { value: 'left', label: '左揃え' },
  { value: 'center', label: '中央' },
  { value: 'right', label: '右揃え' },
];

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

export function TextPanel() {
  const [newText, setNewText] = useState('新しいタイトル');
  const [range, setRange] = useState({ id: '', text: '', start: 0, end: 0 });
  const project = useEditorStore((state) => state.project);
  const selectedId = useEditorStore((state) => state.selectedId);
  const addGraphic = useEditorStore((state) => state.addGraphic);
  const centerSelectedOnCanvas = useEditorStore((state) => state.centerSelectedOnCanvas);
  const selected = project.objects.find((object) => object.id === selectedId) ?? null;
  const editor = useObjectEditor(selectedId);

  const addText = () => {
    addGraphic(newText);
    setNewText('新しいタイトル');
  };

  return (
    <div className="panel-stack">
      <section className="panel-section">
        <div className="section-heading">
          <div>
            <h2>テキストを追加</h2>
            <p>Enterで改行できます</p>
          </div>
        </div>
        <Textarea
          value={newText}
          rows={3}
          aria-label="追加するテキスト"
          onChange={(event) => setNewText(event.currentTarget.value)}
        />
        <Button className="panel-primary-button" size="lg" disabled={!newText.trim()} onClick={addText}>
          <Plus aria-hidden="true" />
          テキストを追加
        </Button>
      </section>

      {!selected ? (
        <SelectionEmpty />
      ) : (
        <>
          <section className="panel-section">
            <div className="section-heading">
              <div>
                <h2>選択中のテキスト</h2>
                <p>{selected.name}</p>
              </div>
            </div>
            <Textarea
              value={selected.text}
              rows={4}
              aria-label="選択中のテキスト内容"
              onFocus={editor.begin}
              onChange={(event) => {
                editor.preview((object) => updateGraphicTextContent(object, event.currentTarget.value));
              }}
              onSelect={(event) => setRange({ id: selected.id, text: selected.text, start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd })}
              onBlur={editor.finish}
            />
            <PartialStyleEditor key={`${selected.id}:${range.start}:${range.end}:${range.text === selected.text}`} selected={selected} start={range.id === selected.id && range.text === selected.text ? range.start : 0} end={range.id === selected.id && range.text === selected.text ? range.end : 0} />
            <LineGapEditor selected={selected} start={range.id === selected.id && range.text === selected.text ? range.start : 0} end={range.id === selected.id && range.text === selected.text ? range.end : 0} />
          </section>

          <section className="panel-section">
            <h2>キャンバス中央揃え</h2>
            <fieldset
              className="grid grid-cols-3 gap-2"
              aria-label="キャンバス中央揃え"
            >
              <Button
                type="button"
                variant="outline"
                className="h-auto min-w-0 flex-col gap-1 px-1 py-2 text-xs"
                aria-label="水平方向中央"
                disabled={selected.locked}
                onClick={() => centerSelectedOnCanvas('horizontal')}
              >
                <MoveHorizontal aria-hidden="true" />
                水平中央
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-auto min-w-0 flex-col gap-1 px-1 py-2 text-xs"
                aria-label="垂直方向中央"
                disabled={selected.locked}
                onClick={() => centerSelectedOnCanvas('vertical')}
              >
                <MoveVertical aria-hidden="true" />
                垂直中央
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-auto min-w-0 flex-col gap-1 px-1 py-2 text-xs"
                aria-label="完全中央"
                disabled={selected.locked}
                onClick={() => centerSelectedOnCanvas('both')}
              >
                <Focus aria-hidden="true" />
                完全中央
              </Button>
            </fieldset>
          </section>

          <section className="panel-section">
            <h2>文字組み</h2>
            <label className="field-label" htmlFor="font-family">フォント</label>
            <FontPicker
              value={selected.typography.fontFamily}
              refId={selected.typography.fontRefId}
              onChange={({ family: fontFamily, refId }) => {
                editor.commit((object) => ({
                  ...object,
                  typography: { ...object.typography, fontFamily, fontRefId: refId },
                }));
              }}
            />

            <Button
              type="button"
              variant={selected.typography.fontWeight >= 700 ? 'default' : 'outline'}
              className="bold-toggle"
              aria-pressed={selected.typography.fontWeight >= 700}
              onClick={() => editor.commit((object) => ({
                ...object,
                typography: {
                  ...object.typography,
                  fontWeight: object.typography.fontWeight >= 700 ? 400 : 900,
                },
              }))}
            >
              <Bold aria-hidden="true" />
              太字
            </Button>

            <SegmentedControl
              label="字形の傾き"
              value={selected.typography.fontStyle ?? 'normal'}
              options={FONT_STYLE_OPTIONS}
              onChange={(fontStyle) => editor.commit((object) => ({
                ...object,
                typography: {
                  ...object.typography,
                  fontStyle,
                  slant: fontStyle === 'slant' && !object.typography.slant ? 12 : object.typography.slant,
                },
              }))}
            />
            {selected.typography.fontStyle === 'slant' && <SliderField
              label="スラント角度"
              value={selected.typography.slant ?? 12}
              min={-25}
              max={25}
              step={0.5}
              unit="°"
              onBegin={editor.begin}
              onPreview={(slant) => editor.preview((object) => ({
                ...object,
                typography: { ...object.typography, slant },
              }))}
              onCommit={editor.finish}
            />}

            <SliderField
              label="文字サイズ"
              value={selected.typography.fontSize}
              min={8}
              max={400}
              unit="px"
              onBegin={editor.begin}
              onPreview={(fontSize) => editor.preview((object) => ({
                ...object,
                typography: { ...object.typography, fontSize },
              }))}
              onCommit={editor.finish}
            />
            <SliderField
              label="文字間隔"
              value={selected.typography.letterSpacing}
              min={-40}
              max={160}
              unit="px"
              onBegin={editor.begin}
              onPreview={(letterSpacing) => editor.preview((object) => ({
                ...object,
                typography: { ...object.typography, letterSpacing },
              }))}
              onCommit={editor.finish}
            />
            <SliderField
              label="行間"
              value={selected.typography.lineHeight}
              min={0.5}
              max={3}
              step={0.05}
              onBegin={editor.begin}
              onPreview={(lineHeight) => editor.preview((object) => ({
                ...object,
                typography: { ...object.typography, lineHeight },
              }))}
              onCommit={editor.finish}
            />
            <SliderField
              label="文字幅"
              value={(selected.typography.glyphScaleX ?? 1) * 100}
              min={50}
              max={150}
              step={1}
              unit="%"
              onBegin={editor.begin}
              onPreview={(percent) => editor.preview((object) => ({
                ...object,
                typography: { ...object.typography, glyphScaleX: percent / 100 },
              }))}
              onCommit={editor.finish}
            />
            <SliderField
              label="文字高さ"
              value={(selected.typography.glyphScaleY ?? 1) * 100}
              min={50}
              max={150}
              step={1}
              unit="%"
              onBegin={editor.begin}
              onPreview={(percent) => editor.preview((object) => ({
                ...object,
                typography: { ...object.typography, glyphScaleY: percent / 100 },
              }))}
              onCommit={editor.finish}
            />
            <details className="character-scale-editor">
              <summary>文字種別サイズ倍率</summary>
              <p className="panel-note">部分文字サイズが未指定の文字だけ、基本文字サイズへ倍率を適用します。</p>
              <div className="character-scale-fields">
                {CHARACTER_SCALE_FIELDS.map(({ key, label }) => <SliderField
                  key={key}
                  label={label}
                  value={(selected.characterScale[key] ?? 1) * 100}
                  min={50}
                  max={150}
                  step={1}
                  unit="%"
                  onBegin={editor.begin}
                  onPreview={(percent) => editor.preview((object) => ({
                    ...object,
                    characterScale: { ...object.characterScale, [key]: percent / 100 },
                  }))}
                  onCommit={editor.finish}
                />)}
              </div>
            </details>
            <SegmentedControl
              label="文字揃え"
              value={selected.typography.textAlign}
              options={ALIGN_OPTIONS}
              onChange={(textAlign) => editor.commit((object) => ({
                ...object,
                typography: { ...object.typography, textAlign },
              }))}
            />
            <SliderField
              label="グループの回転"
              value={selected.transform.rotation}
              min={-180}
              max={180}
              unit="°"
              onBegin={editor.begin}
              onPreview={(rotation) => editor.preview((object) => ({
                ...object,
                transform: { ...object.transform, rotation },
              }))}
              onCommit={editor.finish}
            />
          </section>
        </>
      )}
    </div>
  );
}
