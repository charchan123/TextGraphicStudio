import { downloadTextFile, sanitizeFileName } from '@/src/services/download';
import { normalizeProjectDocument } from '@/src/services/documentData';
import { isProjectDocument, isStudioProject } from '@/src/services/persistence';
import { prepareGraphicAssets } from '@/src/services/textBackgroundAssets';
import { normalizeStudioProject, wrapLegacyDocument } from '@/src/services/studioProject';
import type { ProjectDocument, StudioProject, TextDesignDefaults } from '@/src/types/editor';

const PROJECT_KIND = 'text-graphic-studio-project-package';
const PROJECT_VERSION = 2;
const MAX_PROJECT_BYTES = 128 * 1024 * 1024;

interface PortableProjectFileV2 {
  kind: typeof PROJECT_KIND;
  version: typeof PROJECT_VERSION;
  exportedAt: string;
  project: StudioProject;
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

export const createPortableProject = (project: StudioProject): PortableProjectFileV2 => ({
  kind: PROJECT_KIND,
  version: PROJECT_VERSION,
  exportedAt: new Date().toISOString(),
  project: normalizeStudioProject(project),
});

export const downloadProjectFile = (project: StudioProject): void => {
  downloadTextFile(
    JSON.stringify(createPortableProject(project)),
    `${sanitizeFileName(project.projectName)}.tgsproj`,
    'application/vnd.text-graphic-studio.project+json;charset=utf-8',
  );
};

export const readProjectFile = async (file: File, fallbackDefaults?: TextDesignDefaults): Promise<StudioProject> => {
  if (file.size <= 0 || file.size > MAX_PROJECT_BYTES) throw new Error('プロジェクトファイルは128MB以内にしてください。');
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('プロジェクトファイルの内容を読み取れませんでした。');
  }
  if (!isRecord(parsed) || parsed.kind !== PROJECT_KIND) {
    throw new Error('対応しているText Graphic Studioプロジェクト形式ではありません。');
  }
  let project: StudioProject;
  if (parsed.version === PROJECT_VERSION && isStudioProject(parsed.project)) {
    project = normalizeStudioProject(parsed.project, fallbackDefaults);
  } else if (parsed.version === 1 && isProjectDocument(parsed.document)) {
    project = wrapLegacyDocument(normalizeProjectDocument(parsed.document), undefined, fallbackDefaults);
  } else {
    throw new Error('対応しているText Graphic Studioプロジェクト形式ではありません。');
  }
  for (const frame of project.frames) await validatePortableAssets(frame.document);
  return project;
};
