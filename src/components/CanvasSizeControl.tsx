'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { CANVAS_PRESETS } from '@/src/constants/editor';
import { useEditorStore } from '@/src/store/editorStore';

export function CanvasSizeControl() {
  const canvas = useEditorStore((state) => state.project.canvas);
  const setCanvasSize = useEditorStore((state) => state.setCanvasSize);
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(canvas.width);
  const [height, setHeight] = useState(canvas.height);

  const valid = width >= 64 && width <= 8192 && height >= 64 && height <= 8192;

  return (
    <>
      <NativeSelect
        className="canvas-size-select"
        aria-label="キャンバスサイズ"
        value={canvas.preset}
        onChange={(event) => {
          if (event.currentTarget.value === 'custom') {
            setWidth(canvas.width);
            setHeight(canvas.height);
            setOpen(true);
            return;
          }
          const preset = CANVAS_PRESETS.find((item) => item.id === event.currentTarget.value);
          if (preset) setCanvasSize(preset.width, preset.height, preset.id);
        }}
      >
        {CANVAS_PRESETS.map((preset) => (
          <NativeSelectOption key={preset.id} value={preset.id}>{preset.label}</NativeSelectOption>
        ))}
        <NativeSelectOption value="custom">カスタム {canvas.preset === 'custom' ? `${canvas.width} × ${canvas.height}` : ''}</NativeSelectOption>
      </NativeSelect>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>カスタムキャンバス</DialogTitle>
            <DialogDescription>64〜8192pxの範囲で内部解像度を指定します。</DialogDescription>
          </DialogHeader>
          <div className="custom-size-grid">
            <label>幅<input type="number" min="64" max="8192" value={width} onChange={(event) => setWidth(event.currentTarget.valueAsNumber || 0)} /></label>
            <span>×</span>
            <label>高さ<input type="number" min="64" max="8192" value={height} onChange={(event) => setHeight(event.currentTarget.valueAsNumber || 0)} /></label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>キャンセル</Button>
            <Button disabled={!valid} onClick={() => {
              setCanvasSize(Math.round(width), Math.round(height), 'custom');
              setOpen(false);
            }}>このサイズに変更</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
