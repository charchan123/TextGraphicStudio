import type { BackgroundPreset, ProjectDocument } from '@/src/types/editor';
import { isFillStyle, isPartialTextStyle, isTextBackground } from '@/src/services/styleValidation';

const DATABASE_NAME = 'text-graphic-studio';
const STORE_NAME = 'projects';
const AUTOSAVE_KEY = 'autosave';
const PRESETS_STORE = 'background-presets';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const isProjectDocument = (value: unknown): value is ProjectDocument => {
  if (!isRecord(value)) return false;
  if (value.kind !== 'text-graphic-studio-project' || value.schemaVersion !== 1) return false;
  if (!isRecord(value.canvas) || !Array.isArray(value.objects)) return false;
  return (
    typeof value.canvas.width === 'number' &&
    typeof value.canvas.height === 'number' &&
    typeof value.canvas.guidesVisible === 'boolean' &&
    typeof value.updatedAt === 'string' &&
    value.objects.every((object) =>
      isRecord(object) &&
      object.kind === 'graphic-text' &&
      typeof object.id === 'string' &&
      typeof object.text === 'string' && isTextBackground(object.background) && isFillStyle(object.fill) &&
      Array.isArray(object.partialStyles) && object.partialStyles.every(isPartialTextStyle),
    )
  );
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

export const saveAutosave = async (project: ProjectDocument): Promise<void> => {
  await runRequest('readwrite', (store) => store.put(project, AUTOSAVE_KEY));
};

export const loadAutosave = async (): Promise<ProjectDocument | null> => {
  const value = await runRequest<unknown>('readonly', (store) => store.get(AUTOSAVE_KEY));
  return isProjectDocument(value) ? value : null;
};

export const clearAutosave = async (): Promise<void> => {
  await runRequest('readwrite', (store) => store.delete(AUTOSAVE_KEY));
};

export const saveBackgroundPreset = async (preset: BackgroundPreset): Promise<void> => {
  await runRequest('readwrite', (store) => store.put(preset), PRESETS_STORE);
};

export const listBackgroundPresets = async (): Promise<BackgroundPreset[]> => {
  const presets = await runRequest<BackgroundPreset[]>('readonly', (store) => store.getAll(), PRESETS_STORE);
  return presets.filter((preset) => isRecord(preset) && typeof preset.id === 'string' && typeof preset.name === 'string' && isTextBackground(preset.background));
};

export const deleteBackgroundPreset = async (id: string): Promise<void> => {
  await runRequest('readwrite', (store) => store.delete(id), PRESETS_STORE);
};
