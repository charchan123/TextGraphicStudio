import type { LineEdgeAdjustment } from '@/src/types/editor';

export const EMPTY_LINE_EDGE_ADJUSTMENT: LineEdgeAdjustment = { leftInsetPx: 0, rightInsetPx: 0 };

let fallbackLineIdSequence = 0;

const clampInset = (value: number): number => Math.min(500, Math.max(-500, Number.isFinite(value) ? value : 0));
const normalizeText = (text: string): string => text.replace(/\r\n?/g, '\n');
const logicalLines = (text: string): string[] => normalizeText(text).split('\n');

export const createTextLineId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') return `line-${globalThis.crypto.randomUUID()}`;
  fallbackLineIdSequence += 1;
  return `line-${Date.now().toString(36)}-${fallbackLineIdSequence.toString(36)}-${Math.random().toString(16).slice(2)}`;
};

export const createTextLineIds = (text: string): string[] => logicalLines(text).map(() => createTextLineId());

export const normalizeTextLineIds = (text: string, ids: readonly string[] | undefined): string[] => {
  const lineCount = logicalLines(text).length;
  const used = new Set<string>();
  return Array.from({ length: lineCount }, (_, index) => {
    const candidate = ids?.[index];
    if (typeof candidate === 'string' && candidate.length > 0 && candidate.length <= 160 && !used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    let generated = createTextLineId();
    while (used.has(generated)) generated = createTextLineId();
    used.add(generated);
    return generated;
  });
};

const normalizeAdjustment = (value: unknown): LineEdgeAdjustment => {
  const candidate = value && typeof value === 'object' ? value as Partial<LineEdgeAdjustment> : {};
  return {
    leftInsetPx: clampInset(candidate.leftInsetPx ?? 0),
    rightInsetPx: clampInset(candidate.rightInsetPx ?? 0),
  };
};

const hasAdjustment = (adjustment: LineEdgeAdjustment): boolean =>
  adjustment.leftInsetPx !== 0 || adjustment.rightInsetPx !== 0;

/** Normalizes the current ID map and migrates the unpublished index-array format. */
export const normalizeLineEdgeAdjustments = (
  adjustments: unknown,
  lineIds: readonly string[],
): Record<string, LineEdgeAdjustment> | undefined => {
  const next: Record<string, LineEdgeAdjustment> = {};
  if (Array.isArray(adjustments)) {
    lineIds.forEach((lineId, index) => {
      const adjustment = normalizeAdjustment(adjustments[index]);
      if (hasAdjustment(adjustment)) next[lineId] = adjustment;
    });
  } else if (adjustments && typeof adjustments === 'object') {
    const source = adjustments as Record<string, unknown>;
    lineIds.forEach((lineId) => {
      const adjustment = normalizeAdjustment(source[lineId]);
      if (hasAdjustment(adjustment)) next[lineId] = adjustment;
    });
  }
  return Object.keys(next).length ? next : undefined;
};

export const getLineEdgeAdjustment = (
  adjustments: Record<string, LineEdgeAdjustment> | undefined,
  lineId: string | undefined,
): LineEdgeAdjustment => lineId ? adjustments?.[lineId] ?? EMPTY_LINE_EDGE_ADJUSTMENT : EMPTY_LINE_EDGE_ADJUSTMENT;

export const getLogicalLineEdgeAdjustment = (
  adjustments: Record<string, LineEdgeAdjustment> | undefined,
  lineIds: readonly string[],
  logicalLineIndex: number,
): LineEdgeAdjustment => getLineEdgeAdjustment(adjustments, lineIds[logicalLineIndex]);

export const setLineEdgeAdjustment = (
  adjustments: Record<string, LineEdgeAdjustment> | undefined,
  lineId: string,
  patch: Partial<LineEdgeAdjustment>,
): Record<string, LineEdgeAdjustment> | undefined => {
  const current = adjustments?.[lineId] ?? EMPTY_LINE_EDGE_ADJUSTMENT;
  const value = {
    leftInsetPx: clampInset(patch.leftInsetPx ?? current.leftInsetPx),
    rightInsetPx: clampInset(patch.rightInsetPx ?? current.rightInsetPx),
  };
  const next = { ...adjustments };
  if (hasAdjustment(value)) next[lineId] = value;
  else delete next[lineId];
  return Object.keys(next).length ? next : undefined;
};

export interface ReconciledLineIdentity {
  textLineIds: string[];
  lineEdgeAdjustments?: Record<string, LineEdgeAdjustment>;
}

export interface TextEditRange {
  oldStart: number;
  oldEnd: number;
  newStart: number;
  newEnd: number;
  inputType?: string;
}

export interface TextInputEditHint {
  selectionStart: number;
  selectionEnd: number;
  inputType?: string;
  data?: string | null;
}

export interface ReconcileTextLineIdentityInput {
  oldText: string;
  newText: string;
  oldLineIds?: readonly string[];
  oldAdjustments?: unknown;
  editRange?: TextEditRange;
}

/** Character-position fallback for programmatic updates; line contents never participate in identity matching. */
export const inferTextEditRange = (oldValue: string, newValue: string): TextEditRange => {
  const oldText = normalizeText(oldValue);
  const newText = normalizeText(newValue);
  let prefixLength = 0;
  const sharedLength = Math.min(oldText.length, newText.length);
  while (prefixLength < sharedLength && oldText[prefixLength] === newText[prefixLength]) prefixLength += 1;
  let suffixLength = 0;
  while (
    suffixLength < oldText.length - prefixLength
    && suffixLength < newText.length - prefixLength
    && oldText[oldText.length - 1 - suffixLength] === newText[newText.length - 1 - suffixLength]
  ) suffixLength += 1;
  return {
    oldStart: prefixLength,
    oldEnd: oldText.length - suffixLength,
    newStart: prefixLength,
    newEnd: newText.length - suffixLength,
  };
};

export const resolveTextEditRange = (
  oldValue: string,
  newValue: string,
  hint?: TextInputEditHint,
): TextEditRange => {
  const oldText = normalizeText(oldValue);
  const newText = normalizeText(newValue);
  if (hint) {
    const oldStart = Math.min(oldText.length, Math.max(0, hint.selectionStart));
    const oldEnd = Math.min(oldText.length, Math.max(oldStart, hint.selectionEnd));
    const insertedLength = newText.length - (oldText.length - (oldEnd - oldStart));
    const candidate = {
      oldStart,
      oldEnd,
      newStart: oldStart,
      newEnd: oldStart + Math.max(0, insertedLength),
      inputType: hint.inputType,
    };
    if (
      candidate.newEnd <= newText.length
      && oldText.slice(0, candidate.oldStart) === newText.slice(0, candidate.newStart)
      && oldText.slice(candidate.oldEnd) === newText.slice(candidate.newEnd)
    ) return candidate;
  }
  return inferTextEditRange(oldText, newText);
};

const lineIndexAtOffset = (text: string, offset: number): number => {
  let lineIndex = 0;
  for (let index = 0; index < Math.min(offset, text.length); index += 1) {
    if (text[index] === '\n') lineIndex += 1;
  }
  return lineIndex;
};

const lineStartOffset = (text: string, lineIndex: number): number => {
  if (lineIndex <= 0) return 0;
  let currentLine = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '\n') continue;
    currentLine += 1;
    if (currentLine === lineIndex) return index + 1;
  }
  return text.length;
};

const isLineStart = (text: string, offset: number): boolean => offset === 0 || text[offset - 1] === '\n';

const suffixLineStartIndex = (text: string, offset: number, lineCount: number): number => {
  if (offset >= text.length) return lineCount;
  const lineIndex = lineIndexAtOffset(text, offset);
  if (text[offset] === '\n') return Math.min(lineCount, lineIndex + 1);
  return isLineStart(text, offset) ? lineIndex : Math.min(lineCount, lineIndex + 1);
};

export const reconcileTextLineIdentity = ({
  oldText: oldValue,
  newText: newValue,
  oldLineIds,
  oldAdjustments,
  editRange,
}: ReconcileTextLineIdentityInput): ReconciledLineIdentity => {
  const oldText = normalizeText(oldValue);
  const newText = normalizeText(newValue);
  const oldLines = logicalLines(oldText);
  const newLines = logicalLines(newText);
  const normalizedOldIds = normalizeTextLineIds(oldText, oldLineIds);
  const normalizedAdjustments = normalizeLineEdgeAdjustments(oldAdjustments, normalizedOldIds);
  const inferredRange = inferTextEditRange(oldText, newText);
  const range = editRange
    && oldText.slice(0, editRange.oldStart) === newText.slice(0, editRange.newStart)
    && oldText.slice(editRange.oldEnd) === newText.slice(editRange.newEnd)
    ? editRange
    : inferredRange;
  const prefixLineCount = Math.min(
    lineIndexAtOffset(oldText, range.oldStart),
    lineIndexAtOffset(newText, range.newStart),
  );
  const oldSuffixStart = suffixLineStartIndex(oldText, range.oldEnd, oldLines.length);
  const newSuffixStart = suffixLineStartIndex(newText, range.newEnd, newLines.length);
  const suffixLineCount = Math.min(oldLines.length - oldSuffixStart, newLines.length - newSuffixStart);
  const nextIds: Array<string | undefined> = Array.from({ length: newLines.length });

  for (let index = 0; index < prefixLineCount; index += 1) nextIds[index] = normalizedOldIds[index];
  // Align from the end of the unchanged suffix so duplicate line contents cannot change identity.
  for (let distance = 1; distance <= suffixLineCount; distance += 1) {
    nextIds[newLines.length - distance] = normalizedOldIds[oldLines.length - distance];
  }

  const oldAffectedEnd = oldLines.length - suffixLineCount;
  const newAffectedEnd = newLines.length - suffixLineCount;
  const oldAffectedCount = Math.max(0, oldAffectedEnd - prefixLineCount);
  const newAffectedCount = Math.max(0, newAffectedEnd - prefixLineCount);
  const sourceLineIndex = lineIndexAtOffset(oldText, range.oldStart);
  const editStartsInsideSourceLine = range.oldStart > lineStartOffset(oldText, sourceLineIndex);
  const changedOldText = oldText.slice(range.oldStart, range.oldEnd);
  const changedNewText = newText.slice(range.newStart, range.newEnd);
  const singleLineReplacement = oldAffectedCount === 1 && newAffectedCount === 1
    && !changedOldText.includes('\n') && !changedNewText.includes('\n');
  const collapsedInsertion = range.oldStart === range.oldEnd;
  if (
    oldAffectedCount > 0
    && newAffectedCount > 0
    && (editStartsInsideSourceLine || singleLineReplacement || collapsedInsertion)
  ) nextIds[prefixLineCount] = normalizedOldIds[prefixLineCount];

  const resolvedIds = nextIds.map((lineId) => lineId ?? createTextLineId());
  return {
    textLineIds: resolvedIds,
    lineEdgeAdjustments: normalizeLineEdgeAdjustments(normalizedAdjustments, resolvedIds),
  };
};

export interface LineBoundsInput {
  width: number;
  centerX: number;
}

export interface AdjustedLineBackgroundBounds {
  baselineLeft: number;
  baselineRight: number;
  left: number;
  right: number;
  centerX: number;
  width: number;
}

export const calculateAdjustedLineBackgroundBounds = (
  line: LineBoundsInput,
  paddingX: number,
  adjustment: LineEdgeAdjustment | undefined,
): AdjustedLineBackgroundBounds => {
  const current = adjustment ?? EMPTY_LINE_EDGE_ADJUSTMENT;
  const baselineLeft = line.centerX - line.width / 2 - paddingX;
  const baselineRight = line.centerX + line.width / 2 + paddingX;
  const left = baselineLeft + current.leftInsetPx;
  const right = baselineRight - current.rightInsetPx;
  return {
    baselineLeft,
    baselineRight,
    left,
    right,
    centerX: (left + right) / 2,
    width: Math.max(1, right - left),
  };
};
