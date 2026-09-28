/* oxlint-disable typescript/no-deprecated -- Fabric groups use the existing centered-origin contract. */
import { Group, StaticCanvas } from 'fabric';

import { createFabricGraphicTextBackground } from '@/src/canvas/graphicTextRenderer';
import { waitForGraphicFonts } from '@/src/services/fontService';
import { prepareGraphicAssets } from '@/src/services/textBackgroundAssets';
import type { GraphicTextObject } from '@/src/types/editor';
import type { PhotoshopBridgeBounds } from '@/src/types/photoshopBridge';

export interface RenderedPhotoshopBridgeBackground {
  dataUrl: string;
  width: number;
  height: number;
  renderBounds: PhotoshopBridgeBounds;
}

const roundGeometry = (value: number): number => Math.round(value * 1000) / 1000;

export const calculatePhotoshopBridgeCropBounds = (
  canvasOriginLeft: number,
  canvasOriginTop: number,
  cropLeft: number,
  cropTop: number,
  width: number,
  height: number,
): PhotoshopBridgeBounds => {
  const left = canvasOriginLeft + cropLeft;
  const top = canvasOriginTop + cropTop;
  return {
    left: roundGeometry(left),
    top: roundGeometry(top),
    right: roundGeometry(left + width),
    bottom: roundGeometry(top + height),
    width,
    height,
  };
};

const findAlphaBounds = (
  canvas: HTMLCanvasElement,
): { left: number; top: number; right: number; bottom: number } | null => {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let left = canvas.width;
  let top = canvas.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (pixels[(y * canvas.width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return right >= left && bottom >= top ? { left, top, right, bottom } : null;
};

/**
 * Renders only the existing shared background object. The returned PNG already
 * includes the TextObject transform, so Photoshop must place it without another rotation.
 */
export const renderPhotoshopBridgeBackground = async (
  object: GraphicTextObject,
): Promise<RenderedPhotoshopBridgeBackground | null> => {
  if (!object.background.enabled) return null;
  await Promise.all([waitForGraphicFonts([object]), prepareGraphicAssets([object])]);
  const rendered = createFabricGraphicTextBackground(object);
  if (!rendered.background) return null;

  const transformed = new Group([rendered.background], {
    left: object.position.x,
    top: object.position.y,
    originX: 'center',
    originY: 'center',
    scaleX: object.transform.scaleX,
    scaleY: object.transform.scaleY,
    angle: object.transform.rotation,
    visible: true,
    selectable: false,
    evented: false,
    objectCaching: false,
  });
  transformed.setCoords();
  const bounds = transformed.getBoundingRect();
  const boundsRight = bounds.left + bounds.width;
  const boundsBottom = bounds.top + bounds.height;
  const safePadding = 4;
  const originLeft = Math.floor(bounds.left) - safePadding;
  const originTop = Math.floor(bounds.top) - safePadding;
  const width = Math.max(1, Math.ceil(boundsRight) - Math.floor(bounds.left) + safePadding * 2);
  const height = Math.max(1, Math.ceil(boundsBottom) - Math.floor(bounds.top) + safePadding * 2);
  transformed.set({
    left: (transformed.left ?? 0) - originLeft,
    top: (transformed.top ?? 0) - originTop,
  });
  transformed.setCoords();

  const element = document.createElement('canvas');
  const surface = new StaticCanvas(element, {
    width,
    height,
    backgroundColor: 'transparent',
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  });
  surface.add(transformed);
  surface.renderAll();

  const alpha = findAlphaBounds(element);
  if (!alpha) {
    void surface.dispose();
    return null;
  }
  const cropLeft = Math.max(0, alpha.left - safePadding);
  const cropTop = Math.max(0, alpha.top - safePadding);
  const cropRight = Math.min(width - 1, alpha.right + safePadding);
  const cropBottom = Math.min(height - 1, alpha.bottom + safePadding);
  const output = document.createElement('canvas');
  output.width = cropRight - cropLeft + 1;
  output.height = cropBottom - cropTop + 1;
  output.getContext('2d')?.drawImage(
    element,
    cropLeft,
    cropTop,
    output.width,
    output.height,
    0,
    0,
    output.width,
    output.height,
  );
  void surface.dispose();

  return {
    dataUrl: output.toDataURL('image/png'),
    width: output.width,
    height: output.height,
    renderBounds: calculatePhotoshopBridgeCropBounds(
      originLeft,
      originTop,
      cropLeft,
      cropTop,
      output.width,
      output.height,
    ),
  };
};
