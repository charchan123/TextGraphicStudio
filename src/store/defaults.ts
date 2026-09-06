import type { ColorPalette, FontReference, GraphicTextObject, ProjectDocument, TextDesignDefaults } from '@/src/types/editor';
import { clonePartialStrokes, getStrokeLayers } from '@/src/services/strokes';

export const DEFAULT_COLOR_PALETTE: ColorPalette = [
  '#000000',
  '#FFFFFF',
  '#D10D18',
  '#1236B7',
  '#F4D507',
  '#F08A16',
];

export type GraphicTextPreset = TextDesignDefaults;

/**
 * The single source of truth for newly-created graphic text styling.
 * Phase 2 presets can be added alongside this definition without changing the factory.
 */
export const DEFAULT_GRAPHIC_TEXT_PRESET: GraphicTextPreset = {
  kind: 'graphic-text',
  schemaVersion: 1,
  size: { width: 720, height: 210 },
  transform: { scaleX: 1, scaleY: 1, rotation: -2 },
  typography: {
    fontFamily: 'Yu Gothic UI',
    fontSize: 96,
    fontWeight: 900,
    fontStyle: 'normal',
    slant: 0,
    glyphScaleX: 1,
    glyphScaleY: 1,
    letterSpacing: 0,
    lineHeight: 1.05,
    textAlign: 'center',
  },
  characterScale: {
    kanji: 1,
    hiragana: 0.85,
    katakana: 0.9,
    latin: 1,
    number: 1.15,
    symbol: 1,
  },
  fill: { type: 'solid', color: '#000000' },
  stroke: { enabled: true, color: '#FFFFFF', width: 8 },
  outerStroke: { enabled: true, color: '#000000', width: 5 },
  shadow: {
    enabled: true,
    color: '#000000',
    opacity: 0.34,
    blur: 8,
    offsetX: 4,
    offsetY: 7,
  },
  background: {
    enabled: true,
    type: 'generatedRoughYellow',
    color: '#F4D507',
    rotation: -1.5,
    paddingX: 38,
    paddingY: 22,
    offsetX: 0,
    offsetY: 0,
    roughness: 0.55,
    seed: 1847,
    imageMode: 'fixed',
    followSettings: { capRatio: 0.22, seamOverlap: 2, lineOverlap: 6 },
  },
  partialStyles: [],
  locked: false,
  visible: true,
};

const makeId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `graphic-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const createGraphicText = (
  text: string,
  index: number,
  canvasWidth: number,
  canvasHeight: number,
  preset: GraphicTextPreset = DEFAULT_GRAPHIC_TEXT_PRESET,
  preserveBackgroundSeed = false,
): GraphicTextObject => {
  const offset = Math.min(index, 5) * 28;
  return {
    ...preset,
    id: makeId(),
    name: `テキスト ${index + 1}`,
    text: text.trim() || '新しいテキスト',
    position: {
      x: canvasWidth / 2 + offset,
      y: canvasHeight / 2 + offset,
    },
    size: { ...preset.size },
    transform: { ...preset.transform },
    typography: { ...preset.typography },
    characterScale: { ...preset.characterScale },
    fill:
      preset.fill.type === 'solid'
        ? { ...preset.fill }
        : {
            ...preset.fill,
            stops: preset.fill.stops.map((stop) => ({ ...stop })),
          },
    stroke: { ...preset.stroke },
    outerStroke: { ...preset.outerStroke },
    strokes: getStrokeLayers(preset),
    shadow: { ...preset.shadow },
    background: {
      ...preset.background,
      seed: preserveBackgroundSeed ? preset.background.seed : preset.background.seed + index * 137,
      followSettings: preset.background.followSettings
        ? { ...preset.background.followSettings }
        : undefined,
    },
    partialStyles: preset.partialStyles.map((style) => ({ ...style, strokes: clonePartialStrokes(style.strokes) })),
    zIndex: index,
  };
};

export const createInitialProject = (
  palette: ColorPalette = DEFAULT_COLOR_PALETTE,
  fontCatalog: FontReference[] = [],
): ProjectDocument => {
  const width = 1080;
  const height = 1920;
  const sampleObject = {
    ...createGraphicText('しかし2人の活躍は\n批判も多かった', 0, width, height),
    id: 'initial-sample',
  };
  return {
    kind: 'text-graphic-studio-project',
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    canvas: { width, height, preset: 'portrait', guidesVisible: true },
    backgroundImage: null,
    palette: [...palette],
    fontCatalog: fontCatalog.map((font) => ({ ...font })),
    objects: [sampleObject],
  };
};

export const createObjectId = makeId;
