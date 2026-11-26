import { FieldDataset } from '../types';

const DB_NAME = 'field_pro_di_cache_v1';
const STORE_NAME = 'kv';
const DB_VERSION = 1;

const LEGACY_LS_KEY = 'dil_field_pro_dataset_v1';

const DATASET_PARTS = [
  'products',
  'detailing',
  'indications',
  'departments',
  'mpoDesk',
  'medicalKnowledge',
  'meta',
] as const;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openCacheDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const db = await openCacheDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  const db = await openCacheDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Persists all large datasets asynchronously in IndexedDB (structured clone, zero main-thread JSON lock)
 * and removes any bloated legacy localStorage cache entry so startup stays <100ms on Android.
 */
export async function saveDatasetToIndexedDB(dataset: FieldDataset): Promise<void> {
  const db = await openCacheDb();
  if (!db) return;

  const meta = {
    Areas: dataset.Areas,
    Hospitals: dataset.Hospitals,
    Doctors: dataset.Doctors,
    Chambers: dataset.Chambers,
    Doctor_Visits: dataset.Doctor_Visits,
    MPO_Users: dataset.MPO_Users,
    Daily_Activities: dataset.Daily_Activities,
  };

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(dataset.Products, 'products');
      store.put(dataset.Doctor_Product_Detailing, 'detailing');
      store.put(dataset.Indications, 'indications');
      store.put(dataset.Departments, 'departments');
      store.put(dataset.MPO_Desk, 'mpoDesk');
      store.put(dataset.Medical_Knowledge, 'medicalKnowledge');
      store.put(meta, 'meta');
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });

  // Clean up bloated synchronous localStorage copy once stored in IndexedDB
  try {
    if (localStorage.getItem(LEGACY_LS_KEY)) {
      localStorage.removeItem(LEGACY_LS_KEY);
    }
  } catch {
    // Ignore storage access errors
  }
}

/**
 * Loads large datasets asynchronously from IndexedDB in a single read transaction.
 * Falls back to one-time migration if a legacy localStorage snapshot exists.
 */
export async function loadDatasetFromIndexedDB(): Promise<Partial<FieldDataset> | null> {
  const db = await openCacheDb();
  if (db) {
    const parts = await new Promise<Record<string, unknown> | null>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const result: Record<string, unknown> = {};
        let foundAny = false;
        let pending = DATASET_PARTS.length;

        DATASET_PARTS.forEach((key) => {
          const req = store.get(key);
          req.onsuccess = () => {
            if (req.result !== undefined) {
              result[key] = req.result;
              foundAny = true;
            }
            pending -= 1;
            if (pending === 0) resolve(foundAny ? result : null);
          };
          req.onerror = () => {
            pending -= 1;
            if (pending === 0) resolve(foundAny ? result : null);
          };
        });
      } catch {
        resolve(null);
      }
    });

    if (parts) {
      const meta = (parts.meta as Partial<FieldDataset> | undefined) || {};
      return {
        ...meta,
        Products: Array.isArray(parts.products) ? (parts.products as FieldDataset['Products']) : undefined,
        Doctor_Product_Detailing: Array.isArray(parts.detailing)
          ? (parts.detailing as FieldDataset['Doctor_Product_Detailing'])
          : undefined,
        Indications: Array.isArray(parts.indications)
          ? (parts.indications as FieldDataset['Indications'])
          : undefined,
        Departments: Array.isArray(parts.departments)
          ? (parts.departments as FieldDataset['Departments'])
          : undefined,
        MPO_Desk: Array.isArray(parts.mpoDesk) ? (parts.mpoDesk as FieldDataset['MPO_Desk']) : undefined,
        Medical_Knowledge: Array.isArray(parts.medicalKnowledge)
          ? (parts.medicalKnowledge as FieldDataset['Medical_Knowledge'])
          : undefined,
      };
    }
  }

  // One-time async migration from legacy synchronous localStorage snapshot
  try {
    const legacyRaw = localStorage.getItem(LEGACY_LS_KEY);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw) as Partial<FieldDataset>;
      localStorage.removeItem(LEGACY_LS_KEY);
      return parsed;
    }
  } catch {
    // Ignore parse errors
  }

  return null;
}
