'use client';
import { ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SelectionEmpty } from '@/src/components/panels/SelectionEmpty';
import { TextBackgroundEditor } from '@/src/components/panels/TextBackgroundEditor';
import { useEditorStore } from '@/src/store/editorStore';

export function BackgroundPanel() {
  const project = useEditorStore((state) => state.project);
  const selectedId = useEditorStore((state) => state.selectedId);
  const setBackgroundImage = useEditorStore((state) => state.setBackgroundImage);
  const selected = project.objects.find((object) => object.id === selectedId) ?? null;
  return <div className="panel-stack">
    <section className="panel-section">
      <div className="section-heading"><div><h2>キャンバス背景画像</h2><p>画像は固定され、選択や移動はできません</p></div></div>
      {project.backgroundImage ? <div className="background-file-card"><div><strong>{project.backgroundImage.fileName}</strong><span>{project.backgroundImage.naturalWidth} × {project.backgroundImage.naturalHeight}</span></div><Button variant="destructive" size="sm" aria-label="背景画像を削除" onClick={() => setBackgroundImage(null)}><ImageOff aria-hidden="true" />削除</Button></div> : <p className="muted-callout">上部の「背景画像」からPNG・JPG・WEBPを読み込めます。</p>}
    </section>
    {selected ? <TextBackgroundEditor key={selected.id} selected={selected} /> : <SelectionEmpty />}
  </div>;
}
