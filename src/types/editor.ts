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

export type FontStyleMode = 'normal' | 'italic' | 'slant';

export interface FontReference {
  id: string;
  family: string;
  fullName: string;
  postscriptName?: string;
  style?: string;
  weight?: number;
  source: 'local-access' | 'file';
  fileName?: string;
}

export type ColorPalette = [string, string, string, string, string, string];

export interface TypographyStyle {
  fontFamily: string;
  /** Optional stable identity for a user-added local font. */
  fontRefId?: string;
  fontSize: number;
  fontWeight: 400 | 700 | 900;
  fontStyle?: FontStyleMode;
  /** Visual slant in degrees. Kept separate from object rotation. */
  slant?: number;
  /** Glyph proportions, independent of the outer Fabric object transform. */
  glyphScaleX?: number;
  glyphScaleY?: number;
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
  /** Punctuation and non-emoji symbols. */
  symbol: number;
}

export interface StrokeStyle {
  enabled: boolean;
  color: string;
  width: number;
}

/** Inner to outer; width is the visible thickness of that layer. */
export type StrokeLayers = [StrokeStyle, StrokeStyle, StrokeStyle];
export type StrokeLayerKey = '1' | '2' | '3';
export type PartialStrokeLayers = Partial<Record<StrokeLayerKey, Partial<StrokeStyle>>>;

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
  /** Background-only displacement in the graphic text object's local coordinates. */
  offsetX?: number;
  offsetY?: number;
  roughness: number;
  seed: number;
  image?: TextBackgroundImage;
  /** uploadedImage only: one image for the text block, or one measured image per line. */
  imageMode?: 'fixed' | 'followLines';
  /** Internal three-slice settings; optional for backward-compatible V1 data. */
  followSettings?: {
    capRatio: number;
    seamOverlap: number;
    lineOverlap: number;
  };
}

export interface TextBackgroundImage {
  id: string;
  fileName: string;
  sourceMimeType: 'image/png' | 'image/svg+xml';
  /** Self-contained PNG, locally rasterized when the source was SVG. */
  dataUrl: string;
  width: number;
  height: number;
  /** Validated vector source and original transparent-padding crop. */
  sourceSvg?: {
    markup: string;
    width: number;
    height: number;
    crop: { x: number; y: number; width: number; height: number };
  };
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
  fontFamily?: string;
  fontRefId?: string;
  fontStyle?: 'normal' | 'italic';
  glyphScaleX?: number;
  glyphScaleY?: number;
  /** Per-range visual baseline correction in pixels. Positive moves glyphs down. */
  glyphOffsetY?: number;
  strokes?: PartialStrokeLayers;
}

export interface QuickPartialStrokeOperation {
  enabled?: 'inherit' | 'on' | 'off';
  color?: { action: 'inherit' } | { action: 'change'; value: string };
  width?: { action: 'inherit' } | { action: 'change'; value: number };
}

/** Range-independent shortcut for the existing partial-style application path. */
export interface QuickPartialStyleOperation {
  style: Omit<PartialTextStyle, 'start' | 'end' | 'strokes' | 'glyphOffsetY'>;
  strokes?: Partial<Record<StrokeLayerKey, QuickPartialStrokeOperation>>;
}

export interface QuickPartialPreset {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  operation: QuickPartialStyleOperation;
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
  /** Absent in legacy V1. stroke / outerStroke remain compatibility mirrors. */
  strokes?: StrokeLayers;
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
  socialGuide?: { enabled: boolean; platform: 'instagram-reels' | 'threads' | 'youtube-shorts' | 'x'; visibility?: 'light' | 'standard' | 'strong'; labelsVisible?: boolean };
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
  palette: ColorPalette;
  /** Metadata only. Local font binaries are never persisted. */
  fontCatalog: FontReference[];
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
  strokes?: StrokeLayers;
  shadow: ShadowStyle;
  background: RoughBandStyle;
  transform: GraphicTextObject['transform'];
  characterScale: CharacterScaleStyle;
  partialStyles: PartialTextStyle[];
  palette?: ColorPalette;
  /** Metadata only. Local font binaries are never embedded. */
  fontCatalog?: FontReference[];
  position?: Point2D;
}

/** Styling copied into newly-created text. Content, position and range styles are excluded by the factory. */
export type TextDesignDefaults = Omit<
  GraphicTextObject,
  'id' | 'name' | 'text' | 'position' | 'zIndex'
>;

export type NoticeKind = 'success' | 'warning' | 'error' | 'info';

export interface AppNotice {
  id: number;
  kind: NoticeKind;
  message: string;
}
