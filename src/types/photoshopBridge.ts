import type {
  FontReference,
  LineEdgeAdjustment,
  PartialTextStyle,
  ShadowStyle,
  StrokeLayers,
} from '@/src/types/editor';

export const PHOTOSHOP_BRIDGE_FORMAT = 'text-graphic-studio-photoshop-bridge' as const;
export const PHOTOSHOP_BRIDGE_LEGACY_VERSION = 1 as const;
export const PHOTOSHOP_BRIDGE_VERSION = 2 as const;

export interface PhotoshopBridgeBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface PhotoshopBridgeWarning {
  code: string;
  message: string;
}

export type PhotoshopBridgeAssetKind = 'background-render' | 'background-source-raster';

export interface PhotoshopBridgeAsset {
  assetId: string;
  kind: PhotoshopBridgeAssetKind;
  mimeType: 'image/png';
  encoding: 'base64';
  width: number;
  height: number;
  data: string;
}

export interface PhotoshopBridgeFont {
  family: string;
  style?: string;
  weight: number;
  postScriptName?: string;
  fullName?: string;
  source?: FontReference['source'];
}

export type PhotoshopBridgeFill =
  | { type: 'solid'; color: string; alpha: number }
  | {
    type: 'linear-gradient';
    angle: number;
    stops: Array<{ offset: number; color: string }>;
    fallbackColor: string;
    alpha: number;
  };

export interface PhotoshopBridgeBackgroundMetadata {
  enabled: boolean;
  type: string;
  color: string;
  rotation: number;
  paddingX: number;
  paddingY: number;
  offsetX: number;
  offsetY: number;
  roughness: number;
  seed: number;
  imageMode: 'fixed' | 'followLines';
  image?: {
    id: string;
    fileName: string;
    sourceMimeType: 'image/png' | 'image/svg+xml';
    width: number;
    height: number;
    sourceSvg?: {
      width: number;
      height: number;
      crop: { x: number; y: number; width: number; height: number };
    };
  };
  horizontalSlice?: {
    enabled: boolean;
    leftRatio: number;
    rightRatio: number;
  };
  lineEdgeAdjustments?: Record<string, LineEdgeAdjustment>;
  textLineIds?: string[];
  renderedAssetId?: string;
  sourceRasterAssetId?: string;
  renderBounds?: PhotoshopBridgeBounds;
}

export interface PhotoshopBridgeTextObject {
  objectId: string;
  name: string;
  type: 'text';
  text: string;
  visible: boolean;
  zIndex: number;
  font: PhotoshopBridgeFont;
  fontSizePx: number;
  fill: PhotoshopBridgeFill;
  letterSpacingPx: number;
  tracking: number;
  lineHeightPx: number;
  horizontalScale: number;
  verticalScale: number;
  rotationDeg: number;
  visualBounds: PhotoshopBridgeBounds;
  center: { x: number; y: number };
  metadata: {
    textAlign: 'left' | 'center' | 'right';
    fontStyle: 'normal' | 'italic' | 'slant';
    slantDeg: number;
    fontWeightAdjust: number;
    partialStyles: PartialTextStyle[];
    strokes: StrokeLayers;
    shadow: ShadowStyle;
    lineGapOffsets: number[];
    glyphOffsets: Array<{
      start: number;
      end: number;
      glyphOffsetX?: number;
      glyphOffsetY?: number;
    }>;
    objectScale: { x: number; y: number };
    background: PhotoshopBridgeBackgroundMetadata;
  };
  warnings: PhotoshopBridgeWarning[];
}

export interface PhotoshopBridgeFrameV1 {
  format: typeof PHOTOSHOP_BRIDGE_FORMAT;
  version: typeof PHOTOSHOP_BRIDGE_LEGACY_VERSION;
  exportedAt: string;
  projectName: string;
  frameId: string;
  frameLabel: string;
  canvasWidth: number;
  canvasHeight: number;
  objects: PhotoshopBridgeTextObject[];
}

export interface PhotoshopBridgeFrameV2 extends Omit<PhotoshopBridgeFrameV1, 'version'> {
  version: typeof PHOTOSHOP_BRIDGE_VERSION;
  assets: PhotoshopBridgeAsset[];
}

export type PhotoshopBridgeFrame = PhotoshopBridgeFrameV1 | PhotoshopBridgeFrameV2;
