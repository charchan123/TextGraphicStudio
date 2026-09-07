'use client';
/* oxlint-disable next/no-img-element -- Blob object URLs must be shown at their exact exported PNG dimensions. */

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface OutputPreviewDialogProps {
  preview: { url: string; width: number; height: number } | null;
  onClose: () => void;
}

export function OutputPreviewDialog({ preview, onClose }: OutputPreviewDialogProps) {
  const [mode, setMode] = useState<'fit' | 'actual'>('fit');
  return (
    <Dialog open={Boolean(preview)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="output-preview-dialog" data-preview-mode={mode}>
        <DialogHeader>
          <DialogTitle>出力プレビュー</DialogTitle>
          <DialogDescription>キャンバスPNG保存と同じ描画結果です。選択枠やガイドは含まれません。</DialogDescription>
        </DialogHeader>
        <fieldset className="output-preview-actions">
          <legend className="sr-only">プレビュー表示倍率</legend>
          <Button type="button" size="sm" variant={mode === 'fit' ? 'default' : 'outline'} onClick={() => setMode('fit')}>画面に合わせる</Button>
          <Button type="button" size="sm" variant={mode === 'actual' ? 'default' : 'outline'} onClick={() => setMode('actual')}>100%表示</Button>
          <span>{preview ? `${preview.width} × ${preview.height}` : ''}</span>
        </fieldset>
        <div className={`output-preview-viewport preview-${mode}`}>
          {preview && <img src={preview.url} width={preview.width} height={preview.height} alt="完成画像の出力プレビュー" />}
        </div>
        <div className="output-preview-footer"><Button type="button" variant="outline" onClick={onClose}>閉じる</Button></div>
      </DialogContent>
    </Dialog>
  );
}
