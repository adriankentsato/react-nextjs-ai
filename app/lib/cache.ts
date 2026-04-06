const DB_NAME = 'api-cache-db';
const STORE_NAME = 'cache-store';
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

let db: IDBDatabase | null = null;

interface CacheEntry<T> {
  key: string;
  data: T;
  timestamp: number;
  ttl: number;
}

async function openDb(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = event => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
  });
}

export async function setCache<T>(
  key: string,
  data: T,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<void> {
  const database = await openDb();
  const entry: CacheEntry<T> = {
    key,
    data,
    timestamp: Date.now(),
    ttl: ttlMs,
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(entry);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getCache<T>(key: string): Promise<T | null> {
  const database = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => {
      const entry = request.result as CacheEntry<T> | undefined;

      if (!entry) {
        resolve(null);
        return;
      }

      const isExpired = Date.now() - entry.timestamp > entry.ttl;
      if (isExpired) {
        deleteCache(key);
        resolve(null);
        return;
      }

      resolve(entry.data);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function deleteCache(key: string): Promise<void> {
  const database = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearCache(): Promise<void> {
  const database = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
