import { normalizeLineGapOffsets } from '@/src/services/lineGapOffsets';
import { reconcileTextLineIdentity, resolveTextEditRange, type TextInputEditHint } from '@/src/services/lineEdgeAdjustments';
import { adjustRangesForTextEdit } from '@/src/services/partialStyles';
import type { GraphicTextObject } from '@/src/types/editor';

export const normalizeTextContent = (value: string): string => value.replace(/\r\n?/g, '\n');

export const updateGraphicTextContent = (
  object: GraphicTextObject,
  nextValue: string,
  editHint?: TextInputEditHint,
): GraphicTextObject => {
  const text = normalizeTextContent(nextValue);
  if (text === object.text) return object;
  const lineIdentity = reconcileTextLineIdentity({
    oldText: object.text,
    newText: text,
    oldLineIds: object.textLineIds,
    oldAdjustments: object.background.lineEdgeAdjustments,
    editRange: resolveTextEditRange(object.text, text, editHint),
  });
  return {
    ...object,
    text,
    textLineIds: lineIdentity.textLineIds,
    background: {
      ...object.background,
      lineEdgeAdjustments: lineIdentity.lineEdgeAdjustments,
    },
    partialStyles: adjustRangesForTextEdit(object.text, text, object.partialStyles),
    lineGapOffsets: normalizeLineGapOffsets(text, object.lineGapOffsets),
  };
};
