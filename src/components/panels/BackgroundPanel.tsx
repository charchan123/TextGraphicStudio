'use client';

import { ImageOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ColorField } from '@/src/components/controls/ColorField';
import { SliderField } from '@/src/components/controls/SliderField';
import { ToggleRow } from '@/src/components/controls/ToggleRow';
import { SelectionEmpty } from '@/src/components/panels/SelectionEmpty';
import { useObjectEditor } from '@/src/hooks/useObjectEditor';
import { useEditorStore } from '@/src/store/editorStore';

export function BackgroundPanel() {
  const project = useEditorStore((state) => state.project);
  const selectedId = useEditorStore((state) => state.selectedId);
  const setBackgroundImage = useEditorStore((state) => state.setBackgroundImage);
  const selected = project.objects.find((object) => object.id === selectedId) ?? null;
  const editor = useObjectEditor(selectedId);

  return (
    <div className="panel-stack">
      <section className="panel-section">
        <div className="section-heading">
          <div>
            <h2>キャンバス背景画像</h2>
            <p>画像は固定され、選択や移動はできません</p>
          </div>
        </div>
        {project.backgroundImage ? (
          <div className="background-file-card">
            <div>
              <strong>{project.backgroundImage.fileName}</strong>
              <span>{project.backgroundImage.naturalWidth} × {project.backgroundImage.naturalHeight}</span>
            </div>
            <Button
              variant="destructive"
              size="sm"
              aria-label="背景画像を削除"
              onClick={() => setBackgroundImage(null)}
            >
              <ImageOff aria-hidden="true" />
              削除
            </Button>
          </div>
        ) : (
          <p className="muted-callout">上部の「背景画像」からPNG・JPG・WEBPを読み込めます。</p>
        )}
      </section>

      {!selected ? (
        <SelectionEmpty />
      ) : (
        <section className="panel-section">
          <div className="section-heading">
            <div>
              <h2>黄色いラフ背景</h2>
              <p>文字と一体で移動・拡縮・回転します</p>
            </div>
          </div>
          <ToggleRow
            label="黄色背景を表示"
            checked={selected.background.enabled}
            onCheckedChange={(enabled) => editor.commit((object) => ({
              ...object,
              background: { ...object.background, enabled },
            }))}
          />
          <ColorField
            label="背景色"
            value={selected.background.color}
            disabled={!selected.background.enabled}
            onBegin={editor.begin}
            onPreview={(color) => editor.preview((object) => ({
              ...object,
              background: { ...object.background, color },
            }))}
            onCommit={editor.finish}
          />
          <SliderField
            label="左右の余白"
            value={selected.background.paddingX}
            min={0}
            max={160}
            unit="px"
            disabled={!selected.background.enabled}
            onBegin={editor.begin}
            onPreview={(paddingX) => editor.preview((object) => ({
              ...object,
              background: { ...object.background, paddingX },
            }))}
            onCommit={editor.finish}
          />
          <SliderField
            label="上下の余白"
            value={selected.background.paddingY}
            min={0}
            max={100}
            unit="px"
            disabled={!selected.background.enabled}
            onBegin={editor.begin}
            onPreview={(paddingY) => editor.preview((object) => ({
              ...object,
              background: { ...object.background, paddingY },
            }))}
            onCommit={editor.finish}
          />
          <SliderField
            label="背景の追加角度"
            value={selected.background.rotation}
            min={-45}
            max={45}
            step={0.1}
            unit="°"
            disabled={!selected.background.enabled}
            onBegin={editor.begin}
            onPreview={(rotation) => editor.preview((object) => ({
              ...object,
              background: { ...object.background, rotation },
            }))}
            onCommit={editor.finish}
          />
          <SliderField
            label="端のラフさ"
            value={selected.background.roughness}
            min={0}
            max={1}
            step={0.05}
            disabled={!selected.background.enabled}
            onBegin={editor.begin}
            onPreview={(roughness) => editor.preview((object) => ({
              ...object,
              background: { ...object.background, roughness },
            }))}
            onCommit={editor.finish}
          />
        </section>
      )}
    </div>
  );
}
