import { createObjectId } from '@/src/store/defaults';
import type { GraphicTextObject, TextBackgroundImage } from '@/src/types/editor';

const MAX_BYTES = 12 * 1024 * 1024;
const MAX_PIXELS = 16 * 1024 * 1024;
const images = new Map<string, Promise<HTMLImageElement>>();
const readyImages = new Map<string, HTMLImageElement>();

export const isEmbeddedBackgroundImage = (value: unknown): value is TextBackgroundImage => {
  if (typeof value !== 'object' || value === null) return false;
  const image = value as Record<string, unknown>;
  return typeof image.id === 'string' && typeof image.fileName === 'string'
    && (image.sourceMimeType === 'image/png' || image.sourceMimeType === 'image/svg+xml')
    && typeof image.dataUrl === 'string' && image.dataUrl.length <= MAX_BYTES * 2
    && /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(image.dataUrl)
    && typeof image.width === 'number' && Number.isInteger(image.width) && image.width > 0
    && typeof image.height === 'number' && Number.isInteger(image.height) && image.height > 0
    && image.width * image.height <= MAX_PIXELS;
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

export const prepareBackgroundImage = async (asset: TextBackgroundImage): Promise<HTMLImageElement> => {
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
  return image;
};

export const getPreparedBackgroundImage = (asset: TextBackgroundImage): HTMLImageElement => {
  const image = readyImages.get(asset.dataUrl);
  if (!image) throw new Error('背景画像の読み込みが完了していません。');
  return image;
};

export const prepareGraphicAssets = async (objects: GraphicTextObject[]): Promise<void> => {
  await Promise.all(objects.flatMap((object) => object.background.type === 'uploadedImage' && object.background.enabled && object.background.image
    ? [prepareBackgroundImage(object.background.image)] : []));
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
      for (const match of value.matchAll(/url\((.*?)\)/gi)) {
        if (!/^["']?#[\w:.-]+["']?$/.test(match[1].trim())) throw new Error('外部参照を含むSVGは読み込めません。');
      }
    }
  }
  doc.querySelectorAll('metadata').forEach((element) => element.remove());
  const root = doc.documentElement;
  const viewBox = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  if (!root.hasAttribute('width') && viewBox?.length === 4) root.setAttribute('width', String(viewBox[2]));
  if (!root.hasAttribute('height') && viewBox?.length === 4) root.setAttribute('height', String(viewBox[3]));
  return new XMLSerializer().serializeToString(doc);
};

export const loadTextBackgroundFile = async (file: File): Promise<TextBackgroundImage> => {
  if (file.size > MAX_BYTES) throw new Error('背景画像は12MB以内にしてください。');
  const svg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
  if (!svg && file.type !== 'image/png' && !/\.png$/i.test(file.name)) throw new Error('テキスト背景にはPNGまたはSVGを選択してください。');
  const blob = svg ? new Blob([validateSvg(await file.text())], { type: 'image/svg+xml' }) : file;
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
    await prepareBackgroundImage(asset);
    return asset;
  } finally { URL.revokeObjectURL(url); }
};
