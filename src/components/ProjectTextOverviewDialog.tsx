'use client';

import { useMemo, useState } from 'react';
import { EyeOff, LockKeyhole, MapPin, Rows3 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { useEditorStore } from '@/src/store/editorStore';

interface TextDraft {
  frameId: string;
  frameIndex: number;
  frameName: string;
  frameCompletedLocked: boolean;
  objectId: string;
  objectName: string;
  originalText: string;
  text: string;
  visible: boolean;
  positionLocked: boolean;
  fullyLocked: boolean;
}

interface FrameDraftGroup {
  frameId: string;
  frameIndex: number;
  frameName: string;
  frameCompletedLocked: boolean;
  drafts: TextDraft[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const collectDrafts = (): FrameDraftGroup[] => {
  const project = useEditorStore.getState().getStudioProjectSnapshot();
  return project.frames.map((frame, frameIndex) => ({
    frameId: frame.frameId,
    frameIndex,
    frameName: frame.name,
    frameCompletedLocked: frame.completedLocked,
    drafts: [...frame.document.objects].filter((object) => object.kind === 'graphic-text')
      .sort((left, right) => left.zIndex - right.zIndex)
      .map((object) => ({
      frameId: frame.frameId,
      frameIndex,
      frameName: frame.name,
      frameCompletedLocked: frame.completedLocked,
      objectId: object.id,
      objectName: object.name,
      originalText: object.text,
      text: object.text,
      visible: object.visible,
      positionLocked: object.locked,
      fullyLocked: Boolean(object.fullyLocked),
      })),
  }));
};

export function ProjectTextOverviewDialog({ open, onOpenChange }: Props) {
  const [frameGroups, setFrameGroups] = useState<FrameDraftGroup[]>(collectDrafts);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const setNotice = useEditorStore((state) => state.setNotice);
  const applyProjectTextChanges = useEditorStore((state) => state.applyProjectTextChanges);

  const changedDrafts = useMemo(
    () => frameGroups.flatMap((frame) => frame.drafts).filter((draft) => draft.text !== draft.originalText),
    [frameGroups],
  );

  const closeNow = () => {
    setDiscardOpen(false);
    onOpenChange(false);
  };

  const requestClose = () => {
    if (isComposing) return;
    if (changedDrafts.length > 0) setDiscardOpen(true);
    else closeNow();
  };

  const applyChanges = () => {
    if (isComposing || changedDrafts.length === 0) return;
    const result = applyProjectTextChanges(changedDrafts.map((draft) => ({
      frameId: draft.frameId,
      objectId: draft.objectId,
      text: draft.text,
    })));
    if (!result.ok) {
      setNotice(result.message, 'error');
      return;
    }
    setNotice(`${result.changedCount}件の文章変更を各コマへ反映しました。`, 'success');
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) requestClose(); }}>
        <DialogContent className="project-text-overview" showCloseButton={false}>
          <DialogHeader className="project-text-overview-header">
            <div>
              <DialogTitle>全コマ文章一覧</DialogTitle>
              <DialogDescription>全コマの本文を校正し、変更された文章だけをまとめて反映します。</DialogDescription>
            </div>
            <output className="project-text-change-count" aria-live="polite">変更 {changedDrafts.length}件</output>
          </DialogHeader>

          <div className="project-text-overview-scroll" data-testid="project-text-overview">
            {frameGroups.length === 0 && <p className="project-text-empty">コマがありません。</p>}
            {frameGroups.map((frameGroup) => {
              return (
                <section className="project-text-frame" key={frameGroup.frameId} data-frame-id={frameGroup.frameId}>
                  <header className="project-text-frame-header">
                    <span className="project-text-frame-number">{String(frameGroup.frameIndex).padStart(2, '0')}</span>
                    <strong>{frameGroup.frameName}</strong>
                    {frameGroup.frameCompletedLocked && <span className="project-text-lock-badge"><LockKeyhole aria-hidden="true" />完成</span>}
                  </header>
                  <div className="project-text-fields">
                    {frameGroup.drafts.length === 0 && <p className="project-text-empty">このコマにテキストはありません。</p>}
                    {frameGroup.drafts.map((draft) => {
                      const readOnly = draft.frameCompletedLocked || draft.fullyLocked;
                      const inputId = `project-text-${draft.frameId}-${draft.objectId}`;
                      return (
                        <div className={`project-text-field${readOnly ? ' is-readonly' : ''}`} key={draft.objectId} data-object-id={draft.objectId}>
                          <span className="project-text-field-meta">
                            <label htmlFor={inputId}>{draft.objectName}</label>
                            <span className="project-text-badges">
                              {!draft.visible && <span><EyeOff aria-hidden="true" />非表示</span>}
                              {draft.fullyLocked && <span><LockKeyhole aria-hidden="true" />完全ロック</span>}
                              {!draft.fullyLocked && draft.positionLocked && <span><MapPin aria-hidden="true" />位置ロック（本文編集可）</span>}
                            </span>
                          </span>
                          <Textarea
                            id={inputId}
                            value={draft.text}
                            rows={Math.max(2, Math.min(7, draft.text.split('\n').length + 1))}
                            disabled={readOnly}
                            aria-label={`${String(draft.frameIndex).padStart(2, '0')} ${draft.frameName} ${draft.objectName}`}
                            data-text-draft={`${draft.frameId}:${draft.objectId}`}
                            onCompositionStart={() => setIsComposing(true)}
                            onCompositionEnd={(event) => {
                              setIsComposing(false);
                              const text = event.currentTarget.value;
                              setFrameGroups((current) => current.map((frame) => frame.frameId !== draft.frameId ? frame : {
                                ...frame,
                                drafts: frame.drafts.map((item) => item.objectId === draft.objectId ? { ...item, text } : item),
                              }));
                            }}
                            onChange={(event) => {
                              const text = event.currentTarget.value;
                              setFrameGroups((current) => current.map((frame) => frame.frameId !== draft.frameId ? frame : {
                                ...frame,
                                drafts: frame.drafts.map((item) => item.objectId === draft.objectId ? { ...item, text } : item),
                              }));
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          <DialogFooter className="project-text-overview-footer">
            <Button variant="outline" onClick={requestClose}>閉じる</Button>
            <span className="project-text-apply-summary">
              {changedDrafts.length > 0 ? `${changedDrafts.length}件の文章変更を各コマへ反映します` : '変更された文章はありません'}
            </span>
            <Button disabled={changedDrafts.length === 0 || isComposing} onClick={applyChanges}>
              <Rows3 aria-hidden="true" />各コマへ一括反映
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>未反映の文章変更があります</AlertDialogTitle>
            <AlertDialogDescription>{changedDrafts.length}件の変更を破棄して文章一覧を閉じますか？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>一覧へ戻る</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={closeNow}>変更を破棄して閉じる</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
