import { FabricImage, StaticCanvas } from 'fabric';

import { createFabricGraphicText } from '@/src/canvas/graphicTextRenderer';
import { prepareGraphicAssets } from '@/src/services/textBackgroundAssets';
import { waitForGraphicFonts } from '@/src/services/fontService';
import { downloadBlob, downloadDataUrl, sanitizeFileName } from '@/src/services/download';
import type { GraphicTextObject, ProjectDocument, StudioProject } from '@/src/types/editor';
import { maxVisibleStrokeWidth } from '@/src/services/strokes';
import { createZipBlob } from '@/src/services/zipService';

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
  const glyphOffsetMargin = Math.max(0, ...object.partialStyles.map((range) => Math.abs(range.glyphOffsetY ?? 0)))
    * Math.max(Math.abs(object.transform.scaleX), Math.abs(object.transform.scaleY));
  const safeMargin = Math.ceil(
    24 +
      glyphOffsetMargin +
      maxVisibleStrokeWidth(object) * 3 * Math.max(Math.abs(object.transform.scaleX), Math.abs(object.transform.scaleY)) +
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

const renderProjectDataUrl = async (project: ProjectDocument, outputWidth: number, outputHeight: number): Promise<string> => {
  const visibleObjects = project.objects.filter((object) => object.visible);
  await waitForGraphicFonts(visibleObjects);
  const outputScale = Math.min(outputWidth / project.canvas.width, outputHeight / project.canvas.height);
  const surface = new StaticCanvas(document.createElement('canvas'), {
    width: outputWidth,
    height: outputHeight,
    backgroundColor: '#FFFFFF',
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  });

  if (project.backgroundImage) {
    const image = await FabricImage.fromURL(project.backgroundImage.dataUrl, {}, {
      selectable: false,
      evented: false,
    });
    const scale = project.canvas.height / Math.max(1, image.height) * outputScale;
    image.set({
      left: outputWidth / 2,
      top: outputHeight / 2,
      originX: 'center',
      originY: 'center',
      scaleX: scale,
      scaleY: scale,
      selectable: false,
      evented: false,
    });
    surface.backgroundImage = image;
  }

  await prepareGraphicAssets([...visibleObjects].sort((left, right) => left.zIndex - right.zIndex), (object) => {
      const { group } = createFabricGraphicText(object);
      group.set({
        left: (group.left ?? 0) * outputScale,
        top: (group.top ?? 0) * outputScale,
        scaleX: (group.scaleX ?? 1) * outputScale,
        scaleY: (group.scaleY ?? 1) * outputScale,
        selectable: false,
        evented: false,
      });
      surface.add(group);
  });

  surface.renderAll();
  const dataUrl = surface.toDataURL({ format: 'png', multiplier: 1, enableRetinaScaling: false });
  void surface.dispose();
  return dataUrl;
};

export const renderProjectPngDataUrl = async (project: ProjectDocument): Promise<string> =>
  renderProjectDataUrl(project, project.canvas.width, project.canvas.height);

export const renderProjectThumbnailDataUrl = async (project: ProjectDocument, maxWidth = 112, maxHeight = 112): Promise<string> => {
  const scale = Math.min(maxWidth / project.canvas.width, maxHeight / project.canvas.height, 1);
  return renderProjectDataUrl(project, Math.max(1, Math.round(project.canvas.width * scale)), Math.max(1, Math.round(project.canvas.height * scale)));
};

export const exportProjectPng = async (project: ProjectDocument): Promise<void> => {
  const dataUrl = await renderProjectPngDataUrl(project);
  downloadDataUrl(dataUrl, `text-graphic-${project.canvas.width}x${project.canvas.height}.png`);
};

/** Uses the exact canvas-PNG renderer without triggering a browser download. */
export const renderProjectPngBlob = async (project: ProjectDocument): Promise<Blob> => {
  const response = await fetch(await renderProjectPngDataUrl(project));
  return response.blob();
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

const frameFileName = (index: number): string => `${String(index).padStart(2, '0')}.png`;

export const exportAllFramesPng = async (project: StudioProject): Promise<number> => {
  for (let index = 0; index < project.frames.length; index += 1) {
    const blob = await renderProjectPngBlob(project.frames[index].document);
    downloadBlob(blob, frameFileName(index));
    await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
  }
  return project.frames.length;
};

export const exportAllFramesZip = async (project: StudioProject): Promise<void> => {
  const entries = [];
  for (let index = 0; index < project.frames.length; index += 1) {
    const blob = await renderProjectPngBlob(project.frames[index].document);
    entries.push({ name: frameFileName(index), data: new Uint8Array(await blob.arrayBuffer()) });
  }
  downloadBlob(createZipBlob(entries), `${sanitizeFileName(project.projectName)}.zip`);
};
