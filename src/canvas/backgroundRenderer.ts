/* oxlint-disable typescript/no-deprecated -- Existing Fabric group uses center origins. */
import { FabricImage, Polygon, type FabricObject } from 'fabric';
import { createRoughBandPoints } from '@/src/canvas/roughBand';
import { getPreparedBackgroundImage } from '@/src/services/textBackgroundAssets';
import { calculateHorizontalSliceGeometry } from '@/src/services/horizontalSlice';
import { calculateAdjustedLineBackgroundBounds, getLogicalLineEdgeAdjustment } from '@/src/services/lineEdgeAdjustments';
import type { RoughBandStyle } from '@/src/types/editor';

export const BACKGROUND_TYPES = [
  { value: 'none', label: 'なし' },
  { value: 'generatedRoughYellow', label: '黄色ラフ背景' },
  { value: 'uploadedImage', label: '画像背景（PNG / SVG）' },
] as const;

export const effectiveBackgroundType = (background: RoughBandStyle) => !background.enabled ? 'none' : background.type === 'rough-band' ? 'generatedRoughYellow' : background.type;

export interface TextLineLayout {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  logicalLineIndex: number;
}

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

/** Draw an explicitly configured asymmetric horizontal 3-slice. */
export const drawHorizontalThreeSlice = (context: CanvasRenderingContext2D, style: RoughBandStyle, width: number, height: number): void => {
  if (!style.image || !style.horizontalSlice?.enabled) return;
  const source = getPreparedBackgroundImage(style.image);
  const geometry = calculateHorizontalSliceGeometry(source.width, source.height, width, height, style.horizontalSlice);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  const overlap = Math.max(0.5, style.followSettings?.seamOverlap ?? 2) * source.width / style.image.width;
  const draw = (sx: number, sw: number, dx: number, dw: number) => {
    if (sw <= 0 || dw <= 0) return;
    const scale = dw / Math.max(sw, 0.0001);
    const overscan = Math.max(overlap, 0.5 / Math.max(scale, 0.0001));
    const before = Math.min(overscan, sx);
    const after = Math.min(overscan, geometry.sourceWidth - sx - sw);
    context.drawImage(
      source,
      sx - before,
      0,
      sw + before + after,
      geometry.sourceHeight,
      dx - before * scale,
      0,
      dw + (before + after) * scale,
      geometry.targetHeight,
    );
  };
  draw(0, geometry.sourceLeftWidth, 0, geometry.targetLeftWidth);
  draw(
    geometry.sourceLeftWidth,
    geometry.sourceCenterWidth,
    geometry.targetLeftWidth,
    geometry.targetCenterWidth,
  );
  draw(
    geometry.sourceWidth - geometry.sourceRightWidth,
    geometry.sourceRightWidth,
    geometry.targetWidth - geometry.targetRightWidth,
    geometry.targetRightWidth,
  );
};

const explicitSliceWidth = (style: RoughBandStyle, width: number, height: number): number => {
  if (!style.image || !style.horizontalSlice?.enabled) return width;
  const source = getPreparedBackgroundImage(style.image);
  return calculateHorizontalSliceGeometry(source.width, source.height, width, height, style.horizontalSlice).targetWidth;
};

const drawUploadedLine = (context: CanvasRenderingContext2D, style: RoughBandStyle, width: number, height: number): void => {
  if (!style.image) return;
  if (style.horizontalSlice?.enabled) {
    drawHorizontalThreeSlice(context, style, width, height);
    return;
  }
  if (style.horizontalSlice === undefined) {
    // Preserve the pre-3.0.12 followLines rendering for old projects without explicit metadata.
    drawThreeSlice(context, style, width, height);
    return;
  }
  const source = getPreparedBackgroundImage(style.image);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, source.width, source.height, 0, 0, width, height);
};

const createHorizontalSliceBackground = (style: RoughBandStyle, width: number, height: number, outputScale: number): FabricObject | null => {
  if (!style.image || !style.horizontalSlice?.enabled) return null;
  const logicalWidth = explicitSliceWidth(style, width, height);
  const logicalHeight = Math.max(1, height);
  const resolution = Math.min(Math.max(2, outputScale * 2), 4,
    4096 / logicalWidth, 4096 / logicalHeight, Math.sqrt(4 * 1024 * 1024 / (logicalWidth * logicalHeight)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(logicalWidth * resolution));
  canvas.height = Math.max(1, Math.ceil(logicalHeight * resolution));
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.scale(canvas.width / logicalWidth, canvas.height / logicalHeight);
  drawHorizontalThreeSlice(context, style, logicalWidth, logicalHeight);
  return new FabricImage(canvas, {
    originX: 'center',
    originY: 'center',
    scaleX: logicalWidth / canvas.width,
    scaleY: logicalHeight / canvas.height,
  });
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

const createFollowLinesBackground = (style: RoughBandStyle, lines: TextLineLayout[], lineIds: readonly string[], outputScale: number): FabricObject | null => {
  if (!style.image || !lines.length) return null;
  const settings = style.followSettings ?? { capRatio: 0.22, seamOverlap: 2, lineOverlap: 6 };
  const entries = lines.map((line) => {
    const height = Math.max(1, line.height + style.paddingY * 2 + settings.lineOverlap);
    const adjusted = calculateAdjustedLineBackgroundBounds(
      line,
      style.paddingX,
      getLogicalLineEdgeAdjustment(style.lineEdgeAdjustments, lineIds, line.logicalLineIndex),
    );
    return {
      line: { ...line, centerX: adjusted.centerX },
      width: explicitSliceWidth(style, adjusted.width, height),
      height,
    };
  });
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
    drawUploadedLine(context, style, entry.width, entry.height);
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

export const createTextBackground = (style: RoughBandStyle, textWidth: number, textHeight: number, lines: TextLineLayout[] = [], outputScale = 1, lineIds: readonly string[] = []): FabricObject | null => {
  if (effectiveBackgroundType(style) === 'uploadedImage' && style.imageMode === 'followLines') {
    const followed = createFollowLinesBackground(style, lines, lineIds, outputScale);
    followed?.set({ selectable: false, evented: false, objectCaching: false });
    return followed;
  }
  const renderer = renderers[effectiveBackgroundType(style)];
  const width = textWidth + style.paddingX * 2;
  const height = textHeight + style.paddingY * 2;
  const background = effectiveBackgroundType(style) === 'uploadedImage' && style.horizontalSlice?.enabled
    ? createHorizontalSliceBackground(style, width, height, outputScale)
    : renderer(style, width, height);
  background?.set({ left: style.offsetX ?? 0, top: style.offsetY ?? 0, originX: 'center', originY: 'center', angle: style.rotation, selectable: false, evented: false, objectCaching: false });
  return background;
};
