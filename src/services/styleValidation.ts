import { isEmbeddedBackgroundImage } from '@/src/services/textBackgroundAssets';
import type { ColorPalette, FillStyle, FontReference, PartialTextStyle, RoughBandStyle } from '@/src/types/editor';

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

export const isPartialTextStyle = (value: unknown): value is PartialTextStyle => isRecord(value)
  && bounded(value.start, 0, 1000000) && Number.isInteger(value.start)
  && bounded(value.end, value.start + 1, 1000000) && Number.isInteger(value.end)
  && (value.fill === undefined || isFillStyle(value.fill))
  && (value.fontScale === undefined || bounded(value.fontScale, 0.05, 20))
  && (value.fontSize === undefined || bounded(value.fontSize, 8, 400))
  && (value.letterSpacing === undefined || bounded(value.letterSpacing, -40, 160))
  && (value.fontWeight === undefined || value.fontWeight === 400 || value.fontWeight === 700 || value.fontWeight === 900)
  && (value.fontFamily === undefined || isSafeFontText(value.fontFamily))
  && (value.fontRefId === undefined || isSafeFontText(value.fontRefId))
  && (value.fontStyle === undefined || value.fontStyle === 'normal' || value.fontStyle === 'italic')
  && (value.glyphScaleX === undefined || bounded(value.glyphScaleX, 0.5, 1.5))
  && (value.glyphScaleY === undefined || bounded(value.glyphScaleY, 0.5, 1.5))
  && (value.glyphOffsetY === undefined || bounded(value.glyphOffsetY, -100, 100))
  && (value.strokes === undefined || isPartialStrokes(value.strokes));

export const isTextBackground = (value: unknown): value is RoughBandStyle => isRecord(value)
  && ['none', 'rough-band', 'generatedRoughYellow', 'uploadedImage'].includes(String(value.type))
  && typeof value.enabled === 'boolean' && color(value.color)
  && bounded(value.rotation, -360, 360) && bounded(value.paddingX, 0, 1000) && bounded(value.paddingY, 0, 1000)
  && (value.offsetX === undefined || bounded(value.offsetX, -2000, 2000))
  && (value.offsetY === undefined || bounded(value.offsetY, -2000, 2000))
  && bounded(value.roughness, 0, 1) && bounded(value.seed, -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
  && (value.image === undefined || isEmbeddedBackgroundImage(value.image))
  && (value.imageMode === undefined || value.imageMode === 'fixed' || value.imageMode === 'followLines')
  && (value.followSettings === undefined || (isRecord(value.followSettings)
    && bounded(value.followSettings.capRatio, 0.05, 0.45)
    && bounded(value.followSettings.seamOverlap, 0, 16)
    && bounded(value.followSettings.lineOverlap, 0, 80)))
  && (value.type !== 'uploadedImage' || !value.enabled || isEmbeddedBackgroundImage(value.image));
