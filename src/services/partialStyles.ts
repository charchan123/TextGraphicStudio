import type { PartialTextStyle } from '@/src/types/editor';

export type PartialStyleLeaf = Exclude<keyof PartialTextStyle, 'start' | 'end' | 'strokes'>;

export interface RangeOverrideState<T> {
  presence: 'none' | 'all' | 'mixed';
  value?: T;
  valueMixed: boolean;
}

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

const valuesEqual = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const rangeSegments = (styles: PartialTextStyle[], start: number, end: number): Array<[number, number]> => {
  const points = new Set([start, end]);
  styles.forEach((style) => {
    if (style.start > start && style.start < end) points.add(style.start);
    if (style.end > start && style.end < end) points.add(style.end);
  });
  const sorted = [...points].sort((a, b) => a - b);
  return sorted.slice(0, -1).map((point, index) => [point, sorted[index + 1]]);
};

const leafAt = <K extends PartialStyleLeaf>(
  styles: PartialTextStyle[], point: number, leaf: K,
): PartialTextStyle[K] | undefined => {
  let value: PartialTextStyle[K] | undefined;
  styles.forEach((style) => {
    if (style.start <= point && style.end > point && style[leaf] !== undefined) value = style[leaf];
  });
  return value;
};

/** Inspect explicit range overrides (not inherited whole-text values), respecting last-range-wins rendering. */
export const getRangeOverrideState = <K extends PartialStyleLeaf>(
  styles: PartialTextStyle[], start: number, end: number, leaf: K,
): RangeOverrideState<NonNullable<PartialTextStyle[K]>> => {
  if (start >= end) return { presence: 'none', valueMixed: false };
  const values = rangeSegments(styles, start, end).map(([segmentStart]) => leafAt(styles, segmentStart, leaf));
  const defined = values.filter((value): value is NonNullable<PartialTextStyle[K]> => value !== undefined);
  if (!defined.length) return { presence: 'none', valueMixed: false };
  const sameValue = defined.every((value) => valuesEqual(value, defined[0]));
  if (defined.length === values.length && sameValue) {
    return { presence: 'all', value: defined[0], valueMixed: false };
  }
  return { presence: 'mixed', value: defined[0], valueMixed: !sameValue || defined.length !== values.length };
};

/** Set one range property while retaining all unrelated partial leaves. */
export const setRangeStyleLeaf = <K extends PartialStyleLeaf>(
  styles: PartialTextStyle[], start: number, end: number, leaf: K, value: NonNullable<PartialTextStyle[K]>,
): PartialTextStyle[] => {
  if (start >= end) return styles;
  const cleared = clearRangeStyleLeaf(styles, start, end, leaf);
  return [...cleared, { start, end, [leaf]: value } as PartialTextStyle];
};

/**
 * Add one delta to every current effective range value. Segment differences are preserved,
 * and inherited values become explicit only inside the edited selection.
 */
export const shiftRangeNumericLeaf = (
  styles: PartialTextStyle[], start: number, end: number,
  leaf: 'glyphOffsetX', delta: number, inheritedValue = 0,
): PartialTextStyle[] => {
  if (start >= end || !Number.isFinite(delta)) return styles;
  const segments = rangeSegments(styles, start, end).map(([segmentStart, segmentEnd]) => ({
    start: segmentStart,
    end: segmentEnd,
    value: Number(leafAt(styles, segmentStart, leaf) ?? inheritedValue) + delta,
  }));
  const cleared = clearRangeStyleLeaf(styles, start, end, leaf);
  const compact: typeof segments = [];
  segments.forEach((segment) => {
    const previous = compact.at(-1);
    if (previous && previous.end === segment.start && previous.value === segment.value) previous.end = segment.end;
    else compact.push({ ...segment });
  });
  return [...cleared, ...compact.map((segment) => ({
    start: segment.start,
    end: segment.end,
    [leaf]: segment.value,
  } as PartialTextStyle))];
};

export type PartialGlyphOffsetAction = 'keep' | 'inherit' | 'change';

export const applyPartialGlyphOffsetEdit = (
  styles: PartialTextStyle[], start: number, end: number,
  action: PartialGlyphOffsetAction, value: number,
): PartialTextStyle[] => {
  if (start >= end || action === 'keep') return styles;
  const cleared = clearRangeStyleLeaf(styles, start, end, 'glyphOffsetY');
  return action === 'change' ? setRangeStyleLeaf(cleared, start, end, 'glyphOffsetY', value) : cleared;
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
