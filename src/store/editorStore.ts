'use client';

import type { Canvas as FabricCanvas } from 'fabric';
import { create } from 'zustand';

import { HISTORY_LIMIT } from '@/src/constants/editor';
import { createGraphicText, createInitialProject, createObjectId } from '@/src/store/defaults';
import type {
  AppNotice,
  BackgroundImageData,
  CanvasPresetId,
  GraphicTextObject,
  GraphicTextTemplateV1,
  ProjectDocument,
} from '@/src/types/editor';

type ObjectUpdater = (object: GraphicTextObject) => GraphicTextObject;
type LayerDirection = 'front' | 'forward' | 'backward' | 'back';

interface EditorState {
  project: ProjectDocument;
  selectedId: string | null;
  past: ProjectDocument[];
  future: ProjectDocument[];
  transactionBase: ProjectDocument | null;
  fabricCanvas: FabricCanvas | null;
  zoomPercent: number;
  notice: AppNotice | null;
  setFabricCanvas: (canvas: FabricCanvas | null) => void;
  setZoomPercent: (percent: number) => void;
  setNotice: (message: string, kind?: AppNotice['kind']) => void;
  clearNotice: () => void;
  selectObject: (id: string | null) => void;
  beginTransaction: () => void;
  finishTransaction: () => void;
  updateObject: (id: string, updater: ObjectUpdater, recordHistory?: boolean) => void;
  syncObjectSize: (id: string, width: number, height: number) => void;
  addGraphic: (text: string) => void;
  duplicateSelected: () => void;
  deleteObject: (id?: string) => void;
  toggleObjectVisibility: (id: string) => void;
  toggleObjectLock: (id: string) => void;
  moveLayer: (id: string, direction: LayerDirection) => void;
  setBackgroundImage: (image: BackgroundImageData | null) => void;
  setCanvasSize: (width: number, height: number, preset: CanvasPresetId) => void;
  toggleGuides: () => void;
  applyTemplate: (template: GraphicTextTemplateV1) => void;
  replaceProject: (project: ProjectDocument) => void;
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

export const useEditorStore = create<EditorState>()((set, get) => ({
  project: initialProject,
  selectedId: initialProject.objects[0]?.id ?? null,
  past: [],
  future: [],
  transactionBase: null,
  fabricCanvas: null,
  zoomPercent: 100,
  notice: null,

  setFabricCanvas: (fabricCanvas) => set({ fabricCanvas }),
  setZoomPercent: (zoomPercent) => set({ zoomPercent }),
  setNotice: (message, kind = 'info') =>
    set({ notice: { id: Date.now(), kind, message } }),
  clearNotice: () => set({ notice: null }),
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
      const existing = state.project.objects.find((object) => object.id === id);
      if (!existing) return state;
      const nextProject = stampProject({
        ...state.project,
        objects: state.project.objects.map((object) =>
          object.id === id ? updater(object) : object,
        ),
      });
      if (!recordHistory) return { project: nextProject };
      const historyBase = state.transactionBase ?? state.project;
      return {
        project: nextProject,
        past: pushHistory(state.past, historyBase),
        future: [],
        transactionBase: null,
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
      const newObject = createGraphicText(
        text,
        state.project.objects.length,
        state.project.canvas.width,
        state.project.canvas.height,
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

  duplicateSelected: () =>
    set((state) => {
      const source = state.project.objects.find((object) => object.id === state.selectedId);
      if (!source) return state;
      const duplicate: GraphicTextObject = {
        ...source,
        id: createObjectId(),
        name: `${source.name} のコピー`,
        position: { x: source.position.x + 40, y: source.position.y + 40 },
        transform: { ...source.transform },
        typography: { ...source.typography },
        characterScale: { ...source.characterScale },
        fill: source.fill.type === 'solid'
          ? { ...source.fill }
          : { ...source.fill, stops: source.fill.stops.map((stop) => ({ ...stop })) },
        stroke: { ...source.stroke },
        outerStroke: { ...source.outerStroke },
        shadow: { ...source.shadow },
        background: { ...source.background, seed: source.background.seed + 97 },
        partialStyles: source.partialStyles.map((style) => ({ ...style })),
        locked: false,
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
      const id = requestedId ?? state.selectedId;
      if (!id || !state.project.objects.some((object) => object.id === id)) return state;
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

  moveLayer: (id, direction) =>
    set((state) => {
      const objects = [...state.project.objects];
      const from = objects.findIndex((object) => object.id === id);
      if (from < 0) return state;
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
    set((state) => ({
      project: stampProject({ ...state.project, backgroundImage }),
      past: pushHistory(state.past, state.transactionBase ?? state.project),
      future: [],
      transactionBase: null,
    })),

  setCanvasSize: (width, height, preset) =>
    set((state) => ({
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

  applyTemplate: (template) => {
    const id = get().selectedId;
    if (!id) return;
    get().updateObject(id, (object) => ({
      ...object,
      typography: { ...template.typography },
      fill: template.fill.type === 'solid'
        ? { ...template.fill }
        : { ...template.fill, stops: template.fill.stops.map((stop) => ({ ...stop })) },
      stroke: { ...template.stroke },
      outerStroke: { ...template.outerStroke },
      shadow: { ...template.shadow },
      background: { ...template.background },
      transform: { ...template.transform },
      characterScale: { ...template.characterScale },
      partialStyles: template.partialStyles.map((style) => ({ ...style })),
      position: template.includePosition && template.position ? { ...template.position } : object.position,
    }));
  },

  replaceProject: (project) =>
    set({
      project,
      selectedId: project.objects.at(-1)?.id ?? null,
      past: [],
      future: [],
      transactionBase: null,
    }),

  createNewProject: () =>
    set((state) => {
      const project = createInitialProject();
      return {
        project,
        selectedId: project.objects[0]?.id ?? null,
        past: pushHistory(state.past, state.project),
        future: [],
        transactionBase: null,
      };
    }),

  undo: () =>
    set((state) => {
      const previous = state.past.at(-1);
      if (!previous) return state;
      const selectedId = previous.objects.some((object) => object.id === state.selectedId)
        ? state.selectedId
        : previous.objects.at(-1)?.id ?? null;
      return {
        project: previous,
        selectedId,
        past: state.past.slice(0, -1),
        future: [state.project, ...state.future].slice(0, HISTORY_LIMIT),
        transactionBase: null,
      };
    }),

  redo: () =>
    set((state) => {
      const next = state.future[0];
      if (!next) return state;
      const selectedId = next.objects.some((object) => object.id === state.selectedId)
        ? state.selectedId
        : next.objects.at(-1)?.id ?? null;
      return {
        project: next,
        selectedId,
        past: pushHistory(state.past, state.project),
        future: state.future.slice(1),
        transactionBase: null,
      };
    }),
}));
