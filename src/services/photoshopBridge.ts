import { downloadTextFile, sanitizeFileName } from '@/src/services/download';
import { getFrameDisplayLabel } from '@/src/services/frameLabels';
import {
  renderPhotoshopBridgeBackground,
  type RenderedPhotoshopBridgeBackground,
} from '@/src/services/photoshopBridgeBackground';
import { getStrokeLayers } from '@/src/services/strokes';
import type { GraphicTextObject, RoughBandStyle, StudioProject } from '@/src/types/editor';
import {
  PHOTOSHOP_BRIDGE_FORMAT,
  PHOTOSHOP_BRIDGE_LEGACY_VERSION,
  PHOTOSHOP_BRIDGE_VERSION,
  type PhotoshopBridgeAsset,
  type PhotoshopBridgeBackgroundMetadata,
  type PhotoshopBridgeBounds,
  type PhotoshopBridgeFrame,
  type PhotoshopBridgeFrameV1,
  type PhotoshopBridgeFrameV2,
  type PhotoshopBridgeTextObject,
  type PhotoshopBridgeWarning,
} from '@/src/types/photoshopBridge';

const roundGeometry = (value: number): number => Math.round(value * 1000) / 1000;
export const PHOTOSHOP_BRIDGE_MAX_ASSET_BYTES = 12 * 1024 * 1024;
export const PHOTOSHOP_BRIDGE_MAX_TOTAL_ASSET_BYTES = 32 * 1024 * 1024;
export const PHOTOSHOP_BRIDGE_MAX_ASSET_PIXELS = 16_000_000;

export type PhotoshopBridgeBackgroundRenderer = (
  object: GraphicTextObject,
) => Promise<RenderedPhotoshopBridgeBackground | null>;

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

const getActiveFrame = (project: StudioProject) => {
  const frameIndex = project.frames.findIndex((frame) => frame.frameId === project.activeFrameId);
  const frame = project.frames[frameIndex] ?? project.frames[0];
  if (!frame) throw new Error('書き出せるコマがありません。');
  return { frame, frameIndex };
};

export const buildPhotoshopBridgeFrameV1 = (
  project: StudioProject,
  exportedAt = new Date().toISOString(),
): PhotoshopBridgeFrameV1 => {
  const { frame, frameIndex } = getActiveFrame(project);
  return {
    format: PHOTOSHOP_BRIDGE_FORMAT,
    version: PHOTOSHOP_BRIDGE_LEGACY_VERSION,
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

const parsePngDataUrl = (dataUrl: string): string | null => {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  return match?.[1] ?? null;
};

const estimateBase64Bytes = (data: string): number =>
  Math.max(0, Math.floor((data.length * 3) / 4) - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0));

const safeAssetSegment = (value: string): string =>
  value.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'text';

const assertAssetSize = (asset: PhotoshopBridgeAsset, totalBytes: number): number => {
  const bytes = estimateBase64Bytes(asset.data);
  if (
    bytes > PHOTOSHOP_BRIDGE_MAX_ASSET_BYTES
    || asset.width * asset.height > PHOTOSHOP_BRIDGE_MAX_ASSET_PIXELS
    || totalBytes + bytes > PHOTOSHOP_BRIDGE_MAX_TOTAL_ASSET_BYTES
  ) {
    throw new Error('Photoshop Bridge背景assetが大きすぎます。背景画像の解像度または数を減らしてください。');
  }
  return totalBytes + bytes;
};

export const buildPhotoshopBridgeFrame = async (
  project: StudioProject,
  exportedAt = new Date().toISOString(),
  backgroundRenderer: PhotoshopBridgeBackgroundRenderer = renderPhotoshopBridgeBackground,
): Promise<PhotoshopBridgeFrameV2> => {
  const { frame, frameIndex } = getActiveFrame(project);
  const models = [...frame.document.objects].sort((left, right) => left.zIndex - right.zIndex);
  const objects = models.map((object) => buildTextObject(object, frame.document.fontCatalog));
  const assets: PhotoshopBridgeAsset[] = [];
  const sourceAssetIds = new Map<string, string>();
  let totalAssetBytes = 0;

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];
    const object = objects[index];
    if (!model.background.enabled) continue;
    try {
      const rendered = await backgroundRenderer(model);
      if (!rendered) {
        object.warnings.push({ code: 'background-render', message: '背景render assetを生成できませんでした。' });
        continue;
      }
      const renderedData = parsePngDataUrl(rendered.dataUrl);
      if (!renderedData) throw new Error('背景render assetがPNG data URLではありません。');
      const renderedAsset: PhotoshopBridgeAsset = {
        assetId: `bg-render-${safeAssetSegment(model.id)}`,
        kind: 'background-render',
        mimeType: 'image/png',
        encoding: 'base64',
        width: rendered.width,
        height: rendered.height,
        data: renderedData,
      };
      totalAssetBytes = assertAssetSize(renderedAsset, totalAssetBytes);
      assets.push(renderedAsset);
      object.metadata.background.renderedAssetId = renderedAsset.assetId;
      object.metadata.background.renderBounds = { ...rendered.renderBounds };

      const sourceImage = model.background.image;
      const sourceDataUrl = sourceImage?.dataUrl;
      if (sourceImage && sourceDataUrl) {
        let sourceAssetId = sourceAssetIds.get(sourceDataUrl);
        if (!sourceAssetId) {
          const sourceData = parsePngDataUrl(sourceDataUrl);
          if (!sourceData) throw new Error('背景source assetがportable PNGではありません。');
          sourceAssetId = `bg-source-${sourceAssetIds.size + 1}`;
          const sourceAsset: PhotoshopBridgeAsset = {
            assetId: sourceAssetId,
            kind: 'background-source-raster',
            mimeType: 'image/png',
            encoding: 'base64',
            width: sourceImage.width,
            height: sourceImage.height,
            data: sourceData,
          };
          totalAssetBytes = assertAssetSize(sourceAsset, totalAssetBytes);
          assets.push(sourceAsset);
          sourceAssetIds.set(sourceDataUrl, sourceAssetId);
        }
        object.metadata.background.sourceRasterAssetId = sourceAssetId;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith('Photoshop Bridge背景assetが大きすぎます')) throw error;
      object.warnings.push({ code: 'background-render', message: `背景assetを生成できませんでした（${message}）。` });
    }
  }

  return {
    format: PHOTOSHOP_BRIDGE_FORMAT,
    version: PHOTOSHOP_BRIDGE_VERSION,
    exportedAt,
    projectName: project.projectName,
    frameId: frame.frameId,
    frameLabel: getFrameDisplayLabel(Math.max(0, frameIndex)),
    canvasWidth: frame.document.canvas.width,
    canvasHeight: frame.document.canvas.height,
    objects,
    assets,
  };
};

export const validatePhotoshopBridge = (value: unknown): value is PhotoshopBridgeFrame => {
  if (!value || typeof value !== 'object') return false;
  const bridge = value as Partial<PhotoshopBridgeFrame>;
  if (
    bridge.format !== PHOTOSHOP_BRIDGE_FORMAT
    || (bridge.version !== PHOTOSHOP_BRIDGE_LEGACY_VERSION && bridge.version !== PHOTOSHOP_BRIDGE_VERSION)
  ) return false;
  if (typeof bridge.canvasWidth !== 'number' || bridge.canvasWidth <= 0) return false;
  if (typeof bridge.canvasHeight !== 'number' || bridge.canvasHeight <= 0) return false;
  if (!Array.isArray(bridge.objects)) return false;
  if (!bridge.objects.every((object) => (
    object?.type === 'text'
    && typeof object.objectId === 'string'
    && typeof object.text === 'string'
    && typeof object.fontSizePx === 'number'
    && typeof object.center?.x === 'number'
    && typeof object.center?.y === 'number'
  ))) return false;
  if (bridge.version === PHOTOSHOP_BRIDGE_VERSION) {
    const assets = (bridge as Partial<PhotoshopBridgeFrameV2>).assets;
    if (!Array.isArray(assets)) return false;
    return assets.every((asset) => (
      typeof asset?.assetId === 'string'
      && (asset.kind === 'background-render' || asset.kind === 'background-source-raster')
      && asset.mimeType === 'image/png'
      && asset.encoding === 'base64'
      && typeof asset.data === 'string'
      && Number.isFinite(asset.width) && asset.width > 0
      && Number.isFinite(asset.height) && asset.height > 0
    ));
  }
  return true;
};

export const serializePhotoshopBridge = (bridge: PhotoshopBridgeFrame): string => {
  if (!validatePhotoshopBridge(bridge)) throw new Error('Photoshop Bridgeデータが不正です。');
  return JSON.stringify(bridge, null, 2);
};

export const downloadPhotoshopBridgeFrame = async (project: StudioProject): Promise<PhotoshopBridgeFrameV2> => {
  const bridge = await buildPhotoshopBridgeFrame(project);
  downloadTextFile(
    serializePhotoshopBridge(bridge),
    `${sanitizeFileName(bridge.frameLabel)}.tgsps.json`,
    'application/json;charset=utf-8',
  );
  return bridge;
};
