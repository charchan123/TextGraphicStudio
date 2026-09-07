const normalizeText = (text: string): string => text.replace(/\r\n?/g, '\n');

export const countTextLines = (text: string): number => normalizeText(text).split('\n').length;

export const normalizeLineGapOffsets = (text: string, offsets?: readonly number[]): number[] => {
  const boundaryCount = Math.max(0, countTextLines(text) - 1);
  return Array.from({ length: boundaryCount }, (_, index) => {
    const value = offsets?.[index] ?? 0;
    return Number.isFinite(value) ? Math.min(100, Math.max(-100, value)) : 0;
  });
};

export type LineGapTarget =
  | { enabled: true; boundaryIndex: number; fromLine: number; toLine: number }
  | { enabled: false; reason: 'multiline' | 'last-line' };

export const getLineGapTarget = (text: string, start: number, end: number): LineGapTarget => {
  const normalized = normalizeText(text);
  const safeStart = Math.min(normalized.length, Math.max(0, start));
  const safeEnd = Math.min(normalized.length, Math.max(safeStart, end));
  if (normalized.slice(safeStart, safeEnd).includes('\n')) {
    return { enabled: false, reason: 'multiline' };
  }
  const lineIndex = normalized.slice(0, safeStart).split('\n').length - 1;
  if (lineIndex >= countTextLines(normalized) - 1) {
    return { enabled: false, reason: 'last-line' };
  }
  return { enabled: true, boundaryIndex: lineIndex, fromLine: lineIndex + 1, toLine: lineIndex + 2 };
};
