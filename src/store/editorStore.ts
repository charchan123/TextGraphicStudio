'use client';

import type { Canvas as FabricCanvas } from 'fabric';
import { create } from 'zustand';

import { HISTORY_LIMIT } from '@/src/constants/editor';
import { cloneBackground, cloneFill, cloneFontCatalog, clonePartialStyle } from '@/src/services/documentData';
import { createGraphicText, createInitialProject, createObjectId, DEFAULT_GRAPHIC_TEXT_PRESET } from '@/src/store/defaults';
import { getStrokeLayers } from '@/src/services/strokes';
import { normalizeLineGapOffsets } from '@/src/services/lineGapOffsets';
import {
  activeFrameOf,
  cloneProjectDocument,
  createFrameId,
  createStudioProject,
  materializeActiveDocument,
  normalizeStudioProject,
} from '@/src/services/studioProject';
import { cloneQuickPartialOperation, cloneQuickPartialPreset, MAX_QUICK_PARTIAL_PRESETS } from '@/src/services/quickPartialPresets';
import { cloneTextDesignDefaults, textDesignDefaultsEqual, toTextDesignDefaults } from '@/src/services/textDefaults';
import type {
  AppNotice,
  BackgroundImageData,
  CanvasPresetId,
  FontReference,
  GraphicTextObject,
  GraphicTextTemplateV1,
  ProjectDocument,
  StudioProject,
  QuickPartialPreset,
  QuickPartialStyleOperation,
  TextDesignDefaults,
} from '@/src/types/editor';

type ObjectUpdater = (object: GraphicTextObject) => GraphicTextObject;
type LayerDirection = 'front' | 'forward' | 'backward' | 'back';
type CanvasCenterMode = 'horizontal' | 'vertical' | 'both';
type SocialGuide = NonNullable<ProjectDocument['canvas']['socialGuide']>;

interface EditorState {
  studioProject: StudioProject;
  project: ProjectDocument;
  selectedId: string | null;
  past: ProjectDocument[];
  future: ProjectDocument[];
  transactionBase: ProjectDocument | null;
  fabricCanvas: FabricCanvas | null;
  zoomPercent: number;
  notice: AppNotice | null;
  lastUsedTextDefaults: TextDesignDefaults;
  quickPartialPresets: QuickPartialPreset[];
  setFabricCanvas: (canvas: FabricCanvas | null) => void;
  setZoomPercent: (percent: number) => void;
  setNotice: (message: string, kind?: AppNotice['kind']) => void;
  clearNotice: () => void;
  hydrateLastUsedTextDefaults: (defaults: TextDesignDefaults) => void;
  hydrateQuickPartialPresets: (presets: QuickPartialPreset[]) => void;
  addQuickPartialPreset: (preset: QuickPartialPreset) => void;
  updateQuickPartialPreset: (id: string, patch: { name?: string; operation?: QuickPartialStyleOperation }) => void;
  deleteQuickPartialPreset: (id: string) => void;
  selectObject: (id: string | null) => void;
  beginTransaction: () => void;
  finishTransaction: () => void;
  updateObject: (id: string, updater: ObjectUpdater, recordHistory?: boolean) => void;
  syncObjectSize: (id: string, width: number, height: number) => void;
  addGraphic: (text: string) => void;
  centerSelectedOnCanvas: (mode: CanvasCenterMode) => void;
  duplicateSelected: () => void;
  deleteObject: (id?: string) => void;
  toggleObjectVisibility: (id: string) => void;
  toggleObjectLock: (id: string) => void;
  toggleObjectFullLock: (id: string) => void;
  moveLayer: (id: string, direction: LayerDirection) => void;
  setBackgroundImage: (image: BackgroundImageData | null) => void;
  setCanvasSize: (width: number, height: number, preset: CanvasPresetId) => void;
  toggleGuides: () => void;
  setSocialGuide: (guide: SocialGuide) => void;
  setPaletteColor: (index: number, color: string) => void;
  addFontReference: (font: FontReference) => void;
  applyTemplate: (template: GraphicTextTemplateV1) => void;
  replaceProject: (project: ProjectDocument) => void;
  replaceStudioProject: (project: StudioProject) => void;
  getStudioProjectSnapshot: () => StudioProject;
  setProjectName: (name: string) => void;
  renameFrame: (frameId: string, name: string) => void;
  addFrame: () => void;
  duplicateFrame: (frameId?: string) => void;
  deleteFrame: (frameId: string) => void;
  reorderFrame: (fromIndex: number, toIndex: number) => void;
  selectFrame: (frameId: string) => void;
  setFrameCompletedLocked: (frameId: string, locked: boolean) => void;
  createNewProject: () => void;
  undo: () => void;
  redo: () => void;
}

const stampProject = (project: ProjectDocument): ProjectDocument => ({
  ...project,
  updatedAt: new Date().toISOString(),
});

const normalizeZIndexes = (objects: GraphicTextObject[]): GraphicTextObject[] =>
  objects.map((object, index) => ({ ...object, zIndex: index }));

const pushHistory = (history: ProjectDocument[], project: ProjectDocument): ProjectDocument[] =>
  [...history, project].slice(-HISTORY_LIMIT);

const initialProject = createInitialProject();
const initialStudioProject = createStudioProject(initialProject.palette, initialProject.fontCatalog);
initialStudioProject.frames[0] = { ...initialStudioProject.frames[0], document: initialProject };

const activeFrameLocked = (state: Pick<EditorState, 'studioProject'>): boolean =>
  Boolean(activeFrameOf(state.studioProject)?.completedLocked);

const editBlocked = (state: EditorState, message = '完成ロック中のコマは編集できません。'): EditorState => ({
  ...state,
  transactionBase: null,
  notice: { id: Date.now(), kind: 'warning', message },
});

export const useEditorStore = create<EditorState>()((set, get) => ({
  studioProject: initialStudioProject,
  project: initialProject,
  selectedId: initialProject.objects[0]?.id ?? null,
  past: [],
  future: [],
  transactionBase: null,
  fabricCanvas: null,
  zoomPercent: 100,
  notice: null,
  lastUsedTextDefaults: cloneTextDesignDefaults(DEFAULT_GRAPHIC_TEXT_PRESET),
  quickPartialPresets: [],

  setFabricCanvas: (fabricCanvas) => set({ fabricCanvas }),
  setZoomPercent: (zoomPercent) => set({ zoomPercent }),
  setNotice: (message, kind = 'info') =>
    set({ notice: { id: Date.now(), kind, message } }),
  clearNotice: () => set({ notice: null }),
  hydrateLastUsedTextDefaults: (lastUsedTextDefaults) => set({ lastUsedTextDefaults: cloneTextDesignDefaults(lastUsedTextDefaults) }),
  hydrateQuickPartialPresets: (quickPartialPresets) => set({
    quickPartialPresets: quickPartialPresets.slice(0, MAX_QUICK_PARTIAL_PRESETS).map(cloneQuickPartialPreset),
  }),
  addQuickPartialPreset: (preset) => set((state) => state.quickPartialPresets.length >= MAX_QUICK_PARTIAL_PRESETS
    ? state
    : { quickPartialPresets: [...state.quickPartialPresets, cloneQuickPartialPreset(preset)] }),
  updateQuickPartialPreset: (id, patch) => set((state) => ({
    quickPartialPresets: state.quickPartialPresets.map((preset) => preset.id === id ? {
      ...preset,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.operation ? { operation: cloneQuickPartialOperation(patch.operation) } : {}),
      updatedAt: new Date().toISOString(),
    } : preset),
  })),
  deleteQuickPartialPreset: (id) => set((state) => ({
    quickPartialPresets: state.quickPartialPresets.filter((preset) => preset.id !== id),
  })),
  selectObject: (selectedId) => set({ selectedId }),

  beginTransaction: () =>
    set((state) => ({ transactionBase: state.transactionBase ?? state.project })),

  finishTransaction: () =>
    set((state) => {
      if (!state.transactionBase || state.transactionBase === state.project) {
        return { transactionBase: null };
      }
      return {
        past: pushHistory(state.past, state.transactionBase),
        future: [],
        transactionBase: null,
      };
    }),

  updateObject: (id, updater, recordHistory = true) =>
    set((state) => {
      if (activeFrameLocked(state)) return editBlocked(state);
      const existing = state.project.objects.find((object) => object.id === id);
      if (!existing) return state;
      if (existing.fullyLocked) return editBlocked(state, '完全ロック中のオブジェクトは編集できません。');
      const updated = updater(existing);
      const previousDefaults = toTextDesignDefaults(existing);
      const nextDefaults = toTextDesignDefaults(updated);
      const nextProject = stampProject({
        ...state.project,
        objects: state.project.objects.map((object) =>
          object.id === id ? updated : object,
        ),
      });
      const defaultsPatch = textDesignDefaultsEqual(previousDefaults, nextDefaults)
        ? {} : { lastUsedTextDefaults: nextDefaults };
      if (!recordHistory) return { project: nextProject, ...defaultsPatch };
      const historyBase = state.transactionBase ?? state.project;
      return {
        project: nextProject,
        past: pushHistory(state.past, historyBase),
        future: [],
        transactionBase: null,
        ...defaultsPatch,
      };
    }),

  syncObjectSize: (id, width, height) =>
    set((state) => {
      const object = state.project.objects.find((item) => item.id === id);
      if (!object) return state;
      if (Math.abs(object.size.width - width) < 0.5 && Math.abs(object.size.height - height) < 0.5) {
        return state;
      }
      return {
        project: {
          ...state.project,
          objects: state.project.objects.map((item) =>
            item.id === id ? { ...item, size: { width, height } } : item,
          ),
        },
      };
    }),

  addGraphic: (text) =>
    set((state) => {
      if (activeFrameLocked(state)) return editBlocked(state);
      const newObject = createGraphicText(
        text,
        state.project.objects.length,
        state.project.canvas.width,
        state.project.canvas.height,
        state.lastUsedTextDefaults,
        true,
      );
      return {
        project: stampProject({
          ...state.project,
          objects: normalizeZIndexes([...state.project.objects, newObject]),
        }),
        selectedId: newObject.id,
        past: pushHistory(state.past, state.transactionBase ?? state.project),
        future: [],
        transactionBase: null,
      };
    }),

  centerSelectedOnCanvas: (mode) =>
    set((state) => {
      if (activeFrameLocked(state)) return editBlocked(state);
      if (!state.selectedId) return state;
      const selected = state.project.objects.find(
        (object) => object.id === state.selectedId,
      );
      if (!selected || selected.locked || selected.fullyLocked) return state;

      const position = {
        x:
          mode === 'vertical'
            ? selected.position.x
            : state.project.canvas.width / 2,
        y:
          mode === 'horizontal'
            ? selected.position.y
            : state.project.canvas.height / 2,
      };
      if (
        position.x === selected.position.x &&
        position.y === selected.position.y
      )
        return state;

      return {
        project: stampProject({
          ...state.project,
          objects: state.project.objects.map((object) =>
            object.id === state.selectedId ? { ...object, position } : object,
          ),
        }),
        past: pushHistory(state.past, state.transactionBase ?? state.project),
        future: [],
        transactionBase: null,
      };
    }),

  duplicateSelected: () =>
    set((state) => {
      if (activeFrameLocked(state)) return editBlocked(state);
      const source = state.project.objects.find((object) => object.id === state.selectedId);
      if (!source) return state;
      if (source.fullyLocked) return editBlocked(state, '完全ロック中のオブジェクトは複製できません。');
      const duplicate: GraphicTextObject = {
        ...source,
        id: createObjectId(),
        name: `${source.name} のコピー`,
        position: { x: source.position.x + 40, y: source.position.y + 40 },
        transform: { ...source.transform },
        typography: { ...source.typography },
        characterScale: { ...source.characterScale },
        lineGapOffsets: [...source.lineGapOffsets],
        fill: cloneFill(source.fill),
        stroke: { ...source.stroke },
        outerStroke: { ...source.outerStroke },
        strokes: getStrokeLayers(source),
        shadow: { ...source.shadow },
        background: { ...cloneBackground(source.background), seed: source.background.seed + 97 },
        partialStyles: source.partialStyles.map(clonePartialStyle),
        locked: false,
        fullyLocked: false,
        zIndex: state.project.objects.length,
      };
      return {
        project: stampProject({ ...state.project, objects: [...state.project.objects, duplicate] }),
        selectedId: duplicate.id,
        past: pushHistory(state.past, state.transactionBase ?? state.project),
        future: [],
        transactionBase: null,
      };
    }),

  deleteObject: (requestedId) =>
    set((state) => {
      if (activeFrameLocked(state)) return editBlocked(state);
      const id = requestedId ?? state.selectedId;
      if (!id || !state.project.objects.some((object) => object.id === id)) return state;
      if (state.project.objects.find((object) => object.id === id)?.fullyLocked) {
        return editBlocked(state, '完全ロック中のオブジェクトは削除できません。');
      }
      const objects = normalizeZIndexes(state.project.objects.filter((object) => object.id !== id));
      return {
        project: stampProject({ ...state.project, objects }),
        selectedId: state.selectedId === id ? objects.at(-1)?.id ?? null : state.selectedId,
        past: pushHistory(state.past, state.transactionBase ?? state.project),
        future: [],
        transactionBase: null,
      };
    }),

  toggleObjectVisibility: (id) => get().updateObject(id, (object) => ({ ...object, visible: !object.visible })),
  toggleObjectLock: (id) => get().updateObject(id, (object) => ({ ...object, locked: !object.locked })),
  toggleObjectFullLock: (id) => set((state) => {
    if (activeFrameLocked(state)) return editBlocked(state);
    const existing = state.project.objects.find((object) => object.id === id);
    if (!existing) return state;
    const project = stampProject({
      ...state.project,
      objects: state.project.objects.map((object) => object.id === id ? { ...object, fullyLocked: !object.fullyLocked } : object),
    });
    return {
      project,
      past: pushHistory(state.past, state.transactionBase ?? state.project),
      future: [],
      transactionBase: null,
    };
  }),

  moveLayer: (id, direction) =>
    set((state) => {
      if (activeFrameLocked(state)) return editBlocked(state);
      const objects = [...state.project.objects];
      const from = objects.findIndex((object) => object.id === id);
      if (from < 0) return state;
      if (objects[from].fullyLocked) return editBlocked(state, '完全ロック中のオブジェクトは重なり順を変更できません。');
      let to = from;
      if (direction === 'front') to = objects.length - 1;
      if (direction === 'forward') to = Math.min(objects.length - 1, from + 1);
      if (direction === 'backward') to = Math.max(0, from - 1);
      if (direction === 'back') to = 0;
      if (to === from) return state;
      const [moved] = objects.splice(from, 1);
      objects.splice(to, 0, moved);
      return {
        project: stampProject({ ...state.project, objects: normalizeZIndexes(objects) }),
        past: pushHistory(state.past, state.transactionBase ?? state.project),
        future: [],
        transactionBase: null,
      };
    }),

  setBackgroundImage: (backgroundImage) =>
    set((state) => activeFrameLocked(state) ? editBlocked(state) : ({
      project: stampProject({ ...state.project, backgroundImage }),
      past: pushHistory(state.past, state.transactionBase ?? state.project),
      future: [],
      transactionBase: null,
    })),

  setCanvasSize: (width, height, preset) =>
    set((state) => activeFrameLocked(state) ? editBlocked(state) : ({
      project: stampProject({ ...state.project, canvas: { ...state.project.canvas, width, height, preset } }),
      past: pushHistory(state.past, state.transactionBase ?? state.project),
      future: [],
      transactionBase: null,
    })),

  toggleGuides: () =>
    set((state) => ({
      project: stampProject({
        ...state.project,
        canvas: { ...state.project.canvas, guidesVisible: !state.project.canvas.guidesVisible },
      }),
      past: pushHistory(state.past, state.transactionBase ?? state.project),
      future: [],
      transactionBase: null,
    })),

  setSocialGuide: (socialGuide) => set((state) => ({
    project: stampProject({ ...state.project, canvas: { ...state.project.canvas, socialGuide } }),
    past: pushHistory(state.past, state.transactionBase ?? state.project),
    future: [],
    transactionBase: null,
  })),

  setPaletteColor: (index, color) => set((state) => {
    if (activeFrameLocked(state)) return editBlocked(state);
    if (index < 0 || index >= state.project.palette.length || state.project.palette[index] === color) return state;
    const palette = [...state.project.palette];
    palette[index] = color.toUpperCase();
    return {
      project: stampProject({ ...state.project, palette: palette as ProjectDocument['palette'] }),
      past: pushHistory(state.past, state.transactionBase ?? state.project),
      future: [],
      transactionBase: null,
    };
  }),

  addFontReference: (font) => set((state) => {
    if (activeFrameLocked(state)) return editBlocked(state);
    const fontCatalog = state.project.fontCatalog.some((item) => item.id === font.id)
      ? state.project.fontCatalog.map((item) => item.id === font.id ? { ...font } : item)
      : [...state.project.fontCatalog, { ...font }];
    return {
      project: stampProject({ ...state.project, fontCatalog }),
      past: pushHistory(state.past, state.transactionBase ?? state.project),
      future: [],
      transactionBase: null,
    };
  }),

  applyTemplate: (template) => set((state) => {
    if (activeFrameLocked(state)) return editBlocked(state);
    const id = state.selectedId;
    if (!id) return state;
    const existing = state.project.objects.find((object) => object.id === id);
    if (!existing) return state;
    if (existing.fullyLocked) return editBlocked(state, '完全ロック中のオブジェクトへテンプレートは適用できません。');
    const incomingFonts = cloneFontCatalog(template.fontCatalog ?? []);
    const fontCatalog = [...state.project.fontCatalog];
    incomingFonts.forEach((font) => {
      const index = fontCatalog.findIndex((item) => item.id === font.id);
      if (index >= 0) fontCatalog[index] = font;
      else fontCatalog.push(font);
    });
    const updated: GraphicTextObject = {
      ...existing,
      typography: { ...template.typography },
      fill: cloneFill(template.fill),
      stroke: { ...template.stroke },
      outerStroke: { ...template.outerStroke },
      strokes: getStrokeLayers(template),
      shadow: { ...template.shadow },
      background: cloneBackground(template.background),
      transform: { ...template.transform },
      characterScale: { ...template.characterScale },
      lineGapOffsets: normalizeLineGapOffsets(existing.text, template.lineGapOffsets),
      partialStyles: template.partialStyles.map(clonePartialStyle),
      position: template.includePosition && template.position ? { ...template.position } : existing.position,
    };
    const lastUsedTextDefaults = toTextDesignDefaults(updated);
    return {
      project: stampProject({
        ...state.project,
        palette: template.palette ? [...template.palette] : state.project.palette,
        fontCatalog,
        objects: state.project.objects.map((object) => object.id === id ? updated : object),
      }),
      past: pushHistory(state.past, state.transactionBase ?? state.project),
      future: [],
      transactionBase: null,
      lastUsedTextDefaults,
    };
  }),

  replaceProject: (project) =>
    set((state) => ({
      studioProject: materializeActiveDocument(state.studioProject, project),
      project,
      selectedId: project.objects.at(-1)?.id ?? null,
      past: [], future: [], transactionBase: null,
    })),

  replaceStudioProject: (incoming) => set(() => {
    const studioProject = normalizeStudioProject(incoming);
    const project = cloneProjectDocument(activeFrameOf(studioProject).document);
    return {
      studioProject,
      project,
      selectedId: project.objects.at(-1)?.id ?? null,
      past: [], future: [], transactionBase: null,
    };
  }),

  getStudioProjectSnapshot: () => {
    const state = get();
    return materializeActiveDocument(state.studioProject, state.project);
  },

  setProjectName: (name) => set((state) => ({
    studioProject: {
      ...materializeActiveDocument(state.studioProject, state.project),
      projectName: name,
      updatedAt: new Date().toISOString(),
    },
  })),

  renameFrame: (frameId, name) => set((state) => {
    const studioProject = materializeActiveDocument(state.studioProject, state.project);
    return {
      studioProject: {
        ...studioProject,
        updatedAt: new Date().toISOString(),
        frames: studioProject.frames.map((frame) => frame.frameId === frameId ? { ...frame, name, updatedAt: new Date().toISOString() } : frame),
      },
    };
  }),

  addFrame: () => set((state) => {
    const studioProject = materializeActiveDocument(state.studioProject, state.project);
    const document = createInitialProject(state.project.palette, state.project.fontCatalog);
    const now = new Date().toISOString();
    const frameId = createFrameId();
    const frame = {
      frameId,
      name: `${studioProject.frames.length + 1}コマ目`,
      document,
      completedLocked: false,
      createdAt: now,
      updatedAt: now,
    };
    return {
      studioProject: { ...studioProject, frames: [...studioProject.frames, frame], activeFrameId: frameId, updatedAt: now },
      project: document,
      selectedId: document.objects[0]?.id ?? null,
      past: [], future: [], transactionBase: null,
    };
  }),

  duplicateFrame: (requestedId) => set((state) => {
    const studioProject = materializeActiveDocument(state.studioProject, state.project);
    const frameId = requestedId ?? studioProject.activeFrameId;
    const index = studioProject.frames.findIndex((frame) => frame.frameId === frameId);
    if (index < 0) return state;
    const source = studioProject.frames[index];
    const now = new Date().toISOString();
    const document = cloneProjectDocument(source.document);
    document.objects = document.objects.map((object) => ({ ...object, id: createObjectId() }));
    const duplicate = {
      ...source,
      frameId: createFrameId(),
      name: `${source.name} のコピー`,
      document,
      completedLocked: false,
      createdAt: now,
      updatedAt: now,
    };
    const frames = [...studioProject.frames];
    frames.splice(index + 1, 0, duplicate);
    return {
      studioProject: { ...studioProject, frames, activeFrameId: duplicate.frameId, updatedAt: now },
      project: document,
      selectedId: document.objects.at(-1)?.id ?? null,
      past: [], future: [], transactionBase: null,
    };
  }),

  deleteFrame: (frameId) => set((state) => {
    const studioProject = materializeActiveDocument(state.studioProject, state.project);
    if (studioProject.frames.length <= 1) return editBlocked(state, '最後のコマは削除できません。');
    const index = studioProject.frames.findIndex((frame) => frame.frameId === frameId);
    if (index < 0) return state;
    if (studioProject.frames[index].completedLocked) return editBlocked(state, '完成ロック中のコマは削除できません。');
    const frames = studioProject.frames.filter((frame) => frame.frameId !== frameId);
    const activeFrameId = frameId === studioProject.activeFrameId
      ? frames[Math.min(index, frames.length - 1)].frameId
      : studioProject.activeFrameId;
    const nextDocument = activeFrameId === studioProject.activeFrameId
      ? state.project
      : cloneProjectDocument(frames.find((frame) => frame.frameId === activeFrameId)!.document);
    return {
      studioProject: { ...studioProject, frames, activeFrameId, updatedAt: new Date().toISOString() },
      project: nextDocument,
      selectedId: nextDocument.objects.at(-1)?.id ?? null,
      past: [], future: [], transactionBase: null,
    };
  }),

  reorderFrame: (fromIndex, toIndex) => set((state) => {
    const studioProject = materializeActiveDocument(state.studioProject, state.project);
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= studioProject.frames.length || toIndex >= studioProject.frames.length) return state;
    const frames = [...studioProject.frames];
    const [moved] = frames.splice(fromIndex, 1);
    frames.splice(toIndex, 0, moved);
    return { studioProject: { ...studioProject, frames, updatedAt: new Date().toISOString() } };
  }),

  selectFrame: (frameId) => set((state) => {
    if (frameId === state.studioProject.activeFrameId) return state;
    const studioProject = materializeActiveDocument(state.studioProject, state.project);
    const frame = studioProject.frames.find((item) => item.frameId === frameId);
    if (!frame) return state;
    const project = cloneProjectDocument(frame.document);
    return {
      studioProject: { ...studioProject, activeFrameId: frameId },
      project,
      selectedId: project.objects.at(-1)?.id ?? null,
      past: [], future: [], transactionBase: null,
    };
  }),

  setFrameCompletedLocked: (frameId, completedLocked) => set((state) => {
    const studioProject = materializeActiveDocument(state.studioProject, state.project);
    return {
      studioProject: {
        ...studioProject,
        updatedAt: new Date().toISOString(),
        frames: studioProject.frames.map((frame) => frame.frameId === frameId ? { ...frame, completedLocked, updatedAt: new Date().toISOString() } : frame),
      },
      past: [], future: [], transactionBase: null,
    };
  }),

  createNewProject: () =>
    set((state) => {
      const studioProject = createStudioProject(state.project.palette, state.project.fontCatalog);
      const project = activeFrameOf(studioProject).document;
      return {
        studioProject,
        project,
        selectedId: project.objects[0]?.id ?? null,
        past: [], future: [], transactionBase: null,
      };
    }),

  undo: () =>
    set((state) => {
      const previous = state.past.at(-1);
      if (!previous) return state;
      const selectedId = previous.objects.some((object) => object.id === state.selectedId)
        ? state.selectedId
        : previous.objects.at(-1)?.id ?? null;
      const selected = previous.objects.find((object) => object.id === selectedId);
      return {
        project: previous,
        selectedId,
        past: state.past.slice(0, -1),
        future: [state.project, ...state.future].slice(0, HISTORY_LIMIT),
        transactionBase: null,
        lastUsedTextDefaults: selected ? toTextDesignDefaults(selected) : state.lastUsedTextDefaults,
      };
    }),

  redo: () =>
    set((state) => {
      const next = state.future[0];
      if (!next) return state;
      const selectedId = next.objects.some((object) => object.id === state.selectedId)
        ? state.selectedId
        : next.objects.at(-1)?.id ?? null;
      const selected = next.objects.find((object) => object.id === selectedId);
      return {
        project: next,
        selectedId,
        past: pushHistory(state.past, state.project),
        future: state.future.slice(1),
        transactionBase: null,
        lastUsedTextDefaults: selected ? toTextDesignDefaults(selected) : state.lastUsedTextDefaults,
      };
    }),
}));
