import { downloadTextFile, sanitizeFileName } from '@/src/services/download';
import type { GraphicTextObject, GraphicTextTemplateV1 } from '@/src/types/editor';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isString = (value: unknown): value is string => typeof value === 'string';

export const createTemplate = (
  object: GraphicTextObject,
  includePosition: boolean,
): GraphicTextTemplateV1 => ({
  kind: 'text-graphic-studio-template',
  schemaVersion: 1,
  savedAt: new Date().toISOString(),
  includePosition,
  typography: { ...object.typography },
  fill: object.fill.type === 'solid'
    ? { ...object.fill }
    : { ...object.fill, stops: object.fill.stops.map((stop) => ({ ...stop })) },
  stroke: { ...object.stroke },
  outerStroke: { ...object.outerStroke },
  shadow: { ...object.shadow },
  background: { ...object.background },
  transform: { ...object.transform },
  characterScale: { ...object.characterScale },
  partialStyles: object.partialStyles.map((style) => ({ ...style })),
  position: includePosition ? { ...object.position } : undefined,
});

export const downloadTemplate = (template: GraphicTextTemplateV1, objectName: string): void => {
  downloadTextFile(
    JSON.stringify(template, null, 2),
    `${sanitizeFileName(objectName)}-template.json`,
    'application/json;charset=utf-8',
  );
};

const isTemplate = (value: unknown): value is GraphicTextTemplateV1 => {
  if (!isRecord(value)) return false;
  if (value.kind !== 'text-graphic-studio-template' || value.schemaVersion !== 1) return false;
  if (typeof value.includePosition !== 'boolean' || !isString(value.savedAt)) return false;
  const typography = value.typography;
  const stroke = value.stroke;
  const outerStroke = value.outerStroke;
  const shadow = value.shadow;
  const background = value.background;
  const transform = value.transform;
  const characterScale = value.characterScale;
  const fill = value.fill;
  if (
    !isRecord(typography) ||
    !isRecord(stroke) ||
    !isRecord(outerStroke) ||
    !isRecord(shadow) ||
    !isRecord(background) ||
    !isRecord(transform) ||
    !isRecord(characterScale) ||
    !isRecord(fill)
  ) {
    return false;
  }
  const fillIsValid = fill.type === 'solid'
    ? isString(fill.color)
    : fill.type === 'linear-gradient' && isFiniteNumber(fill.angle) && Array.isArray(fill.stops);
  return (
    fillIsValid &&
    isString(typography.fontFamily) &&
    isFiniteNumber(typography.fontSize) &&
    (typography.fontWeight === 400 || typography.fontWeight === 700 || typography.fontWeight === 900) &&
    isFiniteNumber(typography.letterSpacing) &&
    isFiniteNumber(typography.lineHeight) &&
    (typography.textAlign === 'left' || typography.textAlign === 'center' || typography.textAlign === 'right') &&
    isString(stroke.color) &&
    typeof stroke.enabled === 'boolean' &&
    isFiniteNumber(stroke.width) &&
    isString(outerStroke.color) &&
    typeof outerStroke.enabled === 'boolean' &&
    isFiniteNumber(outerStroke.width) &&
    isString(shadow.color) &&
    typeof shadow.enabled === 'boolean' &&
    isFiniteNumber(shadow.blur) &&
    isFiniteNumber(shadow.opacity) &&
    isFiniteNumber(shadow.offsetX) &&
    isFiniteNumber(shadow.offsetY) &&
    background.type === 'rough-band' &&
    isString(background.color) &&
    typeof background.enabled === 'boolean' &&
    isFiniteNumber(background.rotation) &&
    isFiniteNumber(background.paddingX) &&
    isFiniteNumber(background.paddingY) &&
    isFiniteNumber(background.roughness) &&
    isFiniteNumber(background.seed) &&
    isFiniteNumber(transform.rotation) &&
    isFiniteNumber(transform.scaleX) &&
    isFiniteNumber(transform.scaleY) &&
    isFiniteNumber(characterScale.kanji) &&
    isFiniteNumber(characterScale.hiragana) &&
    isFiniteNumber(characterScale.katakana) &&
    isFiniteNumber(characterScale.latin) &&
    isFiniteNumber(characterScale.number) &&
    Array.isArray(value.partialStyles)
  );
};

export const readTemplateFile = async (file: File): Promise<GraphicTextTemplateV1> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('JSONファイルの内容を読み取れませんでした。');
  }
  if (!isTemplate(parsed)) {
    throw new Error('Text Graphic Studioのテンプレート形式ではありません。');
  }
  return parsed;
};
