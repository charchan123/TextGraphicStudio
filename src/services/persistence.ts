import type { BackgroundPreset, ProjectDocument, QuickPartialPreset, QuickPartialStyleOperation, StudioProject, TextDesignDefaults } from '@/src/types/editor';
import { normalizeProjectDocument, normalizeTextBackground } from '@/src/services/documentData';
import { cloneQuickPartialPreset, hasQuickPartialOperation, MAX_QUICK_PARTIAL_PRESETS } from '@/src/services/quickPartialPresets';
import { toTextDesignDefaults } from '@/src/services/textDefaults';
import { isStrokeLayers } from '@/src/services/styleValidation';
import { bounded, isColorPalette, isFillStyle, isFontReference, isPartialTextStyle, isSafeFontText, isTextBackground } from '@/src/services/styleValidation';
import { normalizeStudioProject, wrapLegacyDocument } from '@/src/services/studioProject';

const DATABASE_NAME = 'text-graphic-studio';
const STORE_NAME = 'projects';
const AUTOSAVE_KEY = 'autosave';
const LAST_USED_TEXT_DEFAULTS_KEY = 'last-used-text-defaults';
const QUICK_PARTIAL_PRESETS_KEY = 'quick-partial-presets';
const PRESETS_STORE = 'background-presets';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const isProjectDocument = (value: unknown): value is ProjectDocument => {
  if (!isRecord(value)) return false;
  if (value.kind !== 'text-graphic-studio-project' || value.schemaVersion !== 1) return false;
  if (!isRecord(value.canvas) || !Array.isArray(value.objects)) return false;
  return (
    typeof value.canvas.width === 'number' &&
    typeof value.canvas.height === 'number' &&
    typeof value.canvas.guidesVisible === 'boolean' &&
    typeof value.updatedAt === 'string' &&
    (value.palette === undefined || isColorPalette(value.palette)) &&
    (value.fontCatalog === undefined || (Array.isArray(value.fontCatalog) && value.fontCatalog.every(isFontReference))) &&
    value.objects.every((object) =>
      isRecord(object) &&
      object.kind === 'graphic-text' &&
      typeof object.id === 'string' &&
      typeof object.text === 'string' && isRecord(object.typography)
      && isRecord(object.characterScale)
      && isFiniteNumber(object.characterScale.kanji)
      && isFiniteNumber(object.characterScale.hiragana)
      && isFiniteNumber(object.characterScale.katakana)
      && isFiniteNumber(object.characterScale.latin)
      && isFiniteNumber(object.characterScale.number)
      && (object.characterScale.symbol === undefined || isFiniteNumber(object.characterScale.symbol))
      && (object.lineGapOffsets === undefined || (Array.isArray(object.lineGapOffsets) && object.lineGapOffsets.every((offset) => bounded(offset, -100, 100))))
      && (object.fullyLocked === undefined || typeof object.fullyLocked === 'boolean')
      && (object.strokes === undefined || isStrokeLayers(object.strokes))
      && isSafeFontText(object.typography.fontFamily)
      && (object.typography.fontRefId === undefined || isSafeFontText(object.typography.fontRefId))
      && (object.typography.fontStyle === undefined || object.typography.fontStyle === 'normal' || object.typography.fontStyle === 'italic' || object.typography.fontStyle === 'slant')
      && (object.typography.slant === undefined || bounded(object.typography.slant, -25, 25))
      && (object.typography.glyphScaleX === undefined || bounded(object.typography.glyphScaleX, 0.5, 1.5))
      && (object.typography.glyphScaleY === undefined || bounded(object.typography.glyphScaleY, 0.5, 1.5))
      && isTextBackground(object.background) && isFillStyle(object.fill) &&
      Array.isArray(object.partialStyles) && object.partialStyles.every(isPartialTextStyle),
    )
  );
};

export const isStudioProject = (value: unknown): value is StudioProject => {
  if (!isRecord(value) || value.kind !== 'text-graphic-studio-multi-frame-project' || value.schemaVersion !== 1) return false;
  if (typeof value.projectId !== 'string' || typeof value.projectName !== 'string' || typeof value.activeFrameId !== 'string') return false;
  if (typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string' || !Array.isArray(value.frames) || value.frames.length < 1) return false;
  const frameIds = new Set<string>();
  const validFrames = value.frames.every((frame) => {
    if (!isRecord(frame) || typeof frame.frameId !== 'string' || !frame.frameId || frameIds.has(frame.frameId)) return false;
    frameIds.add(frame.frameId);
    return typeof frame.name === 'string'
      && typeof frame.completedLocked === 'boolean'
      && typeof frame.createdAt === 'string'
      && typeof frame.updatedAt === 'string'
      && isProjectDocument(frame.document);
  });
  return validFrames && frameIds.has(value.activeFrameId);
};

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 2);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
      if (!database.objectStoreNames.contains(PRESETS_STORE)) database.createObjectStore(PRESETS_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('データベースを開けませんでした。'));
  });

const runRequest = <T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>, storeName = STORE_NAME): Promise<T> =>
  openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(storeName, mode);
        const request = operation(transaction.objectStore(storeName));
        request.onerror = () => reject(request.error ?? new Error('保存処理に失敗しました。'));
        transaction.oncomplete = () => { database.close(); resolve(request.result); };
        transaction.onerror = () => {
          database.close();
          reject(transaction.error ?? new Error('保存処理に失敗しました。'));
        };
        transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error('保存を完了できませんでした。')); };
      }),
  );

export const saveAutosave = async (project: StudioProject): Promise<void> => {
  await runRequest('readwrite', (store) => store.put(project, AUTOSAVE_KEY));
};

export const loadAutosave = async (): Promise<StudioProject | null> => {
  const value = await runRequest<unknown>('readonly', (store) => store.get(AUTOSAVE_KEY));
  if (isStudioProject(value)) return normalizeStudioProject(value);
  return isProjectDocument(value) ? wrapLegacyDocument(normalizeProjectDocument(value)) : null;
};

export const clearAutosave = async (): Promise<void> => {
  await runRequest('readwrite', (store) => store.delete(AUTOSAVE_KEY));
};

export const saveLastUsedTextDefaults = async (defaults: TextDesignDefaults): Promise<void> => {
  await runRequest('readwrite', (store) => store.put({
    kind: 'text-graphic-studio-last-used-text-defaults',
    schemaVersion: 1,
    defaults,
  }, LAST_USED_TEXT_DEFAULTS_KEY));
};

export const loadLastUsedTextDefaults = async (): Promise<TextDesignDefaults | null> => {
  const value = await runRequest<unknown>('readonly', (store) => store.get(LAST_USED_TEXT_DEFAULTS_KEY));
  if (!isRecord(value) || value.kind !== 'text-graphic-studio-last-used-text-defaults' || value.schemaVersion !== 1 || !isRecord(value.defaults)) return null;
  const defaults = value.defaults;
  const probe = {
    kind: 'text-graphic-studio-project', schemaVersion: 1, updatedAt: new Date(0).toISOString(),
    canvas: { width: 1080, height: 1920, preset: 'portrait', guidesVisible: true },
    backgroundImage: null,
    objects: [{ ...defaults, id: 'last-used', name: 'last-used', text: ' ', position: { x: 0, y: 0 }, zIndex: 0 }],
  };
  if (!isProjectDocument(probe)) return null;
  return toTextDesignDefaults(normalizeProjectDocument(probe).objects[0]);
};

const PARTIAL_STYLE_OPERATION_KEYS = new Set([
  'fill', 'fontScale', 'fontSize', 'letterSpacing', 'fontWeight', 'fontFamily', 'fontRefId', 'fontStyle', 'glyphScaleX', 'glyphScaleY',
]);

const isQuickPartialOperation = (value: unknown): value is QuickPartialStyleOperation => {
  if (!isRecord(value) || !isRecord(value.style)) return false;
  if (!Object.keys(value.style).every((key) => PARTIAL_STYLE_OPERATION_KEYS.has(key))) return false;
  if (!isPartialTextStyle({ ...value.style, start: 0, end: 1 })) return false;
  if (value.strokes === undefined) return true;
  if (!isRecord(value.strokes)) return false;
  return Object.entries(value.strokes).every(([key, operation]) => {
    if (!['1', '2', '3'].includes(key) || !isRecord(operation)) return false;
    if (!Object.keys(operation).every((property) => ['enabled', 'color', 'width'].includes(property))) return false;
    if (operation.enabled !== undefined && (typeof operation.enabled !== 'string' || !['inherit', 'on', 'off'].includes(operation.enabled))) return false;
    if (operation.color !== undefined && (!isRecord(operation.color)
      || typeof operation.color.action !== 'string' || !['inherit', 'change'].includes(operation.color.action)
      || (operation.color.action === 'change' && !isFillStyle({ type: 'solid', color: operation.color.value })))) return false;
    if (operation.width !== undefined && (!isRecord(operation.width)
      || typeof operation.width.action !== 'string' || !['inherit', 'change'].includes(operation.width.action)
      || (operation.width.action === 'change' && !bounded(operation.width.value, 0, 40)))) return false;
    return true;
  });
};

const isQuickPartialPreset = (value: unknown): value is QuickPartialPreset => isRecord(value)
  && isSafeFontText(value.id)
  && typeof value.name === 'string' && value.name.trim().length > 0 && value.name.length <= 40
  && typeof value.createdAt === 'string' && typeof value.updatedAt === 'string'
  && isQuickPartialOperation(value.operation)
  && hasQuickPartialOperation(value.operation);

export const saveQuickPartialPresets = async (presets: QuickPartialPreset[]): Promise<void> => {
  await runRequest('readwrite', (store) => store.put({
    kind: 'text-graphic-studio-quick-partial-presets',
    schemaVersion: 1,
    presets: presets.slice(0, MAX_QUICK_PARTIAL_PRESETS).map(cloneQuickPartialPreset),
  }, QUICK_PARTIAL_PRESETS_KEY));
};

export const loadQuickPartialPresets = async (): Promise<QuickPartialPreset[]> => {
  const value = await runRequest<unknown>('readonly', (store) => store.get(QUICK_PARTIAL_PRESETS_KEY));
  if (!isRecord(value) || value.kind !== 'text-graphic-studio-quick-partial-presets' || value.schemaVersion !== 1 || !Array.isArray(value.presets)) return [];
  return value.presets.filter(isQuickPartialPreset).slice(0, MAX_QUICK_PARTIAL_PRESETS).map(cloneQuickPartialPreset);
};

export const saveBackgroundPreset = async (preset: BackgroundPreset): Promise<void> => {
  await runRequest('readwrite', (store) => store.put(preset), PRESETS_STORE);
};

export const listBackgroundPresets = async (): Promise<BackgroundPreset[]> => {
  const presets = await runRequest<BackgroundPreset[]>('readonly', (store) => store.getAll(), PRESETS_STORE);
  return presets
    .filter((preset) => isRecord(preset) && typeof preset.id === 'string' && typeof preset.name === 'string' && isTextBackground(preset.background))
    .map((preset) => ({ ...preset, background: normalizeTextBackground(preset.background) }));
};

export const deleteBackgroundPreset = async (id: string): Promise<void> => {
  await runRequest('readwrite', (store) => store.delete(id), PRESETS_STORE);
};
