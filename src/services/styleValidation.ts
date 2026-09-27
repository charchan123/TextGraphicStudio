import { isEmbeddedBackgroundImage } from '@/src/services/textBackgroundAssets';
import type { ColorPalette, FillStyle, FontReference, PartialTextStyle, ProjectTextDefaults, RoughBandStyle } from '@/src/types/editor';

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
export const bounded = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const color = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value);
export const isStrokeLayers = (value: unknown): boolean => Array.isArray(value) && value.length === 3
  && value.every((layer) => isRecord(layer) && typeof layer.enabled === 'boolean' && color(layer.color) && bounded(layer.width, 0, 40));
const isPartialStrokes = (value: unknown): boolean => isRecord(value)
  && Object.entries(value).every(([key, layer]) => ['1', '2', '3'].includes(key) && isRecord(layer)
    && (layer.enabled === undefined || typeof layer.enabled === 'boolean')
    && (layer.color === undefined || color(layer.color))
    && (layer.width === undefined || bounded(layer.width, 0, 40)));
export const isSafeFontText = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length === 0 || value.length > 240) return false;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 32 || code === 127) return false;
  }
  return true;
};

export const isColorPalette = (value: unknown): value is ColorPalette =>
  Array.isArray(value) && value.length === 6 && value.every(color);

export const isFontReference = (value: unknown): value is FontReference => isRecord(value)
  && isSafeFontText(value.id) && isSafeFontText(value.family) && isSafeFontText(value.fullName)
  && (value.postscriptName === undefined || isSafeFontText(value.postscriptName))
  && (value.style === undefined || isSafeFontText(value.style))
  && (value.weight === undefined || bounded(value.weight, 1, 1000))
  && (value.source === 'local-access' || value.source === 'file')
  && (value.fileName === undefined || isSafeFontText(value.fileName));

export const isFillStyle = (value: unknown): value is FillStyle => isRecord(value) && (
  value.type === 'solid' ? color(value.color) : value.type === 'linear-gradient' && bounded(value.angle, -360, 360) && Array.isArray(value.stops)
    && value.stops.length >= 2 && value.stops.length <= 16
    && value.stops.every((stop) => isRecord(stop) && bounded(stop.offset, 0, 1) && color(stop.color))
);

export const isPartialTextStyle = (value: unknown): value is PartialTextStyle => {
  if (!isRecord(value)) return false;
  // Phase 3.0.13 Lite may have persisted a negative value. Accept it only so
  // the normalizers can convert it to 0 instead of rejecting the whole file.
  const fontWeightAdjust = typeof value.fontWeightAdjust === 'number'
    && Number.isFinite(value.fontWeightAdjust)
    && value.fontWeightAdjust < 0
    ? 0
    : value.fontWeightAdjust;
  return bounded(value.start, 0, 1000000) && Number.isInteger(value.start)
    && bounded(value.end, value.start + 1, 1000000) && Number.isInteger(value.end)
    && (value.fill === undefined || isFillStyle(value.fill))
    && (value.fontScale === undefined || bounded(value.fontScale, 0.05, 20))
    && (value.fontSize === undefined || bounded(value.fontSize, 8, 400))
    && (value.letterSpacing === undefined || bounded(value.letterSpacing, -40, 160))
    && (value.fontWeight === undefined || value.fontWeight === 400 || value.fontWeight === 700 || value.fontWeight === 900)
    && (fontWeightAdjust === undefined || bounded(fontWeightAdjust, 0, 16))
    && (value.fontFamily === undefined || isSafeFontText(value.fontFamily))
    && (value.fontRefId === undefined || isSafeFontText(value.fontRefId))
    && (value.fontStyle === undefined || value.fontStyle === 'normal' || value.fontStyle === 'italic')
    && (value.glyphScaleX === undefined || bounded(value.glyphScaleX, 0.5, 1.5))
    && (value.glyphScaleY === undefined || bounded(value.glyphScaleY, 0.5, 1.5))
    && (value.glyphOffsetY === undefined || bounded(value.glyphOffsetY, -100, 100))
    && (value.glyphOffsetX === undefined || bounded(value.glyphOffsetX, -100, 100))
    && (value.strokes === undefined || isPartialStrokes(value.strokes));
};

const isLineEdgeAdjustment = (value: unknown): boolean => isRecord(value)
  && bounded(value.leftInsetPx, -500, 500)
  && bounded(value.rightInsetPx, -500, 500);

const isLineEdgeAdjustments = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.length <= 1000 && value.every(isLineEdgeAdjustment);
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= 1000 && entries.every(([lineId, adjustment]) =>
    lineId.length > 0 && lineId.length <= 160 && isLineEdgeAdjustment(adjustment));
};

export const isTextBackground = (value: unknown): value is RoughBandStyle => isRecord(value)
  && ['none', 'rough-band', 'generatedRoughYellow', 'uploadedImage'].includes(String(value.type))
  && typeof value.enabled === 'boolean' && color(value.color)
  && bounded(value.rotation, -360, 360) && bounded(value.paddingX, 0, 1000) && bounded(value.paddingY, 0, 1000)
  && (value.offsetX === undefined || bounded(value.offsetX, -2000, 2000))
  && (value.offsetY === undefined || bounded(value.offsetY, -2000, 2000))
  && bounded(value.roughness, 0, 1) && bounded(value.seed, -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
  && (value.image === undefined || isEmbeddedBackgroundImage(value.image))
  && (value.imageMode === undefined || value.imageMode === 'fixed' || value.imageMode === 'followLines')
  && (value.horizontalSlice === undefined || (isRecord(value.horizontalSlice)
    && typeof value.horizontalSlice.enabled === 'boolean'
    && bounded(value.horizontalSlice.leftRatio, 0, 0.45)
    && bounded(value.horizontalSlice.rightRatio, 0, 0.45)
    && Number(value.horizontalSlice.leftRatio) + Number(value.horizontalSlice.rightRatio) <= 0.9))
  && (value.lineEdgeAdjustments === undefined || isLineEdgeAdjustments(value.lineEdgeAdjustments))
  && (value.followSettings === undefined || (isRecord(value.followSettings)
    && bounded(value.followSettings.capRatio, 0.05, 0.45)
    && bounded(value.followSettings.seamOverlap, 0, 16)
    && bounded(value.followSettings.lineOverlap, 0, 80)))
  && (value.type !== 'uploadedImage' || !value.enabled || isEmbeddedBackgroundImage(value.image));

const isStrokeStyle = (value: unknown): boolean => isRecord(value)
  && typeof value.enabled === 'boolean' && color(value.color) && bounded(value.width, 0, 40);

export const isProjectTextDefaults = (value: unknown): value is ProjectTextDefaults => {
  if (!isRecord(value) || !isRecord(value.typography) || !isRecord(value.characterScale) || !isRecord(value.shadow)) return false;
  const typography = value.typography;
  const fontWeightAdjust = typeof typography.fontWeightAdjust === 'number'
    && Number.isFinite(typography.fontWeightAdjust)
    && typography.fontWeightAdjust < 0
    ? 0
    : typography.fontWeightAdjust;
  const scales = value.characterScale;
  const shadow = value.shadow;
  return isSafeFontText(typography.fontFamily)
    && (value.rotation === undefined || bounded(value.rotation, -180, 180))
    && (typography.fontRefId === undefined || isSafeFontText(typography.fontRefId))
    && bounded(typography.fontSize, 8, 400)
    && (typography.fontWeight === 400 || typography.fontWeight === 700 || typography.fontWeight === 900)
    && (fontWeightAdjust === undefined || bounded(fontWeightAdjust, 0, 16))
    && (typography.fontStyle === undefined || typography.fontStyle === 'normal' || typography.fontStyle === 'italic' || typography.fontStyle === 'slant')
    && (typography.slant === undefined || bounded(typography.slant, -25, 25))
    && (typography.glyphScaleX === undefined || bounded(typography.glyphScaleX, 0.5, 1.5))
    && (typography.glyphScaleY === undefined || bounded(typography.glyphScaleY, 0.5, 1.5))
    && bounded(typography.letterSpacing, -40, 160)
    && bounded(typography.lineHeight, 0.5, 3)
    && ['left', 'center', 'right'].includes(String(typography.textAlign))
    && ['kanji', 'hiragana', 'katakana', 'latin', 'number', 'symbol'].every((key) => bounded(scales[key], 0.5, 1.5))
    && isFillStyle(value.fill)
    && isStrokeStyle(value.stroke)
    && isStrokeStyle(value.outerStroke)
    && (value.strokes === undefined || isStrokeLayers(value.strokes))
    && typeof shadow.enabled === 'boolean' && color(shadow.color)
    && bounded(shadow.opacity, 0, 1) && bounded(shadow.blur, 0, 50)
    && bounded(shadow.offsetX, -100, 100) && bounded(shadow.offsetY, -100, 100)
    && isTextBackground(value.background);
};
