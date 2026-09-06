import { createObjectId } from '@/src/store/defaults';
import type { GraphicTextObject, TextBackgroundImage } from '@/src/types/editor';

const MAX_BYTES = 12 * 1024 * 1024;
const MAX_PIXELS = 16 * 1024 * 1024;
const images = new Map<string, Promise<HTMLImageElement>>();
const readyImages = new Map<string, HTMLImageElement>();
const vectorBitmaps = new Map<string, { image: HTMLCanvasElement; scale: number }>();
const vectorLoads = new Map<string, Promise<void>>();
const MAX_VECTOR_PIXELS = 8 * 1024 * 1024;
const MAX_VECTOR_CACHE_PIXELS = 16 * 1024 * 1024;
const vectorKey = (asset: TextBackgroundImage): string => JSON.stringify(asset.sourceSvg);
const rememberVector = (key: string, value: { image: HTMLCanvasElement; scale: number }) => {
  vectorBitmaps.delete(key); vectorBitmaps.set(key, value);
  let pixels = [...vectorBitmaps.values()].reduce((sum, entry) => sum + entry.image.width * entry.image.height, 0);
  for (const [oldKey, entry] of vectorBitmaps) {
    if (pixels <= MAX_VECTOR_CACHE_PIXELS) break;
    if (oldKey === key) continue;
    pixels -= entry.image.width * entry.image.height;
    vectorBitmaps.delete(oldKey);
  }
};

const isVectorSource = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) return false;
  const source = value as NonNullable<TextBackgroundImage['sourceSvg']>;
  const finite = (number: unknown) => typeof number === 'number' && Number.isFinite(number) && number > 0;
  if (typeof source.markup !== 'string' || source.markup.length > MAX_BYTES || !finite(source.width) || !finite(source.height)
    || source.width * source.height > MAX_PIXELS || !source.crop
    || !Number.isFinite(source.crop.x) || !Number.isFinite(source.crop.y) || source.crop.x < 0 || source.crop.y < 0
    || !finite(source.crop.width) || !finite(source.crop.height)
    || source.crop.x + source.crop.width > source.width || source.crop.y + source.crop.height > source.height) return false;
  try { validateSvg(source.markup); return true; } catch { return false; }
};

export const isEmbeddedBackgroundImage = (value: unknown): value is TextBackgroundImage => {
  if (typeof value !== 'object' || value === null) return false;
  const image = value as Record<string, unknown>;
  return typeof image.id === 'string' && typeof image.fileName === 'string'
    && (image.sourceMimeType === 'image/png' || image.sourceMimeType === 'image/svg+xml')
    && typeof image.dataUrl === 'string' && image.dataUrl.length <= MAX_BYTES * 2
    && /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(image.dataUrl)
    && typeof image.width === 'number' && Number.isInteger(image.width) && image.width > 0
    && typeof image.height === 'number' && Number.isInteger(image.height) && image.height > 0
    && image.width * image.height <= MAX_PIXELS
    && (image.sourceSvg === undefined || (image.sourceMimeType === 'image/svg+xml' && isVectorSource(image.sourceSvg)));
};

const decode = (source: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => {
    if (image.naturalWidth < 1 || image.naturalHeight < 1 || image.naturalWidth * image.naturalHeight > MAX_PIXELS) {
      reject(new Error('背景画像は合計1600万画素以内にしてください。'));
    } else resolve(image);
  };
  image.onerror = () => reject(new Error('背景画像を読み込めませんでした。PNGまたは静的SVGを確認してください。'));
  image.src = source;
});

export const prepareBackgroundImage = async (asset: TextBackgroundImage, targetWidth = asset.width, targetHeight = asset.height): Promise<HTMLImageElement> => {
  if (!isEmbeddedBackgroundImage(asset)) throw new Error('背景画像データの形式が正しくありません。');
  let pending = images.get(asset.dataUrl);
  if (!pending) {
    pending = decode(asset.dataUrl).then((image) => {
      readyImages.set(asset.dataUrl, image);
      return image;
    });
    images.set(asset.dataUrl, pending);
    pending.catch(() => { images.delete(asset.dataUrl); });
  }
  const image = await pending;
  if (image.naturalWidth !== asset.width || image.naturalHeight !== asset.height) throw new Error('背景画像の寸法が一致しません。');
  if (asset.sourceSvg) {
    const vector = asset.sourceSvg;
    // Non-scaling strokes must keep the original raster semantics.
    if (/non-scaling-stroke/i.test(vector.markup)) return image;
    const scale = Math.min(Math.max(1, Math.max(targetWidth / asset.width, targetHeight / asset.height) * 2), 4,
      4096 / vector.width, 4096 / vector.height, Math.sqrt(MAX_VECTOR_PIXELS / (vector.width * vector.height)));
    if (scale <= 1) { vectorBitmaps.delete(vectorKey(asset)); return image; }
    const fingerprint = vectorKey(asset);
    const previous = vectorBitmaps.get(fingerprint);
    if (!previous || Math.abs(previous.scale - scale) > 0.001) {
      const key = `${fingerprint}:${scale}`;
      let loading = vectorLoads.get(key);
      if (!loading) {
        loading = (async () => {
          const doc = new DOMParser().parseFromString(validateSvg(vector.markup), 'image/svg+xml');
          const root = doc.documentElement;
          if (!root.hasAttribute('viewBox')) root.setAttribute('viewBox', `0 0 ${vector.width} ${vector.height}`);
          root.setAttribute('width', String(Math.ceil(vector.width * scale)));
          root.setAttribute('height', String(Math.ceil(vector.height * scale)));
          const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(doc)], { type: 'image/svg+xml' }));
          try {
            const raster = await decode(url);
            const crop = vector.crop;
            const output = document.createElement('canvas');
            output.width = Math.max(1, Math.ceil(crop.width * scale)); output.height = Math.max(1, Math.ceil(crop.height * scale));
            const context = output.getContext('2d');
            if (!context) throw new Error('SVG背景の描画を開始できませんでした。');
            context.imageSmoothingQuality = 'high';
            context.drawImage(raster, crop.x * scale, crop.y * scale, crop.width * scale, crop.height * scale, 0, 0, output.width, output.height);
            rememberVector(fingerprint, { image: output, scale });
          } finally { URL.revokeObjectURL(url); }
        })().finally(() => vectorLoads.delete(key));
        vectorLoads.set(key, loading);
      }
      await loading;
    }
  }
  return image;
};

export const getPreparedBackgroundImage = (asset: TextBackgroundImage): HTMLImageElement | HTMLCanvasElement => {
  const image = (asset.sourceSvg ? vectorBitmaps.get(vectorKey(asset))?.image : undefined) ?? readyImages.get(asset.dataUrl);
  if (!image) throw new Error('背景画像の読み込みが完了していません。');
  return image;
};

export const prepareGraphicAssets = async (objects: GraphicTextObject[], onPrepared?: (object: GraphicTextObject) => void): Promise<void> => {
  const activeKeys = new Set(objects.flatMap((object) => {
    const image = object.background.image;
    return image?.sourceSvg ? [vectorKey(image)] : [];
  }));
  for (const key of vectorBitmaps.keys()) if (!activeKeys.has(key)) vectorBitmaps.delete(key);
  for (const object of objects) {
    const background = object.background;
    if (background.type !== 'uploadedImage' || !background.enabled || !background.image) {
      onPrepared?.(object);
      continue;
    }
    const size = Math.max(object.typography.fontSize, ...object.partialStyles.map((range) => range.fontSize ?? object.typography.fontSize));
    const glyphY = Math.max(object.typography.glyphScaleY ?? 1, ...object.partialStyles.map((range) => range.glyphScaleY ?? 1));
    const rows = background.imageMode === 'followLines' ? 1 : object.text.split('\n').length;
    const height = (size * glyphY * 1.13 * rows + background.paddingY * 2) * Math.max(Math.abs(object.transform.scaleX), Math.abs(object.transform.scaleY));
    await prepareBackgroundImage(background.image, height * background.image.width / background.image.height, height);
    // Consume immediately: a later image may evict this bitmap from the bounded cache.
    onPrepared?.(object);
  }
};

// SVG is validated before decoding: only self-contained static SVG is accepted.
const validateSvg = (source: string): string => {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('外部定義を含むSVGは読み込めません。');
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg') throw new Error('SVGの形式が正しくありません。');
  const allowed = new Set(['svg', 'g', 'defs', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'use', 'title', 'desc', 'metadata', 'filter', 'feGaussianBlur', 'feOffset', 'feColorMatrix', 'feBlend', 'feComposite', 'feFlood', 'feMerge', 'feMergeNode', 'feDropShadow']);
  for (const element of [doc.documentElement, ...doc.documentElement.querySelectorAll('*')]) {
    if (element.closest('metadata')) continue;
    if (!allowed.has(element.localName)) throw new Error('このSVGには未対応の要素があります。文字・CSS・外部画像はパス化した静的SVGにしてください。');
    if (element.namespaceURI !== 'http://www.w3.org/2000/svg') throw new Error('SVG以外の名前空間は読み込めません。');
    for (const attribute of element.attributes) {
      const value = attribute.value;
      if (/^on/i.test(attribute.localName) || attribute.localName === 'base' || /@import|javascript:|\\/i.test(value)) throw new Error('外部参照やスクリプトを含むSVGは読み込めません。');
      if (attribute.localName === 'href' && !/^#[\w:.-]+$/.test(value)) throw new Error('外部参照を含むSVGは読み込めません。');
      for (const match of value.matchAll(/url\(([\s\S]*?)\)/gi)) {
        if (!/^["']?#[\w:.-]+["']?$/.test(match[1].trim())) throw new Error('外部参照を含むSVGは読み込めません。');
      }
    }
  }
  doc.querySelectorAll('metadata').forEach((element) => element.remove());
  const root = doc.documentElement;
  const viewBox = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  if (!root.hasAttribute('width') && viewBox?.length === 4) root.setAttribute('width', String(viewBox[2]));
  if (!root.hasAttribute('height') && viewBox?.length === 4) root.setAttribute('height', String(viewBox[3]));
  return new XMLSerializer().serializeToString(root);
};

export const loadTextBackgroundFile = async (file: File): Promise<TextBackgroundImage> => {
  if (file.size > MAX_BYTES) throw new Error('背景画像は12MB以内にしてください。');
  const svg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
  if (!svg && file.type !== 'image/png' && !/\.png$/i.test(file.name)) throw new Error('テキスト背景にはPNGまたはSVGを選択してください。');
  const markup = svg ? validateSvg(await file.text()) : undefined;
  const blob = markup ? new Blob([markup], { type: 'image/svg+xml' }) : file;
  const url = URL.createObjectURL(blob);
  try {
    const image = await decode(url);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('画像処理を開始できませんでした。');
    context.drawImage(image, 0, 0);
    // Trim only fully transparent outside padding; all visible brush pixels are retained.
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      if (pixels[(y * canvas.width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
    if (right < left) throw new Error('この画像には表示できる画素がありません。');
    const output = document.createElement('canvas');
    output.width = right - left + 1; output.height = bottom - top + 1;
    output.getContext('2d')?.drawImage(canvas, left, top, output.width, output.height, 0, 0, output.width, output.height);
    const asset: TextBackgroundImage = { id: createObjectId(), fileName: file.name, sourceMimeType: svg ? 'image/svg+xml' : 'image/png', dataUrl: output.toDataURL('image/png'), width: output.width, height: output.height };
    if (markup) asset.sourceSvg = { markup, width: image.naturalWidth, height: image.naturalHeight, crop: { x: left, y: top, width: output.width, height: output.height } };
    await prepareBackgroundImage(asset);
    return asset;
  } finally { URL.revokeObjectURL(url); }
};
