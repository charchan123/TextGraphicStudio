import { DEFAULT_COLOR_PALETTE } from '@/src/store/defaults';
import { clonePartialStrokes, getStrokeLayers } from '@/src/services/strokes';
import type {
  ColorPalette,
  FillStyle,
  FontReference,
  GraphicTextObject,
  GraphicTextTemplateV1,
  PartialTextStyle,
  ProjectDocument,
  RoughBandStyle,
} from '@/src/types/editor';

export const DEFAULT_FOLLOW_SETTINGS = {
  capRatio: 0.22,
  seamOverlap: 2,
  lineOverlap: 6,
} as const;

export const cloneFill = (fill: FillStyle): FillStyle => fill.type === 'solid'
  ? { ...fill }
  : { ...fill, stops: fill.stops.map((stop) => ({ ...stop })) };

export const clonePartialStyle = (style: PartialTextStyle): PartialTextStyle => ({
  ...style,
  fill: style.fill ? cloneFill(style.fill) : undefined,
  strokes: clonePartialStrokes(style.strokes),
});

export const cloneBackground = (background: RoughBandStyle): RoughBandStyle => ({
  ...background,
  image: background.image ? { ...background.image, sourceSvg: background.image.sourceSvg ? { ...background.image.sourceSvg, crop: { ...background.image.sourceSvg.crop } } : undefined } : undefined,
  followSettings: background.followSettings
    ? { ...background.followSettings }
    : undefined,
});

export const cloneFontCatalog = (catalog: FontReference[]): FontReference[] =>
  catalog.map((font) => ({ ...font }));

export const cloneGraphicObject = (object: GraphicTextObject): GraphicTextObject => ({
  ...object,
  position: { ...object.position },
  size: { ...object.size },
  transform: { ...object.transform },
  typography: { ...object.typography },
  characterScale: { ...object.characterScale },
  fill: cloneFill(object.fill),
  stroke: { ...getStrokeLayers(object)[0] },
  outerStroke: { ...getStrokeLayers(object)[1] },
  strokes: getStrokeLayers(object),
  shadow: { ...object.shadow },
  background: cloneBackground(object.background),
  partialStyles: object.partialStyles.map(clonePartialStyle),
});

export const normalizeTextBackground = (background: RoughBandStyle): RoughBandStyle => ({
  ...cloneBackground(background),
  offsetX: background.offsetX ?? 0,
  offsetY: background.offsetY ?? 0,
  imageMode: background.imageMode === 'followLines' ? 'followLines' : 'fixed',
  followSettings: background.followSettings
    ? { ...background.followSettings }
    : { ...DEFAULT_FOLLOW_SETTINGS },
});

const normalizeObject = (object: GraphicTextObject): GraphicTextObject => ({
  ...cloneGraphicObject(object),
  typography: {
    ...object.typography,
    fontStyle: object.typography.fontStyle ?? 'normal',
    slant: object.typography.slant ?? 0,
    glyphScaleX: object.typography.glyphScaleX ?? 1,
    glyphScaleY: object.typography.glyphScaleY ?? 1,
  },
  background: normalizeTextBackground(object.background),
  characterScale: {
    ...object.characterScale,
    symbol: object.characterScale.symbol ?? 1,
  },
});

export const normalizeProjectDocument = (project: ProjectDocument): ProjectDocument => {
  const candidate = project as ProjectDocument & {
    palette?: ColorPalette;
    fontCatalog?: FontReference[];
  };
  return {
    ...project,
    canvas: { ...project.canvas, socialGuide: project.canvas.socialGuide ? { ...project.canvas.socialGuide } : undefined },
    backgroundImage: project.backgroundImage ? { ...project.backgroundImage } : null,
    palette: candidate.palette ? [...candidate.palette] : [...DEFAULT_COLOR_PALETTE],
    fontCatalog: cloneFontCatalog(candidate.fontCatalog ?? []),
    objects: project.objects.map(normalizeObject),
  };
};

export const normalizeTemplate = (template: GraphicTextTemplateV1): GraphicTextTemplateV1 => ({
  ...template,
  typography: {
    ...template.typography,
    fontStyle: template.typography.fontStyle ?? 'normal',
    slant: template.typography.slant ?? 0,
    glyphScaleX: template.typography.glyphScaleX ?? 1,
    glyphScaleY: template.typography.glyphScaleY ?? 1,
  },
  fill: cloneFill(template.fill),
  stroke: { ...getStrokeLayers(template)[0] },
  outerStroke: { ...getStrokeLayers(template)[1] },
  strokes: getStrokeLayers(template),
  shadow: { ...template.shadow },
  background: normalizeTextBackground(template.background),
  transform: { ...template.transform },
  characterScale: { ...template.characterScale, symbol: template.characterScale.symbol ?? 1 },
  partialStyles: template.partialStyles.map(clonePartialStyle),
  palette: template.palette ? [...template.palette] : [...DEFAULT_COLOR_PALETTE],
  fontCatalog: cloneFontCatalog(template.fontCatalog ?? []),
  position: template.position ? { ...template.position } : undefined,
});
