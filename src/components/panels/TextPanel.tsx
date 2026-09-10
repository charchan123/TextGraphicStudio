'use client';

import { useEffect, useRef, useState } from 'react';
import { Focus, MoveHorizontal, MoveVertical, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SegmentedControl } from '@/src/components/controls/SegmentedControl';
import { SliderField } from '@/src/components/controls/SliderField';
import { SelectionEmpty } from '@/src/components/panels/SelectionEmpty';
import { PartialStyleEditor } from '@/src/components/panels/PartialStyleEditor';
import { LineGapEditor } from '@/src/components/panels/LineGapEditor';
import { updateGraphicTextContent } from '@/src/services/textContent';
import { useObjectEditor } from '@/src/hooks/useObjectEditor';
import { useEditorStore } from '@/src/store/editorStore';
import type { TextAlignment } from '@/src/types/editor';

const ALIGN_OPTIONS: Array<{ value: TextAlignment; label: string }> = [
  { value: 'left', label: '左揃え' },
  { value: 'center', label: '中央' },
  { value: 'right', label: '右揃え' },
];

export function TextPanel() {
  const selectedTextRef = useRef<HTMLTextAreaElement>(null);
  const [newText, setNewText] = useState('新しいタイトル');
  const project = useEditorStore((state) => state.project);
  const selectedId = useEditorStore((state) => state.selectedId);
  const range = useEditorStore((state) => state.textSelection);
  const partialStyleExpanded = useEditorStore((state) => state.partialStyleExpanded);
  const setTextSelection = useEditorStore((state) => state.setTextSelection);
  const setPartialStyleExpanded = useEditorStore((state) => state.setPartialStyleExpanded);
  const addGraphic = useEditorStore((state) => state.addGraphic);
  const centerSelectedOnCanvas = useEditorStore((state) => state.centerSelectedOnCanvas);
  const activeFrameId = useEditorStore((state) => state.studioProject.activeFrameId);
  const selected = project.objects.find((object) => object.id === selectedId) ?? null;
  const selectedObjectId = selected?.id ?? null;
  const editor = useObjectEditor(selectedId);
  const selectionMatches = Boolean(
    range
    && selected
    && range.frameId === activeFrameId
    && range.objectId === selected.id
    && range.text === selected.text,
  );
  const activeStart = selectionMatches ? range!.start : 0;
  const activeEnd = selectionMatches ? range!.end : 0;
  useEffect(() => {
    if (!selectedObjectId || activeStart === activeEnd) return;
    selectedTextRef.current?.setSelectionRange(activeStart, activeEnd);
  }, [activeEnd, activeStart, selectedObjectId]);

  return <div className="panel-stack">
    <section className="panel-section">
      <div className="section-heading"><div><h2>本文入力</h2><p>Enterで改行できます</p></div></div>
      <Textarea value={newText} rows={3} aria-label="追加するテキスト" onChange={(event) => setNewText(event.currentTarget.value)} />
      <Button className="panel-primary-button" size="lg" disabled={!newText.trim()} onClick={() => { addGraphic(newText); setNewText('新しいタイトル'); }}>
        <Plus aria-hidden="true" />テキストを追加
      </Button>
    </section>

    {!selected ? <SelectionEmpty /> : <>
      <section className="panel-section">
        <div className="section-heading"><div><h2>選択中の本文</h2><p>{selected.name}</p></div></div>
        <Textarea
          ref={selectedTextRef}
          value={selected.text}
          rows={4}
          aria-label="選択中のテキスト内容"
          onFocus={editor.begin}
          onChange={(event) => editor.preview((object) => updateGraphicTextContent(object, event.currentTarget.value))}
          onSelect={(event) => {
            const start = event.currentTarget.selectionStart;
            const end = event.currentTarget.selectionEnd;
            if (start >= end) return;
            setTextSelection({ frameId: activeFrameId, objectId: selected.id, text: selected.text, start, end });
          }}
          onBlur={editor.finish}
        />
      </section>
      <section className="panel-section panel-section-group-start">
        <PartialStyleEditor
          selected={selected}
          start={activeStart}
          end={activeEnd}
          expanded={partialStyleExpanded}
          onExpandedChange={setPartialStyleExpanded}
        />
      </section>
      <section className="panel-section panel-section-group-start">
        <LineGapEditor selected={selected} start={activeStart} end={activeEnd} />
      </section>
      <section className="panel-section">
        <div className="section-heading"><div><h2>文字揃え</h2><p>TextObject内の行揃え</p></div></div>
        <SegmentedControl label="文字揃え" value={selected.typography.textAlign} options={ALIGN_OPTIONS} onChange={(textAlign) => editor.commit((object) => ({ ...object, typography: { ...object.typography, textAlign } }))} />
      </section>
      <section className="panel-section">
        <div className="section-heading"><div><h2>配置</h2><p>Canvas中央揃えと回転</p></div></div>
        <fieldset className="grid grid-cols-3 gap-2" aria-label="キャンバス中央揃え">
          <Button type="button" variant="outline" className="h-auto min-w-0 flex-col gap-1 px-1 py-2 text-xs" disabled={selected.locked} onClick={() => centerSelectedOnCanvas('horizontal')}><MoveHorizontal aria-hidden="true" />水平中央</Button>
          <Button type="button" variant="outline" className="h-auto min-w-0 flex-col gap-1 px-1 py-2 text-xs" disabled={selected.locked} onClick={() => centerSelectedOnCanvas('vertical')}><MoveVertical aria-hidden="true" />垂直中央</Button>
          <Button type="button" variant="outline" className="h-auto min-w-0 flex-col gap-1 px-1 py-2 text-xs" disabled={selected.locked} onClick={() => centerSelectedOnCanvas('both')}><Focus aria-hidden="true" />完全中央</Button>
        </fieldset>
        <SliderField label="グループの回転" value={selected.transform.rotation} min={-180} max={180} unit="°" onBegin={editor.begin} onPreview={(rotation) => editor.preview((object) => ({ ...object, transform: { ...object.transform, rotation } }))} onCommit={editor.finish} />
      </section>
    </>}
  </div>;
}
