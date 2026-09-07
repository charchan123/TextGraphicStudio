'use client';

import { Button } from '@/components/ui/button';
import { SliderField } from '@/src/components/controls/SliderField';
import { useObjectEditor } from '@/src/hooks/useObjectEditor';
import { getLineGapTarget, normalizeLineGapOffsets } from '@/src/services/lineGapOffsets';
import type { GraphicTextObject } from '@/src/types/editor';

export function LineGapEditor({ selected, start, end }: { selected: GraphicTextObject; start: number; end: number }) {
  const editor = useObjectEditor(selected.id);
  const target = getLineGapTarget(selected.text, start, end);
  const offsets = normalizeLineGapOffsets(selected.text, selected.lineGapOffsets);
  const value = target.enabled ? offsets[target.boundaryIndex] ?? 0 : 0;
  const disabled = !target.enabled || selected.locked;
  const update = (nextValue: number) => (object: GraphicTextObject): GraphicTextObject => {
    if (!target.enabled) return object;
    const next = normalizeLineGapOffsets(object.text, object.lineGapOffsets);
    next[target.boundaryIndex] = nextValue;
    return { ...object, lineGapOffsets: next };
  };

  return (
    <div className="line-gap-editor" data-line-gap-enabled={target.enabled}>
      <div className="line-gap-heading">
        <div><h3>行間の個別調整</h3><p>全体行間へ、選択した行境界の補正を加えます。</p></div>
        <Button type="button" size="sm" variant="outline" disabled={disabled || value === 0} onClick={() => editor.commit(update(0))}>0に戻す</Button>
      </div>
      <p className="line-gap-target">
        {target.enabled
          ? `対象：${target.fromLine}行目 → ${target.toLine}行目`
          : target.reason === 'multiline'
            ? '行間を調整する場合は、1つの行内にカーソルまたは選択範囲を置いてください。'
            : '対象：最終行のため調整できません'}
      </p>
      <SliderField
        label="間隔補正"
        value={value}
        min={-100}
        max={100}
        unit="px"
        disabled={disabled}
        onBegin={editor.begin}
        onPreview={(nextValue) => editor.preview(update(nextValue))}
        onCommit={editor.finish}
      />
      <p className="panel-note">＋で広げる、－で狭める。後続する行をまとめて移動します。</p>
    </div>
  );
}
