'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, GripVertical, LockKeyhole, Plus, Trash2, UnlockKeyhole } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { renderProjectThumbnailDataUrl } from '@/src/services/exportService';
import { getFrameDisplayLabel } from '@/src/services/frameLabels';
import { useClientHydrated } from '@/src/hooks/useClientHydrated';
import { useEditorStore } from '@/src/store/editorStore';

export type StoryboardPlacement = 'left' | 'top' | 'hidden';

export function Storyboard({
  placement,
  collapsed,
  onCollapsedChange,
}: {
  placement: Exclude<StoryboardPlacement, 'hidden'>;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const clientHydrated = useClientHydrated();
  const studioProject = useEditorStore((state) => state.studioProject);
  const activeDocument = useEditorStore((state) => state.project);
  const setProjectName = useEditorStore((state) => state.setProjectName);
  const addFrame = useEditorStore((state) => state.addFrame);
  const duplicateFrame = useEditorStore((state) => state.duplicateFrame);
  const deleteFrame = useEditorStore((state) => state.deleteFrame);
  const reorderFrame = useEditorStore((state) => state.reorderFrame);
  const selectFrame = useEditorStore((state) => state.selectFrame);
  const setFrameCompletedLocked = useEditorStore((state) => state.setFrameCompletedLocked);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<string | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const revisions = useRef(new Map<string, string>());
  const dragIndex = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        for (const frame of studioProject.frames) {
          if (cancelled) return;
          const document = frame.frameId === studioProject.activeFrameId ? activeDocument : frame.document;
          const revision = document.updatedAt;
          if (revisions.current.get(frame.frameId) === revision) continue;
          try {
            const url = await renderProjectThumbnailDataUrl(document);
            if (cancelled) return;
            revisions.current.set(frame.frameId, revision);
            setThumbnails((current) => ({ ...current, [frame.frameId]: url }));
          } catch {
            // A missing local font or invalid asset must not block frame switching.
          }
        }
      })();
    }, 450);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [activeDocument, studioProject.activeFrameId, studioProject.frames]);

  return <>
    <section className={`storyboard${collapsed ? ' is-collapsed' : ''}`} data-placement={placement} aria-label="Storyboard">
      <header className="storyboard-header">
        <div className="storyboard-project-name">
          <label htmlFor="project-name">Project</label>
          <input id="project-name" value={studioProject.projectName} maxLength={80}
            onChange={(event) => setProjectName(event.currentTarget.value)}
            onBlur={(event) => { if (!event.currentTarget.value.trim()) setProjectName('名称未設定のプロジェクト'); }} />
        </div>
        <span className="storyboard-count">{studioProject.frames.length}コマ</span>
        <Button type="button" variant="outline" size="sm" onClick={addFrame}><Plus aria-hidden="true" />コマ追加</Button>
        <Button type="button" variant="ghost" size="icon-sm" className="storyboard-collapse" aria-label={collapsed ? 'Storyboardを開く' : 'Storyboardを折りたたむ'} onClick={() => onCollapsedChange(!collapsed)}>
          {placement === 'left'
            ? collapsed ? <ChevronRight aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />
            : collapsed ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
        </Button>
      </header>
      {!collapsed && <div className="storyboard-list" data-frame-count={studioProject.frames.length}>
        {studioProject.frames.map((frame, index) => {
          const active = frame.frameId === studioProject.activeFrameId;
          const displayLabel = getFrameDisplayLabel(index);
          return <article key={frame.frameId} className={`storyboard-frame${active ? ' is-active' : ''}${frame.completedLocked ? ' is-complete' : ''}`}
            data-frame-id={clientHydrated ? frame.frameId : undefined}>
            <button type="button" className="storyboard-select" onClick={() => selectFrame(frame.frameId)} aria-label={`${displayLabel}を編集`}
              draggable={index > 0}
              onDragStart={(event) => {
                if (index === 0) {
                  event.preventDefault();
                  dragIndex.current = null;
                  return;
                }
                dragIndex.current = index;
              }}
              onDragOver={(event) => { if (index > 0) event.preventDefault(); }}
              onDrop={(event) => {
                event.preventDefault();
                const fromIndex = dragIndex.current;
                dragIndex.current = null;
                if (fromIndex !== null && fromIndex > 0 && index > 0) reorderFrame(fromIndex, index);
              }}
              onDragEnd={() => { dragIndex.current = null; }}>
              <span className={`storyboard-number${index === 0 ? ' is-fixed' : ''}`}>
                {index > 0 && <GripVertical aria-hidden="true" />}
                <span className="storyboard-frame-label" title={displayLabel}>{displayLabel}</span>
              </span>
              <span className="storyboard-thumb">
                {thumbnails[frame.frameId] ? <span className="storyboard-thumb-image" aria-hidden="true" style={{ backgroundImage: `url(${thumbnails[frame.frameId]})` }} /> : <span>生成中</span>}
                {frame.completedLocked && <span className="storyboard-complete"><Check aria-hidden="true" />完成</span>}
              </span>
            </button>
            <div className="storyboard-frame-actions">
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`${displayLabel}を複製`} title="コマを複製" onClick={() => duplicateFrame(frame.frameId)}><Copy aria-hidden="true" /></Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`${displayLabel}の完成ロックを${frame.completedLocked ? '解除' : '有効化'}`} title={frame.completedLocked ? '完成ロック解除' : '完成ロック'}
                onClick={() => frame.completedLocked ? setUnlockTarget(frame.frameId) : setFrameCompletedLocked(frame.frameId, true)}>
                {frame.completedLocked ? <LockKeyhole aria-hidden="true" /> : <UnlockKeyhole aria-hidden="true" />}
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" disabled={studioProject.frames.length <= 1 || frame.completedLocked}
                aria-label={`${displayLabel}を削除`} title="コマを削除" onClick={() => setDeleteTarget(frame.frameId)}><Trash2 aria-hidden="true" /></Button>
            </div>
          </article>;
        })}
      </div>}
    </section>

    <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogMedia><Trash2 aria-hidden="true" /></AlertDialogMedia><AlertDialogTitle>コマを削除しますか</AlertDialogTitle>
        <AlertDialogDescription>このコマのDocumentはProjectから削除されます。この操作は元に戻せません。</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>キャンセル</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => { if (deleteTarget) deleteFrame(deleteTarget); setDeleteTarget(null); }}>削除</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={Boolean(unlockTarget)} onOpenChange={(open) => { if (!open) setUnlockTarget(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogMedia><UnlockKeyhole aria-hidden="true" /></AlertDialogMedia><AlertDialogTitle>完成ロックを解除しますか</AlertDialogTitle>
        <AlertDialogDescription>解除後は、このコマの本文・配置・スタイル等を再び編集できます。</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>キャンセル</AlertDialogCancel><AlertDialogAction onClick={() => { if (unlockTarget) setFrameCompletedLocked(unlockTarget, false); setUnlockTarget(null); }}>解除する</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
