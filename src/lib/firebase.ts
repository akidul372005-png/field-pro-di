import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  Auth,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
} from 'firebase/firestore';

function resolveAuthDomain(): string {
  if (typeof window === 'undefined') {
    return 'field-pro-di.firebaseapp.com';
  }
  const host = window.location.hostname;
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.run.app')
  ) {
    return 'field-pro-di.firebaseapp.com';
  }
  return host;
}

export const firebaseConfig = {
  apiKey: 'AIzaSyCdzK_xpGPo6iDu2z3HemGe-WKEXL5Qlvk',
  authDomain: resolveAuthDomain(),
  projectId: 'field-pro-di',
  storageBucket: 'field-pro-di.firebasestorage.app',
  messagingSenderId: '464919706082',
  appId: '1:464919706082:web:408be442f01b2bd93661bb',
  measurementId: 'G-618ZWG399J',
};

export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Keep signed-in Team users logged in offline across app restarts
if (typeof window !== 'undefined') {
  void setPersistence(auth, browserLocalPersistence).catch(() => {
    // Fallback gracefully in restricted browser contexts
  });
}

// Initialize Cloud Firestore with multi-tab IndexedDB offline persistence
// and auto-detected long polling so connections stay reliable inside iframes & mobile networks
function createPersistentFirestore(firebaseApp: FirebaseApp): Firestore {
  if (typeof window === 'undefined') {
    return getFirestore(firebaseApp);
  }
  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
      experimentalAutoDetectLongPolling: true,
    });
  } catch {
    // If already initialized (e.g., hot reload) or IndexedDB unavailable, reuse existing instance
    return getFirestore(firebaseApp);
  }
}

export const db: Firestore = createPersistentFirestore(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function buildFirestoreErrorInfo(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  return {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo = buildFirestoreErrorInfo(error, operationType, path);
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    const code = (error as { code?: string } | null)?.code ?? '';
    // permission-denied proves Firestore server is reachable
    if (code === 'permission-denied') return true;
    return false;
  }
}
