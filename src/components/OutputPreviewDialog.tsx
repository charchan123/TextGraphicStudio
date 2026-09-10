'use client';
/* oxlint-disable next/no-img-element -- Blob object URLs must be shown at their exact exported PNG dimensions. */

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getFrameDisplayLabel } from '@/src/services/frameLabels';
import { getOutputPreviewKeyboardAction } from '@/src/services/outputPreviewNavigation';

export interface OutputPreview {
  url: string;
  width: number;
  height: number;
  frameId: string;
  frameIndex: number;
  frameCount: number;
}

export interface OutputPreviewFrame {
  frameId: string;
  frameIndex: number;
  thumbnailUrl?: string;
}

interface OutputPreviewDialogProps {
  preview: OutputPreview;
  frames: OutputPreviewFrame[];
  navigating: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSelectFrame: (frameIndex: number) => void;
  onClose: () => void;
}

const isEditableTarget = (target: EventTarget | null) => {
  const element = target instanceof HTMLElement ? target : null;
  return Boolean(element?.closest('input, textarea, [contenteditable="true"]'));
};

export function OutputPreviewDialog({ preview, frames, navigating, onPrevious, onNext, onSelectFrame, onClose }: OutputPreviewDialogProps) {
  const [mode, setMode] = useState<'fit' | 'actual'>('fit');
  const currentThumbnailRef = useRef<HTMLButtonElement | null>(null);
  const canMovePrevious = preview.frameIndex > 0 && !navigating;
  const canMoveNext = preview.frameIndex < preview.frameCount - 1 && !navigating;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const action = getOutputPreviewKeyboardAction(event.key);
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      if (action === 'previous') {
        if (canMovePrevious) onPrevious();
      } else if (action === 'next') {
        if (canMoveNext) onNext();
      } else if (action === 'close') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [canMoveNext, canMovePrevious, onClose, onNext, onPrevious]);

  useEffect(() => {
    currentThumbnailRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [preview.frameId]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="output-preview-dialog" data-preview-mode={mode}>
        <DialogHeader>
          <DialogTitle>出力プレビュー</DialogTitle>
          <DialogDescription>キャンバスPNG保存と同じ描画結果です。選択枠やガイドは含まれません。</DialogDescription>
        </DialogHeader>
        <fieldset className="output-preview-actions">
          <legend className="sr-only">プレビュー表示倍率</legend>
          <Button type="button" size="sm" variant={mode === 'fit' ? 'default' : 'outline'} onClick={() => setMode('fit')}>画面に合わせる</Button>
          <Button type="button" size="sm" variant={mode === 'actual' ? 'default' : 'outline'} onClick={() => setMode('actual')}>100%表示</Button>
          <span>{preview.width} × {preview.height}</span>
        </fieldset>
        <nav className="output-preview-navigation" aria-label="Previewのコマ移動">
          <Button type="button" variant="outline" size="sm" disabled={!canMovePrevious} aria-label="前のコマ" title="前のコマ" onClick={onPrevious}>
            <ChevronLeft aria-hidden="true" />前のコマ
          </Button>
          <output className="output-preview-frame-position" aria-live="polite">
            <strong>{getFrameDisplayLabel(preview.frameIndex)}</strong>
            <span>{preview.frameIndex + 1} / {preview.frameCount}</span>
          </output>
          <Button type="button" variant="outline" size="sm" disabled={!canMoveNext} aria-label="次のコマ" title="次のコマ" onClick={onNext}>
            次のコマ<ChevronRight aria-hidden="true" />
          </Button>
        </nav>
        <div className={`output-preview-viewport preview-${mode}`} aria-busy={navigating}>
          <img src={preview.url} width={preview.width} height={preview.height} alt={`${getFrameDisplayLabel(preview.frameIndex)}の完成画像プレビュー`} />
        </div>
        <nav className="output-preview-thumbnails" aria-label="Previewの全コマ">
          {frames.map((frame) => {
            const current = frame.frameId === preview.frameId;
            return <button
              key={frame.frameId}
              ref={current ? currentThumbnailRef : undefined}
              type="button"
              className={current ? 'output-preview-thumbnail is-current' : 'output-preview-thumbnail'}
              aria-current={current ? 'true' : undefined}
              aria-label={`${getFrameDisplayLabel(frame.frameIndex)}をプレビュー`}
              title={getFrameDisplayLabel(frame.frameIndex)}
              disabled={navigating}
              onClick={() => onSelectFrame(frame.frameIndex)}
            >
              <span className="output-preview-thumbnail-image">
                {frame.thumbnailUrl ? <img src={frame.thumbnailUrl} alt="" /> : <span className="output-preview-thumbnail-loading" aria-hidden="true" />}
              </span>
              <span>{getFrameDisplayLabel(frame.frameIndex)}</span>
            </button>;
          })}
        </nav>
        <div className="output-preview-footer"><Button type="button" variant="outline" onClick={onClose}>閉じる</Button></div>
      </DialogContent>
    </Dialog>
  );
}
