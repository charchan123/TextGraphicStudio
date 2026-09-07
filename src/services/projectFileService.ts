import { downloadTextFile } from '@/src/services/download';
import { normalizeProjectDocument } from '@/src/services/documentData';
import { isProjectDocument } from '@/src/services/persistence';
import { prepareGraphicAssets } from '@/src/services/textBackgroundAssets';
import type { ProjectDocument } from '@/src/types/editor';

const PROJECT_KIND = 'text-graphic-studio-project-package';
const PROJECT_VERSION = 1;
const MAX_PROJECT_BYTES = 128 * 1024 * 1024;

interface PortableProjectFile {
  kind: typeof PROJECT_KIND;
  version: typeof PROJECT_VERSION;
  exportedAt: string;
  document: ProjectDocument;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const decodeImage = (source: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('プロジェクト内の画像assetを読み込めません。'));
  image.src = source;
});

const validatePortableAssets = async (project: ProjectDocument): Promise<void> => {
  if (project.backgroundImage) {
    if (!/^data:image\/(?:png|jpeg|webp);base64,/i.test(project.backgroundImage.dataUrl)) {
      throw new Error('Canvas背景画像がportableな埋め込み形式ではありません。');
    }
    const image = await decodeImage(project.backgroundImage.dataUrl);
    if (image.naturalWidth !== project.backgroundImage.naturalWidth || image.naturalHeight !== project.backgroundImage.naturalHeight) {
      throw new Error('Canvas背景画像の寸法が一致しません。');
    }
  }
  await prepareGraphicAssets(project.objects);
};

export const createPortableProject = (document: ProjectDocument): PortableProjectFile => ({
  kind: PROJECT_KIND,
  version: PROJECT_VERSION,
  exportedAt: new Date().toISOString(),
  document: normalizeProjectDocument(document),
});

const timestamp = (): string => {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '00';
  return `${get('year')}${get('month')}${get('day')}-${get('hour')}${get('minute')}`;
};

export const downloadProjectFile = (project: ProjectDocument): void => {
  downloadTextFile(
    JSON.stringify(createPortableProject(project)),
    `text-graphic-studio-${timestamp()}.tgsproj`,
    'application/vnd.text-graphic-studio.project+json;charset=utf-8',
  );
};

export const readProjectFile = async (file: File): Promise<ProjectDocument> => {
  if (file.size <= 0 || file.size > MAX_PROJECT_BYTES) throw new Error('プロジェクトファイルは128MB以内にしてください。');
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('プロジェクトファイルの内容を読み取れませんでした。');
  }
  if (!isRecord(parsed) || parsed.kind !== PROJECT_KIND || parsed.version !== PROJECT_VERSION || !isProjectDocument(parsed.document)) {
    throw new Error('対応しているText Graphic Studioプロジェクト形式ではありません。');
  }
  const project = normalizeProjectDocument(parsed.document);
  await validatePortableAssets(project);
  return project;
};
