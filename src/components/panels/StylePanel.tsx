'use client';

import { ColorField } from '@/src/components/controls/ColorField';
import { SliderField } from '@/src/components/controls/SliderField';
import { ToggleRow } from '@/src/components/controls/ToggleRow';
import { SelectionEmpty } from '@/src/components/panels/SelectionEmpty';
import { useObjectEditor } from '@/src/hooks/useObjectEditor';
import { useEditorStore } from '@/src/store/editorStore';

export function StylePanel() {
  const project = useEditorStore((state) => state.project);
  const selectedId = useEditorStore((state) => state.selectedId);
  const selected = project.objects.find((object) => object.id === selectedId) ?? null;
  const editor = useObjectEditor(selectedId);

  if (!selected) return <SelectionEmpty />;
  const fillColor = selected.fill.type === 'solid' ? selected.fill.color : '#000000';

  return (
    <div className="panel-stack">
      <section className="panel-section">
        <div className="section-heading">
          <div>
            <h2>文字色</h2>
            <p>文字本体の塗り色</p>
          </div>
        </div>
        <ColorField
          label="文字色"
          value={fillColor}
          onBegin={editor.begin}
          onPreview={(color) => editor.preview((object) => ({ ...object, fill: { type: 'solid', color } }))}
          onCommit={editor.finish}
        />
      </section>

      <section className="panel-section">
        <h2>白フチ</h2>
        <ToggleRow
          label="白フチを使用"
          description="文字の読みやすさを保つ内側のフチ"
          checked={selected.stroke.enabled}
          onCheckedChange={(enabled) => editor.commit((object) => ({
            ...object,
            stroke: { ...object.stroke, enabled },
          }))}
        />
        <ColorField
          label="白フチの色"
          value={selected.stroke.color}
          disabled={!selected.stroke.enabled}
          onBegin={editor.begin}
          onPreview={(color) => editor.preview((object) => ({
            ...object,
            stroke: { ...object.stroke, color },
          }))}
          onCommit={editor.finish}
        />
        <SliderField
          label="白フチの幅"
          value={selected.stroke.width}
          min={0}
          max={40}
          unit="px"
          disabled={!selected.stroke.enabled}
          onBegin={editor.begin}
          onPreview={(width) => editor.preview((object) => ({
            ...object,
            stroke: { ...object.stroke, width },
          }))}
          onCommit={editor.finish}
        />
      </section>

      <section className="panel-section">
        <h2>黒フチ</h2>
        <ToggleRow
          label="黒フチを使用"
          description="白フチの外側に重ねる太い輪郭"
          checked={selected.outerStroke.enabled}
          onCheckedChange={(enabled) => editor.commit((object) => ({
            ...object,
            outerStroke: { ...object.outerStroke, enabled },
          }))}
        />
        <ColorField
          label="黒フチの色"
          value={selected.outerStroke.color}
          disabled={!selected.outerStroke.enabled}
          onBegin={editor.begin}
          onPreview={(color) => editor.preview((object) => ({
            ...object,
            outerStroke: { ...object.outerStroke, color },
          }))}
          onCommit={editor.finish}
        />
        <SliderField
          label="黒フチの幅"
          value={selected.outerStroke.width}
          min={0}
          max={40}
          unit="px"
          disabled={!selected.outerStroke.enabled}
          onBegin={editor.begin}
          onPreview={(width) => editor.preview((object) => ({
            ...object,
            outerStroke: { ...object.outerStroke, width },
          }))}
          onCommit={editor.finish}
        />
      </section>

      <section className="panel-section">
        <h2>影</h2>
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
    </div>
  );
}
