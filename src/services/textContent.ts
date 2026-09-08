import { normalizeLineGapOffsets } from '@/src/services/lineGapOffsets';
import { adjustRangesForTextEdit } from '@/src/services/partialStyles';
import type { GraphicTextObject } from '@/src/types/editor';

export const normalizeTextContent = (value: string): string => value.replace(/\r\n?/g, '\n');

export const updateGraphicTextContent = (
  object: GraphicTextObject,
  nextValue: string,
): GraphicTextObject => {
  const text = normalizeTextContent(nextValue);
  if (text === object.text) return object;
  return {
    ...object,
    text,
    partialStyles: adjustRangesForTextEdit(object.text, text, object.partialStyles),
    lineGapOffsets: normalizeLineGapOffsets(text, object.lineGapOffsets),
  };
};
