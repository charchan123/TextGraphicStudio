export type CanvasPresetId = 'landscape' | 'portrait' | 'square' | 'custom';
export type TextAlignment = 'left' | 'center' | 'right';

export interface Point2D {
  x: number;
  y: number;
}

export interface Size2D {
  width: number;
  height: number;
}

export interface SolidFill {
  type: 'solid';
  color: string;
}

export interface LinearGradientFill {
  type: 'linear-gradient';
  angle: number;
  stops: Array<{ offset: number; color: string }>;
}

export type FillStyle = SolidFill | LinearGradientFill;

export interface TypographyStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: 400 | 700 | 900;
  letterSpacing: number;
  lineHeight: number;
  textAlign: TextAlignment;
}

export interface CharacterScaleStyle {
  kanji: number;
  hiragana: number;
  katakana: number;
  latin: number;
  number: number;
}

export interface StrokeStyle {
  enabled: boolean;
  color: string;
  width: number;
}

export interface ShadowStyle {
  enabled: boolean;
  color: string;
  opacity: number;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface RoughBandStyle {
  enabled: boolean;
  type: 'rough-band';
  color: string;
  rotation: number;
  paddingX: number;
  paddingY: number;
  roughness: number;
  seed: number;
}

export interface PartialTextStyle {
  start: number;
  end: number;
  fill?: FillStyle;
  fontScale?: number;
}

export interface GraphicTextObject {
  kind: 'graphic-text';
  schemaVersion: 1;
  id: string;
  name: string;
  text: string;
  position: Point2D;
  size: Size2D;
  transform: {
    scaleX: number;
    scaleY: number;
    rotation: number;
  };
  typography: TypographyStyle;
  characterScale: CharacterScaleStyle;
  fill: FillStyle;
  stroke: StrokeStyle;
  outerStroke: StrokeStyle;
  shadow: ShadowStyle;
  background: RoughBandStyle;
  partialStyles: PartialTextStyle[];
  locked: boolean;
  visible: boolean;
  zIndex: number;
}

export interface CanvasSettings {
  width: number;
  height: number;
  preset: CanvasPresetId;
  guidesVisible: boolean;
}

export interface BackgroundImageData {
  id: string;
  fileName: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  dataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  fitMode: 'height-center';
}

export interface ProjectDocument {
  kind: 'text-graphic-studio-project';
  schemaVersion: 1;
  updatedAt: string;
  canvas: CanvasSettings;
  backgroundImage: BackgroundImageData | null;
  objects: GraphicTextObject[];
}

export interface GraphicTextTemplateV1 {
  kind: 'text-graphic-studio-template';
  schemaVersion: 1;
  savedAt: string;
  includePosition: boolean;
  typography: TypographyStyle;
  fill: FillStyle;
  stroke: StrokeStyle;
  outerStroke: StrokeStyle;
  shadow: ShadowStyle;
  background: RoughBandStyle;
  transform: GraphicTextObject['transform'];
  characterScale: CharacterScaleStyle;
  partialStyles: PartialTextStyle[];
  position?: Point2D;
}

export type NoticeKind = 'success' | 'warning' | 'error' | 'info';

export interface AppNotice {
  id: number;
  kind: NoticeKind;
  message: string;
}
