import { ACCEPTED_IMAGE_TYPES } from '@/src/constants/editor';
import { createObjectId } from '@/src/store/defaults';
import type { BackgroundImageData } from '@/src/types/editor';

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('画像を読み込めませんでした。'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('画像を読み込めませんでした。'));
    reader.readAsDataURL(file);
  });

const getImageSize = (dataUrl: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('画像のサイズを確認できませんでした。'));
    image.src = dataUrl;
  });

export const loadBackgroundFile = async (file: File): Promise<BackgroundImageData> => {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    throw new Error('PNG、JPG、JPEG、WEBP画像を選択してください。');
  }
  const dataUrl = await readAsDataUrl(file);
  const size = await getImageSize(dataUrl);
  return {
    id: createObjectId(),
    fileName: file.name,
    mimeType: file.type as BackgroundImageData['mimeType'],
    dataUrl,
    naturalWidth: size.width,
    naturalHeight: size.height,
    fitMode: 'height-center',
    positionY: 0,
  };
};
