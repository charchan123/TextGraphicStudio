import { isEmbeddedBackgroundImage } from '@/src/services/textBackgroundAssets';
import type { FillStyle, PartialTextStyle, RoughBandStyle } from '@/src/types/editor';

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
export const bounded = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const color = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value);

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
  && (value.fontWeight === undefined || value.fontWeight === 400 || value.fontWeight === 700 || value.fontWeight === 900);

export const isTextBackground = (value: unknown): value is RoughBandStyle => isRecord(value)
  && ['none', 'rough-band', 'generatedRoughYellow', 'uploadedImage'].includes(String(value.type))
  && typeof value.enabled === 'boolean' && color(value.color)
  && bounded(value.rotation, -360, 360) && bounded(value.paddingX, 0, 1000) && bounded(value.paddingY, 0, 1000)
  && bounded(value.roughness, 0, 1) && bounded(value.seed, -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
  && (value.image === undefined || isEmbeddedBackgroundImage(value.image))
  && (value.type !== 'uploadedImage' || !value.enabled || isEmbeddedBackgroundImage(value.image));
