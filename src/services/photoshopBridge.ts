import { downloadTextFile, sanitizeFileName } from '@/src/services/download';
import { getFrameDisplayLabel } from '@/src/services/frameLabels';
import { getStrokeLayers } from '@/src/services/strokes';
import type { GraphicTextObject, RoughBandStyle, StudioProject } from '@/src/types/editor';
import {
  PHOTOSHOP_BRIDGE_FORMAT,
  PHOTOSHOP_BRIDGE_VERSION,
  type PhotoshopBridgeBackgroundMetadata,
  type PhotoshopBridgeBounds,
  type PhotoshopBridgeFrameV1,
  type PhotoshopBridgeTextObject,
  type PhotoshopBridgeWarning,
} from '@/src/types/photoshopBridge';

const roundGeometry = (value: number): number => Math.round(value * 1000) / 1000;

export const calculatePhotoshopBridgeVisualBounds = (
  object: GraphicTextObject,
): PhotoshopBridgeBounds => {
  const width = Math.max(0, object.size.width * Math.abs(object.transform.scaleX));
  const height = Math.max(0, object.size.height * Math.abs(object.transform.scaleY));
  const radians = (object.transform.rotation * Math.PI) / 180;
  const rotatedWidth = Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians));
  const rotatedHeight = Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians));
  const left = object.position.x - rotatedWidth / 2;
  const top = object.position.y - rotatedHeight / 2;

  return {
    left: roundGeometry(left),
    top: roundGeometry(top),
    right: roundGeometry(left + rotatedWidth),
    bottom: roundGeometry(top + rotatedHeight),
    width: roundGeometry(rotatedWidth),
    height: roundGeometry(rotatedHeight),
  };
};

export const letterSpacingPxToPhotoshopTracking = (
  letterSpacingPx: number,
  fontSizePx: number,
): number => fontSizePx > 0 ? roundGeometry((letterSpacingPx / fontSizePx) * 1000) : 0;

const cloneBackgroundMetadata = (
  background: RoughBandStyle,
  textLineIds: string[] | undefined,
): PhotoshopBridgeBackgroundMetadata => ({
  enabled: background.enabled,
  type: background.type,
  color: background.color,
  rotation: background.rotation,
  paddingX: background.paddingX,
  paddingY: background.paddingY,
  offsetX: background.offsetX ?? 0,
  offsetY: background.offsetY ?? 0,
  roughness: background.roughness,
  seed: background.seed,
  imageMode: background.imageMode ?? 'fixed',
  image: background.image ? {
    id: background.image.id,
    fileName: background.image.fileName,
    sourceMimeType: background.image.sourceMimeType,
    width: background.image.width,
    height: background.image.height,
    sourceSvg: background.image.sourceSvg ? {
      width: background.image.sourceSvg.width,
      height: background.image.sourceSvg.height,
      crop: { ...background.image.sourceSvg.crop },
    } : undefined,
  } : undefined,
  horizontalSlice: background.horizontalSlice ? { ...background.horizontalSlice } : undefined,
  lineEdgeAdjustments: background.lineEdgeAdjustments
    ? Object.fromEntries(Object.entries(background.lineEdgeAdjustments).map(([lineId, value]) => [lineId, { ...value }]))
    : undefined,
  textLineIds: textLineIds ? [...textLineIds] : undefined,
});

const getUnsupportedWarnings = (object: GraphicTextObject): PhotoshopBridgeWarning[] => {
  const warnings: PhotoshopBridgeWarning[] = [];
  if (object.partialStyles.length > 0) {
    warnings.push({ code: 'partial-styles', message: '部分文字スタイルはPhase 3.1Aでは未対応です。' });
  }
  if (object.fill.type === 'linear-gradient') {
    warnings.push({ code: 'gradient', message: `グラデーションは未対応のため、先頭色 ${object.fill.stops[0]?.color ?? '#000000'} を使用します。` });
  }
  if (getStrokeLayers(object).some((stroke) => stroke.enabled && stroke.width > 0)) {
    warnings.push({ code: 'strokes', message: 'フチ1～3はPhase 3.1Aでは未対応です。' });
  }
  if (object.shadow.enabled) {
    warnings.push({ code: 'shadow', message: '影はPhase 3.1Aでは未対応です。' });
  }
  if (object.partialStyles.some((style) => (style.glyphOffsetX ?? 0) !== 0 || (style.glyphOffsetY ?? 0) !== 0)) {
    warnings.push({ code: 'glyph-offsets', message: '部分文字のglyphOffsetX / glyphOffsetYは未対応です。' });
  }
  if ((object.typography.fontWeightAdjust ?? 0) !== 0 || object.partialStyles.some((style) => (style.fontWeightAdjust ?? 0) !== 0)) {
    warnings.push({ code: 'font-weight-adjust', message: '文字の太さ補正はPhase 3.1Aでは未対応です。' });
  }
  if (object.lineGapOffsets.some((value) => value !== 0)) {
    warnings.push({ code: 'line-gap-offsets', message: '行間の個別調整はPhase 3.1Aでは未対応です。' });
  }
  if (object.background.enabled) {
    warnings.push({ code: 'background', message: 'テキスト背景はPhase 3.1Aでは作成されません。' });
  }
  if ((object.typography.fontStyle ?? 'normal') === 'slant' || (object.typography.slant ?? 0) !== 0) {
    warnings.push({ code: 'slant', message: '任意角度の文字傾斜はPhase 3.1Aでは未対応です。' });
  }
  return warnings;
};

const buildTextObject = (
  object: GraphicTextObject,
  fontCatalog: StudioProject['frames'][number]['document']['fontCatalog'],
): PhotoshopBridgeTextObject => {
  const fontReference = fontCatalog.find((font) => font.id === object.typography.fontRefId);
  const visualBounds = calculatePhotoshopBridgeVisualBounds(object);
  const fallbackColor = object.fill.type === 'solid'
    ? object.fill.color
    : object.fill.stops[0]?.color ?? '#000000';

  return {
    objectId: object.id,
    name: object.name,
    type: 'text',
    text: object.text,
    visible: object.visible,
    zIndex: object.zIndex,
    font: {
      family: fontReference?.family ?? object.typography.fontFamily,
      style: fontReference?.style ?? (object.typography.fontStyle === 'italic' ? 'Italic' : 'Regular'),
      weight: fontReference?.weight ?? object.typography.fontWeight,
      postScriptName: fontReference?.postscriptName,
      fullName: fontReference?.fullName,
      source: fontReference?.source,
    },
    fontSizePx: object.typography.fontSize,
    fill: object.fill.type === 'solid'
      ? { type: 'solid', color: fallbackColor, alpha: 1 }
      : {
        type: 'linear-gradient',
        angle: object.fill.angle,
        stops: object.fill.stops.map((stop) => ({ ...stop })),
        fallbackColor,
        alpha: 1,
      },
    letterSpacingPx: object.typography.letterSpacing,
    tracking: letterSpacingPxToPhotoshopTracking(object.typography.letterSpacing, object.typography.fontSize),
    lineHeightPx: roundGeometry(object.typography.fontSize * object.typography.lineHeight),
    horizontalScale: roundGeometry((object.typography.glyphScaleX ?? 1) * Math.abs(object.transform.scaleX) * 100),
    verticalScale: roundGeometry((object.typography.glyphScaleY ?? 1) * Math.abs(object.transform.scaleY) * 100),
    rotationDeg: object.transform.rotation,
    visualBounds,
    center: { x: roundGeometry(object.position.x), y: roundGeometry(object.position.y) },
    metadata: {
      textAlign: object.typography.textAlign,
      fontStyle: object.typography.fontStyle ?? 'normal',
      slantDeg: object.typography.slant ?? 0,
      fontWeightAdjust: object.typography.fontWeightAdjust ?? 0,
      partialStyles: object.partialStyles.map((style) => ({
        ...style,
        fill: style.fill?.type === 'linear-gradient'
          ? { ...style.fill, stops: style.fill.stops.map((stop) => ({ ...stop })) }
          : style.fill ? { ...style.fill } : undefined,
        strokes: style.strokes ? structuredClone(style.strokes) : undefined,
      })),
      strokes: getStrokeLayers(object).map((stroke) => ({ ...stroke })) as PhotoshopBridgeTextObject['metadata']['strokes'],
      shadow: { ...object.shadow },
      lineGapOffsets: [...object.lineGapOffsets],
      glyphOffsets: object.partialStyles
        .filter((style) => style.glyphOffsetX !== undefined || style.glyphOffsetY !== undefined)
        .map((style) => ({
          start: style.start,
          end: style.end,
          glyphOffsetX: style.glyphOffsetX,
          glyphOffsetY: style.glyphOffsetY,
        })),
      objectScale: { x: object.transform.scaleX, y: object.transform.scaleY },
      background: cloneBackgroundMetadata(object.background, object.textLineIds),
    },
    warnings: getUnsupportedWarnings(object),
  };
};

export const buildPhotoshopBridgeFrame = (
  project: StudioProject,
  exportedAt = new Date().toISOString(),
): PhotoshopBridgeFrameV1 => {
  const frameIndex = project.frames.findIndex((frame) => frame.frameId === project.activeFrameId);
  const frame = project.frames[frameIndex] ?? project.frames[0];
  if (!frame) throw new Error('書き出せるコマがありません。');

  return {
    format: PHOTOSHOP_BRIDGE_FORMAT,
    version: PHOTOSHOP_BRIDGE_VERSION,
    exportedAt,
    projectName: project.projectName,
    frameId: frame.frameId,
    frameLabel: getFrameDisplayLabel(Math.max(0, frameIndex)),
    canvasWidth: frame.document.canvas.width,
    canvasHeight: frame.document.canvas.height,
    objects: [...frame.document.objects]
      .sort((left, right) => left.zIndex - right.zIndex)
      .map((object) => buildTextObject(object, frame.document.fontCatalog)),
  };
};

export const validatePhotoshopBridge = (value: unknown): value is PhotoshopBridgeFrameV1 => {
  if (!value || typeof value !== 'object') return false;
  const bridge = value as Partial<PhotoshopBridgeFrameV1>;
  if (bridge.format !== PHOTOSHOP_BRIDGE_FORMAT || bridge.version !== PHOTOSHOP_BRIDGE_VERSION) return false;
  if (typeof bridge.canvasWidth !== 'number' || bridge.canvasWidth <= 0) return false;
  if (typeof bridge.canvasHeight !== 'number' || bridge.canvasHeight <= 0) return false;
  if (!Array.isArray(bridge.objects)) return false;
  return bridge.objects.every((object) => (
    object?.type === 'text'
    && typeof object.objectId === 'string'
    && typeof object.text === 'string'
    && typeof object.fontSizePx === 'number'
    && typeof object.center?.x === 'number'
    && typeof object.center?.y === 'number'
  ));
};

export const serializePhotoshopBridge = (bridge: PhotoshopBridgeFrameV1): string => {
  if (!validatePhotoshopBridge(bridge)) throw new Error('Photoshop Bridgeデータが不正です。');
  return JSON.stringify(bridge, null, 2);
};

export const downloadPhotoshopBridgeFrame = (project: StudioProject): PhotoshopBridgeFrameV1 => {
  const bridge = buildPhotoshopBridgeFrame(project);
  downloadTextFile(
    serializePhotoshopBridge(bridge),
    `${sanitizeFileName(bridge.frameLabel)}.tgsps.json`,
    'application/json;charset=utf-8',
  );
  return bridge;
};
