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
    const source = getPreparedBackgroundImage(style.image);
    return new FabricImage(source, { scaleX: width / source.width, scaleY: height / source.height });
  },
};

export const drawThreeSlice = (context: CanvasRenderingContext2D, style: RoughBandStyle, width: number, height: number): void => {
  if (!style.image) return;
  const source = getPreparedBackgroundImage(style.image);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  const settings = style.followSettings ?? { capRatio: 0.22, seamOverlap: 2, lineOverlap: 6 };
  const sourceWidth = Math.max(1, source.width);
  const sourceHeight = Math.max(1, source.height);
  const cap = sourceWidth * settings.capRatio;
  const ratio = height / sourceHeight;
  const scaledCap = cap * ratio;
  if (width <= scaledCap * 2 + 2) {
    context.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, width, height);
    return;
  }
  const centerWidth = width - scaledCap * 2;
  // Retain the cap scale. Crop the middle when it is already wide enough.
  const middleSourceWidth = Math.min(sourceWidth - cap * 2, centerWidth / ratio);
  const middleStart = (sourceWidth - middleSourceWidth) / 2;
  // Overlap in destination space too: adjacent antialiased clip edges leave a pale seam.
  // Sample the neighboring original pixels, rather than stretching the cap into that overlap.
  const overlap = Math.max(2, settings.seamOverlap) * sourceWidth / style.image.width;
  const draw = (sx: number, sw: number, dx: number, dw: number) => {
    const scale = dw / sw;
    const overscan = Math.max(overlap, 0.5 / scale);
    const before = Math.min(overscan, sx), after = Math.min(overscan, sourceWidth - sx - sw);
    context.drawImage(source, sx - before, 0, sw + before + after, sourceHeight, dx - before * scale, 0, dw + (before + after) * scale, height);
  };
  draw(0, cap, 0, scaledCap);
  draw(middleStart, middleSourceWidth, scaledCap, centerWidth);
  draw(sourceWidth - cap, cap, width - scaledCap, scaledCap);
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

const createFollowLinesBackground = (style: RoughBandStyle, lines: TextLineLayout[], outputScale: number): FabricObject | null => {
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
  const logicalWidth = Math.max(1, maxX - minX), logicalHeight = Math.max(1, maxY - minY);
  // One bounded working bitmap. Never shrink each line first, then rotate that low-resolution bitmap.
  const resolution = Math.min(Math.max(2, outputScale * 2), 4,
    4096 / logicalWidth, 4096 / logicalHeight, Math.sqrt(4 * 1024 * 1024 / (logicalWidth * logicalHeight)));
  canvas.width = Math.max(1, Math.ceil(logicalWidth * resolution));
  canvas.height = Math.max(1, Math.ceil(logicalHeight * resolution));
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.scale(canvas.width / logicalWidth, canvas.height / logicalHeight);
  entries.forEach((entry) => {
    context.save();
    context.translate(entry.line.centerX - minX, entry.line.centerY - minY);
    context.rotate(style.rotation * Math.PI / 180);
    context.translate(-entry.width / 2, -entry.height / 2);
    drawThreeSlice(context, style, entry.width, entry.height);
    context.restore();
  });
  return new FabricImage(canvas, {
    left: (minX + maxX) / 2 + (style.offsetX ?? 0),
    top: (minY + maxY) / 2 + (style.offsetY ?? 0),
    originX: 'center',
    originY: 'center',
    scaleX: logicalWidth / canvas.width,
    scaleY: logicalHeight / canvas.height,
  });
};

export const createTextBackground = (style: RoughBandStyle, textWidth: number, textHeight: number, lines: TextLineLayout[] = [], outputScale = 1): FabricObject | null => {
  if (effectiveBackgroundType(style) === 'uploadedImage' && style.imageMode === 'followLines') {
    const followed = createFollowLinesBackground(style, lines, outputScale);
    followed?.set({ selectable: false, evented: false, objectCaching: false });
    return followed;
  }
  const renderer = renderers[effectiveBackgroundType(style)];
  const background = renderer(style, textWidth + style.paddingX * 2, textHeight + style.paddingY * 2);
  background?.set({ left: style.offsetX ?? 0, top: style.offsetY ?? 0, originX: 'center', originY: 'center', angle: style.rotation, selectable: false, evented: false, objectCaching: false });
  return background;
};
