'use client';

import {
  ArrowDown,
  ArrowUp,
  BringToFront,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  SendToBack,
  Trash2,
  Unlock,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useEditorStore } from '@/src/store/editorStore';

export function LayerPanel() {
  const project = useEditorStore((state) => state.project);
  const selectedId = useEditorStore((state) => state.selectedId);
  const selectObject = useEditorStore((state) => state.selectObject);
  const updateObject = useEditorStore((state) => state.updateObject);
  const beginTransaction = useEditorStore((state) => state.beginTransaction);
  const finishTransaction = useEditorStore((state) => state.finishTransaction);
  const toggleVisibility = useEditorStore((state) => state.toggleObjectVisibility);
  const toggleLock = useEditorStore((state) => state.toggleObjectLock);
  const toggleFullLock = useEditorStore((state) => state.toggleObjectFullLock);
  const frameLocked = useEditorStore((state) => state.studioProject.frames.find((frame) => frame.frameId === state.studioProject.activeFrameId)?.completedLocked ?? false);
  const deleteObject = useEditorStore((state) => state.deleteObject);
  const moveLayer = useEditorStore((state) => state.moveLayer);
  const selected = project.objects.find((object) => object.id === selectedId) ?? null;

  return (
    <div className="panel-stack layer-panel">
      <section className="panel-section layer-list-section">
        <div className="section-heading">
          <div>
            <h2>テキストレイヤー</h2>
            <p>上にある項目ほど手前に表示されます</p>
          </div>
          <span className="count-badge">{project.objects.length}</span>
        </div>

        {project.objects.length === 0 ? (
          <p className="muted-callout">テキストを追加すると、ここにレイヤーが表示されます。</p>
        ) : (
          <div className="layer-list">
            {[...project.objects].reverse().map((object) => (
              <div
                key={object.id}
                className={`layer-row${selectedId === object.id ? ' is-selected' : ''}${!object.visible ? ' is-hidden' : ''}`}
              >
                <button
                  type="button"
                  className="layer-select-button"
                  aria-label={`${object.name}を選択`}
                  onClick={() => selectObject(object.id)}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title={object.visible ? '非表示にする' : '表示する'}
                  aria-label={`${object.name}を${object.visible ? '非表示' : '表示'}にする`}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={() => toggleVisibility(object.id)}
                >
                  {object.visible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
                </Button>
                <input
                  type="text"
                  value={object.name}
                  disabled={frameLocked || object.fullyLocked}
                  aria-label="レイヤー名"
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    selectObject(object.id);
                  }}
                  onFocus={beginTransaction}
                  onChange={(event) => {
                    const name = event.currentTarget.value;
                    updateObject(object.id, (item) => ({ ...item, name }), false);
                  }}
                  onBlur={finishTransaction}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title={object.locked ? '位置ロックを解除' : '位置ロック'}
                  aria-label={`${object.name}の位置ロックを${object.locked ? '解除' : '有効化'}`}
                  disabled={frameLocked || object.fullyLocked}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={() => toggleLock(object.id)}
                >
                  {object.locked ? <Lock aria-hidden="true" /> : <Unlock aria-hidden="true" />}
                </Button>
                <Button
                  variant={object.fullyLocked ? 'secondary' : 'ghost'}
                  size="icon-sm"
                  title={object.fullyLocked ? '完全ロックを解除' : '完全ロック'}
                  aria-label={`${object.name}の完全ロックを${object.fullyLocked ? '解除' : '有効化'}`}
                  disabled={frameLocked}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={() => toggleFullLock(object.id)}
                >
                  <ShieldCheck aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="layer-delete"
                  title="削除"
                  aria-label={`${object.name}を削除`}
                  disabled={frameLocked || object.fullyLocked}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={() => deleteObject(object.id)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel-section">
        <h2>重なり順</h2>
        <div className="layer-order-grid">
          <Button variant="outline" disabled={!selected || frameLocked || selected.fullyLocked} onClick={() => selected && moveLayer(selected.id, 'front')}>
            <BringToFront aria-hidden="true" />最前面へ
          </Button>
          <Button variant="outline" disabled={!selected || frameLocked || selected.fullyLocked} onClick={() => selected && moveLayer(selected.id, 'forward')}>
            <ArrowUp aria-hidden="true" />前面へ
          </Button>
          <Button variant="outline" disabled={!selected || frameLocked || selected.fullyLocked} onClick={() => selected && moveLayer(selected.id, 'backward')}>
            <ArrowDown aria-hidden="true" />背面へ
          </Button>
          <Button variant="outline" disabled={!selected || frameLocked || selected.fullyLocked} onClick={() => selected && moveLayer(selected.id, 'back')}>
            <SendToBack aria-hidden="true" />最背面へ
          </Button>
        </div>
      </section>
    </div>
  );
}
