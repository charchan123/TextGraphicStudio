import { FabricImage, StaticCanvas } from 'fabric';

import { createFabricGraphicText } from '@/src/canvas/graphicTextRenderer';
import { prepareGraphicAssets } from '@/src/services/textBackgroundAssets';
import { waitForGraphicFonts } from '@/src/services/fontService';
import { downloadDataUrl, sanitizeFileName } from '@/src/services/download';
import type { GraphicTextObject, ProjectDocument } from '@/src/types/editor';

const loadHtmlImage = (source: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('書き出し画像を確認できませんでした。'));
    image.src = source;
  });

const trimTransparentPixels = async (source: string, padding = 2): Promise<string> => {
  const image = await loadHtmlImage(source);
  const scanCanvas = document.createElement('canvas');
  scanCanvas.width = image.naturalWidth;
  scanCanvas.height = image.naturalHeight;
  const context = scanCanvas.getContext('2d', { willReadFrequently: true });
  if (!context) return source;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, scanCanvas.width, scanCanvas.height).data;
  let minX = scanCanvas.width;
  let minY = scanCanvas.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < scanCanvas.height; y += 1) {
    for (let x = 0; x < scanCanvas.width; x += 1) {
      if (pixels[(y * scanCanvas.width + x) * 4 + 3] === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return source;
  const cropX = Math.max(0, minX - padding);
  const cropY = Math.max(0, minY - padding);
  const cropRight = Math.min(scanCanvas.width - 1, maxX + padding);
  const cropBottom = Math.min(scanCanvas.height - 1, maxY + padding);
  const output = document.createElement('canvas');
  output.width = cropRight - cropX + 1;
  output.height = cropBottom - cropY + 1;
  output.getContext('2d')?.drawImage(
    scanCanvas,
    cropX,
    cropY,
    output.width,
    output.height,
    0,
    0,
    output.width,
    output.height,
  );
  return output.toDataURL('image/png');
};

const renderGraphicDataUrl = async (object: GraphicTextObject): Promise<string> => {
  await Promise.all([waitForGraphicFonts([object]), prepareGraphicAssets([object])]);
  const rendered = createFabricGraphicText(object);
  const group = rendered.group;
  group.setCoords();
  const bounds = group.getBoundingRect();
  const safeMargin = Math.ceil(
    24 +
      object.stroke.width * 2 +
      object.outerStroke.width * 2 +
      object.shadow.blur * 2 +
      Math.abs(object.shadow.offsetX) +
      Math.abs(object.shadow.offsetY),
  );
  const width = Math.max(1, Math.ceil(bounds.width + safeMargin * 2));
  const height = Math.max(1, Math.ceil(bounds.height + safeMargin * 2));
  group.set({
    left: group.left - bounds.left + safeMargin,
    top: group.top - bounds.top + safeMargin,
    visible: true,
    selectable: false,
    evented: false,
  });
  group.setCoords();
  const surface = new StaticCanvas(document.createElement('canvas'), {
    width,
    height,
    backgroundColor: 'transparent',
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  });
  surface.add(group);
  surface.renderAll();
  const raw = surface.toDataURL({ format: 'png', multiplier: 1, enableRetinaScaling: false });
  void surface.dispose();
  return trimTransparentPixels(raw);
};

const renderProjectDataUrl = async (project: ProjectDocument): Promise<string> => {
  const visibleObjects = project.objects.filter((object) => object.visible);
  await Promise.all([waitForGraphicFonts(visibleObjects), prepareGraphicAssets(visibleObjects)]);
  const surface = new StaticCanvas(document.createElement('canvas'), {
    width: project.canvas.width,
    height: project.canvas.height,
    backgroundColor: '#FFFFFF',
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  });

  if (project.backgroundImage) {
    const image = await FabricImage.fromURL(project.backgroundImage.dataUrl, {}, {
      selectable: false,
      evented: false,
    });
    const scale = project.canvas.height / Math.max(1, image.height);
    image.set({
      left: project.canvas.width / 2,
      top: project.canvas.height / 2,
      originX: 'center',
      originY: 'center',
      scaleX: scale,
      scaleY: scale,
      selectable: false,
      evented: false,
    });
    surface.backgroundImage = image;
  }

  [...project.objects]
    .filter((object) => object.visible)
    .sort((left, right) => left.zIndex - right.zIndex)
    .forEach((object) => {
      const { group } = createFabricGraphicText(object);
      group.set({ selectable: false, evented: false });
      surface.add(group);
    });

  surface.renderAll();
  const dataUrl = surface.toDataURL({ format: 'png', multiplier: 1, enableRetinaScaling: false });
  void surface.dispose();
  return dataUrl;
};

export const exportProjectPng = async (project: ProjectDocument): Promise<void> => {
  const dataUrl = await renderProjectDataUrl(project);
  downloadDataUrl(dataUrl, `text-graphic-${project.canvas.width}x${project.canvas.height}.png`);
};

export const exportGraphicPng = async (object: GraphicTextObject): Promise<void> => {
  const dataUrl = await renderGraphicDataUrl(object);
  downloadDataUrl(dataUrl, `${sanitizeFileName(object.name)}.png`);
};

export const exportAllGraphicsPng = async (objects: GraphicTextObject[]): Promise<number> => {
  const targets = objects.filter((object) => object.visible);
  for (const object of targets) {
    await exportGraphicPng(object);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
  }
  return targets.length;
};
