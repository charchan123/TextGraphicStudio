'use client';
import { useRef, useState } from 'react';
import { Download, ImageOff, RefreshCcw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SliderField } from '@/src/components/controls/SliderField';
import { SelectionEmpty } from '@/src/components/panels/SelectionEmpty';
import { TextBackgroundEditor } from '@/src/components/panels/TextBackgroundEditor';
import { exportProjectBackgroundPng } from '@/src/services/exportService';
import { loadBackgroundFile } from '@/src/services/imageService';
import { useEditorStore } from '@/src/store/editorStore';

export function BackgroundPanel() {
  const replacementInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const project = useEditorStore((state) => state.project);
  const studioProject = useEditorStore((state) => state.studioProject);
  const selectedId = useEditorStore((state) => state.selectedId);
  const beginTransaction = useEditorStore((state) => state.beginTransaction);
  const finishTransaction = useEditorStore((state) => state.finishTransaction);
  const setBackgroundImage = useEditorStore((state) => state.setBackgroundImage);
  const setCanvasBackgroundPositionY = useEditorStore((state) => state.setCanvasBackgroundPositionY);
  const setNotice = useEditorStore((state) => state.setNotice);
  const selected = project.objects.find((object) => object.id === selectedId) ?? null;
  const completedLocked = studioProject.frames.find((frame) => frame.frameId === studioProject.activeFrameId)?.completedLocked ?? false;
  const backgroundPositionY = project.backgroundImage?.positionY ?? 0;

  const exportBackground = async () => {
    setBusy(true);
    try {
      const state = useEditorStore.getState();
      const snapshot = state.getStudioProjectSnapshot();
      const frameIndex = snapshot.frames.findIndex((frame) => frame.frameId === snapshot.activeFrameId);
      if (frameIndex < 0) throw new Error('現在のコマを確認できませんでした。');
      await exportProjectBackgroundPng(snapshot.frames[frameIndex].document, frameIndex);
      setNotice('背景のみPNGを書き出しました。', 'success');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '背景のみPNGの書き出しに失敗しました。', 'error');
    } finally {
      setBusy(false);
    }
  };

  const replaceCompletedBackground = async (file: File) => {
    setBusy(true);
    try {
      const targetFrameId = useEditorStore.getState().studioProject.activeFrameId;
      const image = await loadBackgroundFile(file);
      const state = useEditorStore.getState();
      if (state.studioProject.activeFrameId !== targetFrameId) {
        throw new Error('対象のコマが切り替わったため、背景画像の差し替えを中止しました。');
      }
      const locked = state.studioProject.frames.find((frame) => frame.frameId === state.studioProject.activeFrameId)?.completedLocked ?? false;
      if (locked) throw new Error('完成ロック中のコマは背景画像を変更できません。');
      state.setBackgroundImage({ ...image, positionY: 0 });
      state.setNotice('補完済み背景へ差し替え、背景位置Yを0へ戻しました。', 'success');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '背景画像の差し替えに失敗しました。', 'error');
    } finally {
      setBusy(false);
    }
  };

  return <div className="panel-stack">
    <section className="panel-section">
      <div className="section-heading"><div><h2>キャンバス背景画像</h2><p>画像は固定され、選択や移動はできません</p></div></div>
      {project.backgroundImage ? <div className="background-file-card">
        <div className="background-file-summary"><strong title={project.backgroundImage.fileName}>{project.backgroundImage.fileName}</strong><span>{project.backgroundImage.naturalWidth} × {project.backgroundImage.naturalHeight}</span></div>
        <div className="background-file-actions">
          <Button variant="outline" size="sm" disabled={completedLocked || busy} aria-label="補完済み背景に差し替え" title="補完済み背景に差し替え" onClick={() => replacementInputRef.current?.click()}><Upload aria-hidden="true" />補完済み背景に差し替え</Button>
          <Button variant="outline" size="sm" disabled={completedLocked || busy} className="background-remove-button" aria-label="キャンバス背景画像を削除" title="キャンバス背景画像を削除" onClick={() => setBackgroundImage(null)}><ImageOff aria-hidden="true" />削除</Button>
        </div>
        <input
          ref={replacementInputRef}
          type="file"
          hidden
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) void replaceCompletedBackground(file);
          }}
        />
      </div> : <p className="muted-callout">上部の「背景画像」からPNG・JPG・WEBPを読み込めます。</p>}
      {project.backgroundImage && <>
        <SliderField
          label="背景位置Y"
          value={backgroundPositionY}
          min={-project.canvas.height}
          max={project.canvas.height}
          step={1}
          unit="px"
          disabled={completedLocked || busy}
          onBegin={beginTransaction}
          onPreview={(value) => setCanvasBackgroundPositionY(value, false)}
          onCommit={finishTransaction}
        />
        <p className="background-position-help">マイナスで上、プラスで下へ移動します。Canvas外は自動補完しません。</p>
        <div className="background-workflow-actions">
          <Button variant="outline" size="sm" disabled={completedLocked || busy || backgroundPositionY === 0} onClick={() => setCanvasBackgroundPositionY(0)}><RefreshCcw aria-hidden="true" />位置をリセット</Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void exportBackground()}><Download aria-hidden="true" />背景のみPNG</Button>
        </div>
      </>}
    </section>
    {selected ? <TextBackgroundEditor key={selected.id} selected={selected} /> : <SelectionEmpty />}
  </div>;
}
