import type { CanvasPresetId } from '@/src/types/editor';

export interface FontOption {
  label: string;
  value: string;
  stack: string;
}

export interface CanvasPreset {
  id: Exclude<CanvasPresetId, 'custom'>;
  label: string;
  width: number;
  height: number;
}

export const CANVAS_PRESETS: CanvasPreset[] = [
  { id: 'landscape', label: '横長 1920 × 1080', width: 1920, height: 1080 },
  { id: 'portrait', label: '縦長 1080 × 1920', width: 1080, height: 1920 },
  { id: 'square', label: '正方形 1080 × 1080', width: 1080, height: 1080 },
];

export const FONT_OPTIONS: FontOption[] = [
  { label: 'Arial', value: 'Arial', stack: 'Arial, Helvetica, sans-serif' },
  { label: 'Arial Black', value: 'Arial Black', stack: '"Arial Black", Arial, sans-serif' },
  { label: 'Impact', value: 'Impact', stack: 'Impact, "Arial Black", sans-serif' },
  { label: 'Noto Sans JP', value: 'Noto Sans JP', stack: '"Noto Sans JP", "Yu Gothic", Meiryo, sans-serif' },
  { label: 'Noto Serif JP', value: 'Noto Serif JP', stack: '"Noto Serif JP", "Yu Mincho", "MS Mincho", serif' },
  { label: 'Yu Gothic', value: 'Yu Gothic', stack: '"Yu Gothic", "Yu Gothic UI", Meiryo, sans-serif' },
  { label: 'Yu Gothic UI', value: 'Yu Gothic UI', stack: '"Yu Gothic UI", "Yu Gothic", Meiryo, sans-serif' },
  { label: 'Meiryo', value: 'Meiryo', stack: 'Meiryo, "Yu Gothic UI", sans-serif' },
  { label: 'MS Gothic', value: 'MS Gothic', stack: '"MS Gothic", "Yu Gothic", monospace' },
  { label: 'MS PGothic', value: 'MS PGothic', stack: '"MS PGothic", "Yu Gothic", sans-serif' },
  { label: 'MS Mincho', value: 'MS Mincho', stack: '"MS Mincho", "Yu Mincho", serif' },
];

export const resolveFontStack = (fontFamily: string): string =>
  FONT_OPTIONS.find((option) => option.value === fontFamily)?.stack ??
  `"${fontFamily}", "Yu Gothic UI", Meiryo, sans-serif`;

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const HISTORY_LIMIT = 60;
export const AUTOSAVE_DELAY_MS = 900;
