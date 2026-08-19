/**
 * IndexedDB Local Store for Anonymous Users
 * 
 * When a user is not logged in, write operations (investigations, watchlists,
 * saved articles, verified items) are persisted in the browser's IndexedDB.
 * This gives anonymous users a full experience without touching the server DB.
 * 
 * When they later register/login, data can be synced to the cloud.
 */

const DB_NAME = 'redroom_local';
const DB_VERSION = 1;

// Store names
export const STORES = {
  INVESTIGATIONS: 'investigations',
  WATCHLIST: 'watchlist',
  SAVED_ARTICLES: 'saved_articles',
  VERIFIED_ITEMS: 'verified_items',
  NOTES: 'notes',
  PREFERENCES: 'preferences',
} as const;

type StoreName = typeof STORES[keyof typeof STORES];

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.INVESTIGATIONS)) {
        db.createObjectStore(STORES.INVESTIGATIONS, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORES.WATCHLIST)) {
        db.createObjectStore(STORES.WATCHLIST, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORES.SAVED_ARTICLES)) {
        db.createObjectStore(STORES.SAVED_ARTICLES, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORES.VERIFIED_ITEMS)) {
        db.createObjectStore(STORES.VERIFIED_ITEMS, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORES.NOTES)) {
        db.createObjectStore(STORES.NOTES, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORES.PREFERENCES)) {
        db.createObjectStore(STORES.PREFERENCES, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };
  });
}

// Generic CRUD operations
export async function localPut<T extends Record<string, unknown>>(store: StoreName, item: T): Promise<T & { id: number }> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const objectStore = tx.objectStore(store);
    const record = { ...item, updatedAt: Date.now() };
    const request = objectStore.put(record);
    request.onsuccess = () => {
      resolve({ ...record, id: request.result as number } as T & { id: number });
    };
    request.onerror = () => reject(new Error('Failed to put item'));
  });
}

export async function localGet<T>(store: StoreName, id: number): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const objectStore = tx.objectStore(store);
    const request = objectStore.get(id);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(new Error('Failed to get item'));
  });
}

export async function localGetAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const objectStore = tx.objectStore(store);
    const request = objectStore.getAll();
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(new Error('Failed to get all items'));
  });
}

export async function localDelete(store: StoreName, id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const objectStore = tx.objectStore(store);
    const request = objectStore.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to delete item'));
  });
}

export async function localClear(store: StoreName): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const objectStore = tx.objectStore(store);
    const request = objectStore.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to clear store'));
  });
}

export async function localCount(store: StoreName): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const objectStore = tx.objectStore(store);
    const request = objectStore.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Failed to count items'));
  });
}

// Get all data for sync to cloud on registration
export async function getAllLocalData(): Promise<Record<StoreName, unknown[]>> {
  const result: Record<string, unknown[]> = {};
  for (const store of Object.values(STORES)) {
    if (store === 'preferences') continue;
    result[store] = await localGetAll(store);
  }
  return result as Record<StoreName, unknown[]>;
}

// Clear all local data after successful sync
export async function clearAllLocalData(): Promise<void> {
  for (const store of Object.values(STORES)) {
    await localClear(store);
  }
}

// Preference helpers
export async function getPreference(key: string): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PREFERENCES, 'readonly');
    const objectStore = tx.objectStore(STORES.PREFERENCES);
    const request = objectStore.get(key);
    request.onsuccess = () => resolve(request.result?.value ?? null);
    request.onerror = () => reject(new Error('Failed to get preference'));
  });
}

export async function setPreference(key: string, value: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PREFERENCES, 'readwrite');
    const objectStore = tx.objectStore(STORES.PREFERENCES);
    const request = objectStore.put({ key, value, updatedAt: Date.now() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to set preference'));
  });
}
