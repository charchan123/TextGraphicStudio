import { cloneGraphicObject, normalizeProjectDocument } from '@/src/services/documentData';
import { createInitialProject } from '@/src/store/defaults';
import type { ColorPalette, FontReference, ProjectDocument, ProjectFrame, StudioProject } from '@/src/types/editor';

const makeId = (prefix: string): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const createFrameId = (): string => makeId('frame');
export const createProjectId = (): string => makeId('project');

export const cloneProjectDocument = (document: ProjectDocument): ProjectDocument => normalizeProjectDocument({
  ...document,
  canvas: { ...document.canvas, socialGuide: document.canvas.socialGuide ? { ...document.canvas.socialGuide } : undefined },
  backgroundImage: document.backgroundImage ? { ...document.backgroundImage } : null,
  palette: [...document.palette],
  fontCatalog: document.fontCatalog.map((font) => ({ ...font })),
  objects: document.objects.map(cloneGraphicObject),
});

export const createProjectFrame = (
  document: ProjectDocument,
  name = 'トップ',
  completedLocked = false,
): ProjectFrame => {
  const now = new Date().toISOString();
  return { frameId: createFrameId(), name, document: cloneProjectDocument(document), completedLocked, createdAt: now, updatedAt: now };
};

export const createStudioProject = (
  palette?: ColorPalette,
  fontCatalog?: FontReference[],
  name = '名称未設定のプロジェクト',
): StudioProject => {
  const now = new Date().toISOString();
  const frame = createProjectFrame(createInitialProject(palette, fontCatalog), 'トップ');
  return {
    kind: 'text-graphic-studio-multi-frame-project', schemaVersion: 1,
    projectId: createProjectId(), projectName: name, frames: [frame], activeFrameId: frame.frameId,
    createdAt: now, updatedAt: now,
  };
};

export const wrapLegacyDocument = (document: ProjectDocument, name = '名称未設定のプロジェクト'): StudioProject => {
  const now = new Date().toISOString();
  const frame = createProjectFrame(normalizeProjectDocument(document), 'トップ');
  return {
    kind: 'text-graphic-studio-multi-frame-project', schemaVersion: 1,
    projectId: createProjectId(), projectName: name, frames: [frame], activeFrameId: frame.frameId,
    createdAt: now, updatedAt: document.updatedAt || now,
  };
};

export const activeFrameOf = (project: StudioProject): ProjectFrame =>
  project.frames.find((frame) => frame.frameId === project.activeFrameId) ?? project.frames[0];

export const materializeActiveDocument = (project: StudioProject, document: ProjectDocument): StudioProject => {
  const now = new Date().toISOString();
  return {
    ...project,
    updatedAt: document.updatedAt || now,
    frames: project.frames.map((frame) => frame.frameId === project.activeFrameId
      ? { ...frame, document: cloneProjectDocument(document), updatedAt: document.updatedAt || now }
      : frame),
  };
};

export const cloneStudioProject = (project: StudioProject): StudioProject => ({
  ...project,
  frames: project.frames.map((frame) => ({ ...frame, document: cloneProjectDocument(frame.document) })),
});

export const normalizeStudioProject = (project: StudioProject): StudioProject => {
  const frames = project.frames.map((frame, index) => ({
    ...frame,
    name: frame.name?.trim() || (index === 0 ? 'トップ' : `${index + 1}コマ目`),
    completedLocked: Boolean(frame.completedLocked),
    document: normalizeProjectDocument(frame.document),
  }));
  if (!frames.length) return createStudioProject(undefined, undefined, project.projectName);
  const activeFrameId = frames.some((frame) => frame.frameId === project.activeFrameId) ? project.activeFrameId : frames[0].frameId;
  return { ...project, frames, activeFrameId, projectName: project.projectName?.trim() || '名称未設定のプロジェクト' };
};

export const isStudioProjectShape = (value: unknown): value is StudioProject => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StudioProject>;
  return candidate.kind === 'text-graphic-studio-multi-frame-project'
    && candidate.schemaVersion === 1
    && typeof candidate.projectId === 'string'
    && typeof candidate.projectName === 'string'
    && typeof candidate.activeFrameId === 'string'
    && typeof candidate.createdAt === 'string'
    && typeof candidate.updatedAt === 'string'
    && Array.isArray(candidate.frames)
    && candidate.frames.length > 0;
};
