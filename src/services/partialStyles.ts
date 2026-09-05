import type { PartialTextStyle } from '@/src/types/editor';

export const clearRangeStyles = (styles: PartialTextStyle[], start: number, end: number): PartialTextStyle[] => styles.flatMap((style) => {
  if (style.end <= start || style.start >= end) return [style];
  return [style.start < start ? { ...style, end: start } : null, style.end > end ? { ...style, start: end } : null].filter((value): value is PartialTextStyle => value !== null);
});

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
