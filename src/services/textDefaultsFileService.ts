import { downloadTextFile, sanitizeFileName } from '@/src/services/download';
import { cloneProjectTextDefaults } from '@/src/services/textDefaults';
import { isFontReference, isProjectTextDefaults, isRecord } from '@/src/services/styleValidation';
import type { FontReference, ProjectTextDefaults, TextDefaultsFileV1 } from '@/src/types/editor';

const FILE_TYPE = 'text-graphic-studio-text-defaults';
const FILE_VERSION = 1;
const MAX_BYTES = 10 * 1024 * 1024;

const toPortableFontReference = (font: FontReference): FontReference => ({
  id: font.id,
  family: font.family,
  fullName: font.fullName,
  ...(font.postscriptName ? { postscriptName: font.postscriptName } : {}),
  ...(font.style ? { style: font.style } : {}),
  ...(font.weight !== undefined ? { weight: font.weight } : {}),
  source: font.source,
  ...(font.fileName ? { fileName: font.fileName } : {}),
});

const toPortableDefaults = (defaults: ProjectTextDefaults): ProjectTextDefaults => {
  const portable = cloneProjectTextDefaults(defaults);
  if (!portable.background.image) return portable;
  const background = { ...portable.background };
  delete background.image;
  if (background.type === 'uploadedImage') {
    background.type = 'none';
    background.enabled = false;
    delete background.imageMode;
    delete background.followSettings;
  }
  return { ...portable, background };
};

const referencedFonts = (defaults: ProjectTextDefaults, fontReferences: FontReference[]): FontReference[] => {
  const refId = defaults.typography.fontRefId;
  if (!refId) return [];
  const reference = fontReferences.find((font) => font.id === refId);
  return reference ? [toPortableFontReference(reference)] : [];
};

export const createTextDefaultsFile = (defaults: ProjectTextDefaults, fontReferences: FontReference[] = []): TextDefaultsFileV1 => {
  const references = referencedFonts(defaults, fontReferences);
  return {
    type: FILE_TYPE,
    version: FILE_VERSION,
    defaults: toPortableDefaults(defaults),
    ...(references.length ? { fontReferences: references } : {}),
  };
};

export const downloadTextDefaultsFile = (defaults: ProjectTextDefaults, projectName: string, fontReferences: FontReference[] = []): void => {
  downloadTextFile(
    JSON.stringify(createTextDefaultsFile(defaults, fontReferences), null, 2),
    `${sanitizeFileName(projectName)}.tgsstyle.json`,
    'application/json;charset=utf-8',
  );
};

export interface ParsedTextDefaultsFile {
  defaults: ProjectTextDefaults;
  fontReferences: FontReference[];
}

export const parseTextDefaultsFile = (value: unknown): ParsedTextDefaultsFile => {
  if (!isRecord(value) || value.type !== FILE_TYPE || value.version !== FILE_VERSION || !isProjectTextDefaults(value.defaults)
    || (value.fontReferences !== undefined && (!Array.isArray(value.fontReferences) || !value.fontReferences.every(isFontReference)))) {
    throw new Error('対応しているText基本設定ファイルではありません。');
  }
  return {
    defaults: cloneProjectTextDefaults(value.defaults),
    fontReferences: referencedFonts(value.defaults, value.fontReferences ?? []),
  };
};

export const readTextDefaultsFile = async (file: File): Promise<ParsedTextDefaultsFile> => {
  if (file.size <= 0 || file.size > MAX_BYTES) throw new Error('Text基本設定ファイルは10MB以内にしてください。');
  try {
    return parseTextDefaultsFile(JSON.parse(await file.text()));
  } catch (error) {
    if (error instanceof Error && error.message.includes('対応している')) throw error;
    throw new Error('Text基本設定ファイルを読み取れませんでした。');
  }
};
