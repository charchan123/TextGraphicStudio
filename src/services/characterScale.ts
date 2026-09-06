import type { CharacterScaleStyle } from '@/src/types/editor';

export type CharacterScaleKey = keyof CharacterScaleStyle;

const EMOJI = /\p{Extended_Pictographic}/u;
const HAN = /\p{Script=Han}/u;
const HIRAGANA = /\p{Script=Hiragana}/u;
const KATAKANA = /[\p{Script=Katakana}\u30FC\uFF66-\uFF9F]/u;
const NUMBER = /\p{Number}/u;
const LATIN = /\p{Script=Latin}/u;
const SYMBOL = /[\p{Punctuation}\p{Symbol}]/u;

/** Classify a complete grapheme. Emoji and whitespace intentionally keep the neutral 100% scale. */
export const classifyGrapheme = (grapheme: string): CharacterScaleKey | null => {
  if (!grapheme || /^\s+$/u.test(grapheme) || EMOJI.test(grapheme)) return null;
  if (HAN.test(grapheme) || /[々〆ヶ]/u.test(grapheme)) return 'kanji';
  if (HIRAGANA.test(grapheme)) return 'hiragana';
  if (KATAKANA.test(grapheme)) return 'katakana';
  if (NUMBER.test(grapheme)) return 'number';
  if (LATIN.test(grapheme)) return 'latin';
  if (SYMBOL.test(grapheme)) return 'symbol';
  return null;
};

export const characterSizeMultiplier = (grapheme: string, scale: CharacterScaleStyle): number => {
  const category = classifyGrapheme(grapheme);
  const value = category ? scale[category] : 1;
  return Number.isFinite(value) ? Math.min(1.5, Math.max(0.5, value)) : 1;
};
