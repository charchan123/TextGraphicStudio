import { sanitizeFileName } from '@/src/services/download';

export const graphicPngFileName = (objectName: string): string => {
  const defaultName = objectName.replace(/^テキスト\s+(\d+)$/, 'テキスト$1');
  return `${sanitizeFileName(defaultName)}.png`;
};
