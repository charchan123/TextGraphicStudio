/* oxlint-disable typescript/no-deprecated -- Existing Fabric group uses center origins. */
import { FabricImage, Polygon, type FabricObject } from 'fabric';
import { createRoughBandPoints } from '@/src/canvas/roughBand';
import { getPreparedBackgroundImage } from '@/src/services/textBackgroundAssets';
import type { RoughBandStyle } from '@/src/types/editor';

export const BACKGROUND_TYPES = [
  { value: 'none', label: 'なし' },
  { value: 'generatedRoughYellow', label: '黄色ラフ背景' },
  { value: 'uploadedImage', label: '画像背景（PNG / SVG）' },
] as const;

export const effectiveBackgroundType = (background: RoughBandStyle) => !background.enabled ? 'none' : background.type === 'rough-band' ? 'generatedRoughYellow' : background.type;

type Renderer = (style: RoughBandStyle, width: number, height: number) => FabricObject | null;
const renderers: Record<(typeof BACKGROUND_TYPES)[number]['value'], Renderer> = {
  none: () => null,
  generatedRoughYellow: (style, width, height) => new Polygon(createRoughBandPoints(width, height, style.roughness, style.seed), { fill: style.color }),
  uploadedImage: (style, width, height) => {
    if (!style.image) return null;
    return new FabricImage(getPreparedBackgroundImage(style.image), { scaleX: width / style.image.width, scaleY: height / style.image.height });
  },
};

export const createTextBackground = (style: RoughBandStyle, textWidth: number, textHeight: number): FabricObject | null => {
  const renderer = renderers[effectiveBackgroundType(style)];
  const background = renderer(style, textWidth + style.paddingX * 2, textHeight + style.paddingY * 2);
  background?.set({ left: 0, top: 0, originX: 'center', originY: 'center', angle: style.rotation, selectable: false, evented: false, objectCaching: false });
  return background;
};
