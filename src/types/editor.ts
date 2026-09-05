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
  /** rough-band remains readable for Phase 1 templates. */
  type: 'rough-band' | 'none' | 'generatedRoughYellow' | 'uploadedImage';
  color: string;
  rotation: number;
  paddingX: number;
  paddingY: number;
  roughness: number;
  seed: number;
  image?: TextBackgroundImage;
}

export interface TextBackgroundImage {
  id: string;
  fileName: string;
  sourceMimeType: 'image/png' | 'image/svg+xml';
  /** Self-contained PNG, locally rasterized when the source was SVG. */
  dataUrl: string;
  width: number;
  height: number;
}

export interface BackgroundPreset {
  id: string;
  name: string;
  savedAt: string;
  background: RoughBandStyle;
}

export interface PartialTextStyle {
  /** UTF-16 offsets matching textarea selectionStart / selectionEnd. */
  start: number;
  end: number;
  fill?: FillStyle;
  fontScale?: number;
  fontSize?: number;
  letterSpacing?: number;
  fontWeight?: 400 | 700 | 900;
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
  socialGuide?: { enabled: boolean; platform: 'instagram-reels' | 'threads' | 'youtube-shorts' | 'x' };
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
