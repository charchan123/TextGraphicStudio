import type { PartialTextStyle } from '@/src/types/editor';

type PartialStyleLeaf = Exclude<keyof PartialTextStyle, 'start' | 'end' | 'strokes'>;

const hasStyleLeaf = (style: PartialTextStyle): boolean =>
  Object.entries(style).some(([key, value]) => key !== 'start' && key !== 'end' && value !== undefined);

export const clearRangeStyles = (styles: PartialTextStyle[], start: number, end: number): PartialTextStyle[] => styles.flatMap((style) => {
  if (style.end <= start || style.start >= end) return [style];
  return [style.start < start ? { ...style, end: start } : null, style.end > end ? { ...style, start: end } : null].filter((value): value is PartialTextStyle => value !== null);
});

/** Remove one explicitly overridden leaf while preserving every other range property. */
export const clearRangeStyleLeaf = (
  styles: PartialTextStyle[], start: number, end: number, leaf: PartialStyleLeaf,
): PartialTextStyle[] => styles.flatMap((style) => {
  if (style.end <= start || style.start >= end || style[leaf] === undefined) return [style];
  const pieces: PartialTextStyle[] = [];
  if (style.start < start) pieces.push({ ...style, end: start });
  const middle = { ...style, start: Math.max(style.start, start), end: Math.min(style.end, end) };
  delete middle[leaf];
  if (hasStyleLeaf(middle)) pieces.push(middle);
  if (style.end > end) pieces.push({ ...style, start: end });
  return pieces;
});

export type PartialGlyphOffsetAction = 'keep' | 'inherit' | 'change';

export const applyPartialGlyphOffsetEdit = (
  styles: PartialTextStyle[], start: number, end: number,
  action: PartialGlyphOffsetAction, value: number,
): PartialTextStyle[] => {
  if (start >= end || action === 'keep') return styles;
  const cleared = clearRangeStyleLeaf(styles, start, end, 'glyphOffsetY');
  return action === 'change' ? [...cleared, { start, end, glyphOffsetY: value }] : cleared;
};

/** Preserve ranges around a single textarea edit; inserted/replaced text uses global styling. */
export const adjustRangesForTextEdit = (before: string, after: string, styles: PartialTextStyle[]): PartialTextStyle[] => {
  if (before === after) return styles;
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let oldEnd = before.length, newEnd = after.length;
  while (oldEnd > start && newEnd > start && before[oldEnd - 1] === after[newEnd - 1]) { oldEnd--; newEnd--; }
  const delta = newEnd - oldEnd;
  return styles.flatMap((style) => {
    if (style.end <= start) return [style];
    if (style.start >= oldEnd) return [{ ...style, start: style.start + delta, end: style.end + delta }];
    return [style.start < start ? { ...style, end: start } : null, style.end > oldEnd ? { ...style, start: newEnd, end: style.end + delta } : null].filter((value): value is PartialTextStyle => value !== null && value.start < value.end);
  });
};
