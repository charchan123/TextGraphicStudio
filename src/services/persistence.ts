import type { ProjectDocument } from '@/src/types/editor';

const DATABASE_NAME = 'text-graphic-studio';
const STORE_NAME = 'projects';
const AUTOSAVE_KEY = 'autosave';

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
      typeof object.text === 'string',
    )
  );
};

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('データベースを開けませんでした。'));
  });

const runRequest = <T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
  openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const request = operation(transaction.objectStore(STORE_NAME));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('保存処理に失敗しました。'));
        transaction.oncomplete = () => database.close();
        transaction.onerror = () => {
          database.close();
          reject(transaction.error ?? new Error('保存処理に失敗しました。'));
        };
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
