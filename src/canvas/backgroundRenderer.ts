/* oxlint-disable typescript/no-deprecated -- Existing Fabric group uses center origins. */
import { FabricImage, Polygon, type FabricObject } from 'fabric';
import { createRoughBandPoints } from '@/src/canvas/roughBand';
import { getPreparedBackgroundImage } from '@/src/services/textBackgroundAssets';
import type { RoughBandStyle } from '@/src/types/editor';

export const BACKGROUND_TYPES = [
  { value: 'none', label: 'なし' },
  { value: 'generatedRoughYellow', label: '黄色ラフ背景' },
  { value: 'uploadedImage', label: '画像背景（PNG / SVG）' },
] as const;

export const effectiveBackgroundType = (background: RoughBandStyle) => !background.enabled ? 'none' : background.type === 'rough-band' ? 'generatedRoughYellow' : background.type;

export interface TextLineLayout { width: number; height: number; centerX: number; centerY: number }

type Renderer = (style: RoughBandStyle, width: number, height: number) => FabricObject | null;
const renderers: Record<(typeof BACKGROUND_TYPES)[number]['value'], Renderer> = {
  none: () => null,
  generatedRoughYellow: (style, width, height) => new Polygon(createRoughBandPoints(width, height, style.roughness, style.seed), { fill: style.color }),
  uploadedImage: (style, width, height) => {
    if (!style.image) return null;
    return new FabricImage(getPreparedBackgroundImage(style.image), { scaleX: width / style.image.width, scaleY: height / style.image.height });
  },
};

const createThreeSliceCanvas = (style: RoughBandStyle, width: number, height: number): HTMLCanvasElement | null => {
  if (!style.image) return null;
  const source = getPreparedBackgroundImage(style.image);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  const settings = style.followSettings ?? { capRatio: 0.22, seamOverlap: 2, lineOverlap: 6 };
  const sourceWidth = Math.max(1, style.image.width);
  const sourceHeight = Math.max(1, style.image.height);
  const cap = Math.max(1, Math.round(sourceWidth * settings.capRatio));
  const overlap = Math.min(settings.seamOverlap, cap - 1);
  const scaledCap = cap * canvas.height / sourceHeight;
  if (canvas.width <= scaledCap * 2 + 2) {
    context.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    return canvas;
  }
  const leftEnd = Math.max(1, Math.round(scaledCap));
  const rightStart = Math.min(canvas.width - 1, canvas.width - leftEnd);
  // Source crops overlap slightly; destination clips share integer boundaries, avoiding both gaps and alpha darkening.
  context.drawImage(source, 0, 0, cap + overlap, sourceHeight, 0, 0, leftEnd, canvas.height);
  context.drawImage(
    source,
    cap - overlap,
    0,
    Math.max(1, sourceWidth - cap * 2 + overlap * 2),
    sourceHeight,
    leftEnd,
    0,
    Math.max(1, rightStart - leftEnd),
    canvas.height,
  );
  context.drawImage(source, sourceWidth - cap - overlap, 0, cap + overlap, sourceHeight, rightStart, 0, canvas.width - rightStart, canvas.height);
  return canvas;
};

const rotatedBounds = (line: TextLineLayout, width: number, height: number, angle: number) => {
  const radians = angle * Math.PI / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  const halfWidth = width / 2, halfHeight = height / 2;
  const points = [
    [-halfWidth, -halfHeight], [halfWidth, -halfHeight],
    [halfWidth, halfHeight], [-halfWidth, halfHeight],
  ].map(([x, y]) => ({ x: line.centerX + x * cos - y * sin, y: line.centerY + x * sin + y * cos }));
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
};

const createFollowLinesBackground = (style: RoughBandStyle, lines: TextLineLayout[]): FabricObject | null => {
  if (!style.image || !lines.length) return null;
  const settings = style.followSettings ?? { capRatio: 0.22, seamOverlap: 2, lineOverlap: 6 };
  const entries = lines.map((line) => ({
    line,
    width: Math.max(1, line.width + style.paddingX * 2),
    height: Math.max(1, line.height + style.paddingY * 2 + settings.lineOverlap),
  }));
  const bounds = entries.map((entry) => rotatedBounds(entry.line, entry.width, entry.height, style.rotation));
  const minX = Math.min(...bounds.map((bound) => bound.minX));
  const maxX = Math.max(...bounds.map((bound) => bound.maxX));
  const minY = Math.min(...bounds.map((bound) => bound.minY));
  const maxY = Math.max(...bounds.map((bound) => bound.maxY));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(maxX - minX));
  canvas.height = Math.max(1, Math.ceil(maxY - minY));
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  entries.forEach((entry) => {
    const sliced = createThreeSliceCanvas(style, entry.width, entry.height);
    if (!sliced) return;
    context.save();
    context.translate(entry.line.centerX - minX, entry.line.centerY - minY);
    context.rotate(style.rotation * Math.PI / 180);
    context.drawImage(sliced, -entry.width / 2, -entry.height / 2, entry.width, entry.height);
    context.restore();
  });
  return new FabricImage(canvas, {
    left: (minX + maxX) / 2,
    top: (minY + maxY) / 2,
    originX: 'center',
    originY: 'center',
  });
};

export const createTextBackground = (style: RoughBandStyle, textWidth: number, textHeight: number, lines: TextLineLayout[] = []): FabricObject | null => {
  if (effectiveBackgroundType(style) === 'uploadedImage' && style.imageMode === 'followLines') {
    const followed = createFollowLinesBackground(style, lines);
    followed?.set({ selectable: false, evented: false, objectCaching: false });
    return followed;
  }
  const renderer = renderers[effectiveBackgroundType(style)];
  const background = renderer(style, textWidth + style.paddingX * 2, textHeight + style.paddingY * 2);
  background?.set({ left: 0, top: 0, originX: 'center', originY: 'center', angle: style.rotation, selectable: false, evented: false, objectCaching: false });
  return background;
};
