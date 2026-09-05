'use client';

import { useState } from 'react';
import { Bold, Focus, MoveHorizontal, MoveVertical, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { FONT_OPTIONS } from '@/src/constants/editor';
import { SegmentedControl } from '@/src/components/controls/SegmentedControl';
import { SliderField } from '@/src/components/controls/SliderField';
import { SelectionEmpty } from '@/src/components/panels/SelectionEmpty';
import { PartialStyleEditor } from '@/src/components/panels/PartialStyleEditor';
import { adjustRangesForTextEdit } from '@/src/services/partialStyles';
import { useObjectEditor } from '@/src/hooks/useObjectEditor';
import { useEditorStore } from '@/src/store/editorStore';
import type { TextAlignment } from '@/src/types/editor';

const ALIGN_OPTIONS: Array<{ value: TextAlignment; label: string }> = [
  { value: 'left', label: '左揃え' },
  { value: 'center', label: '中央' },
  { value: 'right', label: '右揃え' },
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
                const text = event.currentTarget.value.replace(/\r\n?/g, '\n');
                editor.preview((object) => ({ ...object, text, partialStyles: adjustRangesForTextEdit(object.text, text, object.partialStyles) }));
              }}
              onSelect={(event) => setRange({ id: selected.id, text: selected.text, start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd })}
              onBlur={editor.finish}
            />
            <PartialStyleEditor key={selected.id} selected={selected} start={range.id === selected.id && range.text === selected.text ? range.start : 0} end={range.id === selected.id && range.text === selected.text ? range.end : 0} />
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
            <NativeSelect
              id="font-family"
              className="w-full"
              value={selected.typography.fontFamily}
              onChange={(event) => {
                const fontFamily = event.currentTarget.value;
                editor.commit((object) => ({
                  ...object,
                  typography: { ...object.typography, fontFamily },
                }));
              }}
            >
              {FONT_OPTIONS.map((font) => (
                <NativeSelectOption key={font.value} value={font.value}>{font.label}</NativeSelectOption>
              ))}
            </NativeSelect>

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
