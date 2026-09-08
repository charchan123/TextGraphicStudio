'use client';
/* oxlint-disable next/no-img-element -- Blob object URLs must be shown at their exact exported PNG dimensions. */

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getFrameDisplayLabel } from '@/src/services/frameLabels';

export interface OutputPreview {
  url: string;
  width: number;
  height: number;
  frameId: string;
  frameIndex: number;
  frameCount: number;
}

interface OutputPreviewDialogProps {
  preview: OutputPreview;
  navigating: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
}

export function OutputPreviewDialog({ preview, navigating, onPrevious, onNext, onClose }: OutputPreviewDialogProps) {
  const [mode, setMode] = useState<'fit' | 'actual'>('fit');
  const canMovePrevious = preview.frameIndex > 0 && !navigating;
  const canMoveNext = preview.frameIndex < preview.frameCount - 1 && !navigating;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && canMovePrevious) {
        event.preventDefault();
        onPrevious();
      } else if (event.key === 'ArrowRight' && canMoveNext) {
        event.preventDefault();
        onNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canMoveNext, canMovePrevious, onNext, onPrevious]);

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
        <div className="output-preview-footer"><Button type="button" variant="outline" onClick={onClose}>閉じる</Button></div>
      </DialogContent>
    </Dialog>
  );
}
