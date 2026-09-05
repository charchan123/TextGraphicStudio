import type { FontReference, GraphicTextObject, ProjectDocument } from '@/src/types/editor';

const FILE_FONT_EXTENSIONS = ['ttf', 'otf', 'woff', 'woff2'];
const FILE_FONT_LIMIT = 24 * 1024 * 1024;
const loadedFileFontIds = new Set<string>();

const inferWeight = (style: string): number => {
  const value = style.toLowerCase();
  if (/thin/.test(value)) return 100;
  if (/extra\s*light|ultra\s*light/.test(value)) return 200;
  if (/light/.test(value)) return 300;
  if (/medium/.test(value)) return 500;
  if (/semi\s*bold|demi\s*bold/.test(value)) return 600;
  if (/extra\s*bold|ultra\s*bold/.test(value)) return 800;
  if (/black|heavy/.test(value)) return 900;
  if (/bold/.test(value)) return 700;
  return 400;
};

const stableLocalId = (font: LocalFontData): string =>
  `local:${encodeURIComponent(font.postscriptName || `${font.family}|${font.fullName}|${font.style}`)}`;

export const supportsLocalFontAccess = (): boolean =>
  typeof window !== 'undefined' && typeof window.queryLocalFonts === 'function';

/** Must only be called from the explicit user gesture in the font picker. */
export const queryInstalledFonts = async (): Promise<FontReference[]> => {
  if (!supportsLocalFontAccess()) {
    throw new Error('このブラウザはPCフォント一覧の取得に対応していません。フォントファイル追加を利用してください。');
  }
  const fonts = await window.queryLocalFonts!();
  const unique = new Map<string, FontReference>();
  fonts.forEach((font) => {
    const reference: FontReference = {
      id: stableLocalId(font),
      family: font.family,
      fullName: font.fullName,
      postscriptName: font.postscriptName || undefined,
      style: font.style || undefined,
      weight: inferWeight(font.style),
      source: 'local-access',
    };
    unique.set(reference.id, reference);
  });
  return [...unique.values()].sort((left, right) =>
    left.family.localeCompare(right.family, 'ja') || left.fullName.localeCompare(right.fullName, 'ja'),
  );
};

const fileExtension = (name: string): string => name.split('.').at(-1)?.toLowerCase() ?? '';

export const registerFontFile = async (file: File): Promise<FontReference> => {
  if (!FILE_FONT_EXTENSIONS.includes(fileExtension(file.name))) {
    throw new Error('TTF・OTF・WOFF・WOFF2のフォントファイルを選択してください。');
  }
  if (file.size <= 0 || file.size > FILE_FONT_LIMIT) {
    throw new Error('フォントファイルは24MB以内にしてください。');
  }
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const hash = [...new Uint8Array(digest)].slice(0, 10).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const id = `file:${hash}`;
  const family = `TGS Local ${hash}`;
  const face = new FontFace(family, buffer, { style: 'normal', weight: '400' });
  await face.load();
  document.fonts.add(face);
  loadedFileFontIds.add(id);
  await document.fonts.load(`400 64px "${family}"`, 'Aaあ亜1984');
  return {
    id,
    family,
    fullName: file.name.replace(/\.[^.]+$/, ''),
    style: 'ファイル読込',
    weight: 400,
    source: 'file',
    fileName: file.name,
  };
};

const escapedFamily = (family: string): string => family.replace(/["\\]/g, '\\$&');

export const waitForGraphicFonts = async (objects: GraphicTextObject[]): Promise<void> => {
  if (typeof document === 'undefined' || !document.fonts) return;
  const requests = new Map<string, { family: string; weight: number; style: string; sample: string }>();
  objects.forEach((object) => {
    const add = (family: string, weight: number, style: string) => {
      const key = `${family}|${weight}|${style}`;
      requests.set(key, { family, weight, style, sample: object.text || 'Aaあ亜1984' });
    };
    add(
      object.typography.fontFamily,
      object.typography.fontWeight,
      object.typography.fontStyle === 'italic' ? 'italic' : 'normal',
    );
    object.partialStyles.forEach((range) => {
      if (!range.fontFamily) return;
      add(range.fontFamily, range.fontWeight ?? object.typography.fontWeight, range.fontStyle ?? 'normal');
    });
  });
  await Promise.allSettled([...requests.values()].map((request) =>
    document.fonts.load(
      `${request.style} ${request.weight} 64px "${escapedFamily(request.family)}"`,
      request.sample.slice(0, 96),
    ),
  ));
  await document.fonts.ready;
};

const likelySystemFontAvailable = (family: string): boolean => {
  if (typeof document === 'undefined') return true;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return true;
  const sample = 'mmmmmmmmWWWWiiii1111あいう漢字';
  const widths = ['monospace', 'serif', 'sans-serif'].map((fallback) => {
    context.font = `72px ${fallback}`;
    return context.measureText(sample).width;
  });
  context.font = `72px "${escapedFamily(family)}", monospace`;
  const candidate = context.measureText(sample).width;
  return widths.every((width) => Math.abs(candidate - width) > 0.01);
};

export const getFontRestoreWarning = (project: ProjectDocument): string | null => {
  const usedIds = new Set<string>();
  project.objects.forEach((object) => {
    if (object.typography.fontRefId) usedIds.add(object.typography.fontRefId);
    object.partialStyles.forEach((range) => { if (range.fontRefId) usedIds.add(range.fontRefId); });
  });
  const unavailable = [...usedIds].flatMap((id) => {
    const reference = project.fontCatalog.find((font) => font.id === id);
    if (!reference) return [id];
    if (reference.source === 'file') return loadedFileFontIds.has(id) ? [] : [reference.fullName];
    return likelySystemFontAvailable(reference.family) ? [] : [reference.fullName];
  });
  if (!unavailable.length) return null;
  return `このPCで利用できないフォントがあります（${unavailable.slice(0, 3).join('、')}）。安全な代替フォントで表示しています。必要なら再追加してください。`;
};

export const isFileFontLoaded = (id: string): boolean => loadedFileFontIds.has(id);
