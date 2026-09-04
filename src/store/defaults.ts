import type { GraphicTextObject, ProjectDocument } from '@/src/types/editor';

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
): GraphicTextObject => ({
  kind: 'graphic-text',
  schemaVersion: 1,
  id: makeId(),
  name: `テキスト ${index + 1}`,
  text: text.trim() || '新しいテキスト',
  position: {
    x: canvasWidth / 2 + Math.min(index, 5) * 28,
    y: canvasHeight / 2 + Math.min(index, 5) * 28,
  },
  size: { width: 720, height: 210 },
  transform: { scaleX: 1, scaleY: 1, rotation: -2 },
  typography: {
    fontFamily: 'Yu Gothic UI',
    fontSize: 96,
    fontWeight: 900,
    letterSpacing: 0,
    lineHeight: 1.05,
    textAlign: 'center',
  },
  characterScale: { kanji: 1, hiragana: 0.85, katakana: 0.9, latin: 1, number: 1.15 },
  fill: { type: 'solid', color: '#000000' },
  stroke: { enabled: true, color: '#FFFFFF', width: 8 },
  outerStroke: { enabled: true, color: '#000000', width: 5 },
  shadow: { enabled: true, color: '#000000', opacity: 0.34, blur: 8, offsetX: 4, offsetY: 7 },
  background: {
    enabled: true,
    type: 'rough-band',
    color: '#F4D507',
    rotation: -1.5,
    paddingX: 38,
    paddingY: 22,
    roughness: 0.55,
    seed: 1847 + index * 137,
  },
  partialStyles: [],
  locked: false,
  visible: true,
  zIndex: index,
});

export const createInitialProject = (): ProjectDocument => {
  const width = 1920;
  const height = 1080;
  const sampleObject = {
    ...createGraphicText('しかし2人の活躍は\n批判も多かった', 0, width, height),
    id: 'initial-sample',
  };
  return {
    kind: 'text-graphic-studio-project',
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    canvas: { width, height, preset: 'landscape', guidesVisible: true },
    backgroundImage: null,
    objects: [sampleObject],
  };
};

export const createObjectId = makeId;
