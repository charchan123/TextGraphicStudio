import { shiftRangeNumericLeaf } from '@/src/services/partialStyles';
import type { GraphicTextObject } from '@/src/types/editor';

export interface HorizontalVisualBounds {
  left: number;
  right: number;
}

export interface GlyphHorizontalLayout extends HorizontalVisualBounds {
  start: number;
  end: number;
}

export interface PartialHorizontalGeometry {
  reference: HorizontalVisualBounds;
  selection: HorizontalVisualBounds;
}

export type PartialHorizontalAlignment = 'left' | 'center' | 'right';

const mergeBounds = (glyphs: GlyphHorizontalLayout[]): HorizontalVisualBounds | null => {
  if (!glyphs.length) return null;
  return {
    left: Math.min(...glyphs.map((glyph) => glyph.left)),
    right: Math.max(...glyphs.map((glyph) => glyph.right)),
  };
};

export const calculateTextRangeHorizontalGeometry = (
  referenceGlyphs: GlyphHorizontalLayout[],
  renderedGlyphs: GlyphHorizontalLayout[],
  start: number,
  end: number,
): PartialHorizontalGeometry | null => {
  if (start >= end) return null;
  const reference = mergeBounds(referenceGlyphs);
  const selection = mergeBounds(renderedGlyphs.filter((glyph) => glyph.end > start && glyph.start < end));
  return reference && selection ? { reference, selection } : null;
};

export const getPartialHorizontalAlignmentDelta = (
  geometry: PartialHorizontalGeometry,
  alignment: PartialHorizontalAlignment,
): number => {
  if (alignment === 'left') return geometry.reference.left - geometry.selection.left;
  if (alignment === 'right') return geometry.reference.right - geometry.selection.right;
  const overallCenter = (geometry.reference.left + geometry.reference.right) / 2;
  const selectionCenter = (geometry.selection.left + geometry.selection.right) / 2;
  return overallCenter - selectionCenter;
};

export const getDynamicGlyphOffsetXRange = (
  geometry: PartialHorizontalGeometry,
  currentValue: number,
): { min: number; max: number } => ({
  min: Math.floor(currentValue + getPartialHorizontalAlignmentDelta(geometry, 'left')),
  max: Math.ceil(currentValue + getPartialHorizontalAlignmentDelta(geometry, 'right')),
});

export const shiftGraphicTextRangeX = (
  model: GraphicTextObject,
  start: number,
  end: number,
  delta: number,
): GraphicTextObject => ({
  ...model,
  partialStyles: shiftRangeNumericLeaf(model.partialStyles, start, end, 'glyphOffsetX', delta, 0),
});
