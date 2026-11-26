import {
  User,
  createUserWithEmailAndPassword,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  Unsubscribe,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import {
  OperationType,
  auth,
  buildFirestoreErrorInfo,
  db,
  googleProvider,
  handleFirestoreError,
} from '../lib/firebase';
import {
  AreaNote,
  Chamber,
  Doctor,
  FirebaseUserProfile,
  Hospital,
  MPOUser,
  TeamSession,
} from '../types';

const FIREBASE_PROFILE_CACHE_KEY = 'mfa_di_firebase_user_profile';

function clampString(val: unknown, maxLen: number): string {
  return String(val ?? '').trim().slice(0, maxLen);
}

function sanitizeDocId(raw: string, fallbackPrefix: string): string {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
  if (cleaned.length >= 2) return cleaned;
  return `${fallbackPrefix}-${Date.now().toString(36)}`;
}

export function buildAreaIdSlug(
  district: string,
  upazila: string,
  areaName: string,
  customAreaId?: string
): string {
  const custom = clampString(customAreaId, 60)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (custom.length >= 3) {
    return custom.slice(0, 60);
  }
  const combined = [district, upazila, areaName]
    .map((p) => clampString(p, 40).toLowerCase())
    .filter(Boolean)
    .join('-');
  const slug = combined
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return slug.length >= 3 ? slug : `area-${Date.now().toString(36)}`;
}

export function getCachedFirebaseProfile(uid?: string | null): FirebaseUserProfile | null {
  try {
    const raw = localStorage.getItem(FIREBASE_PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FirebaseUserProfile>;
    if (!parsed || !parsed.uid || !parsed.areaId) return null;
    if (uid && parsed.uid !== uid) return null;
    return {
      uid: String(parsed.uid),
      email: String(parsed.email || ''),
      officerName: String(parsed.officerName || 'Field Officer'),
      role: String(parsed.role || 'MPO'),
      employeeCode: parsed.employeeCode ? String(parsed.employeeCode) : undefined,
      phone: parsed.phone ? String(parsed.phone) : undefined,
      areaId: String(parsed.areaId),
      areaName: String(parsed.areaName || parsed.areaId),
      district: String(parsed.district || ''),
      upazila: String(parsed.upazila || ''),
      createdAt: String(parsed.createdAt || new Date().toISOString()),
      updatedAt: String(parsed.updatedAt || new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

export function saveCachedFirebaseProfile(profile: FirebaseUserProfile): void {
  try {
    localStorage.setItem(FIREBASE_PROFILE_CACHE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearCachedFirebaseProfile(): void {
  try {
    localStorage.removeItem(FIREBASE_PROFILE_CACHE_KEY);
  } catch {
    // Ignore
  }
}

export function profileToTeamSession(profile: FirebaseUserProfile): TeamSession {
  return {
    loginMode: 'firebase',
    uid: profile.uid,
    email: profile.email,
    areaId: profile.areaId,
    areaName: profile.areaName,
    district: profile.district,
    upazila: profile.upazila,
    zone: profile.upazila || profile.district,
    mpoId: profile.uid,
    mpoName: profile.officerName,
    role: profile.role || 'MPO',
    employeeCode: profile.employeeCode,
    canSwitchAreas: false,
    loggedInAt: profile.updatedAt || new Date().toISOString(),
  };
}

export function formatFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  const msg = error instanceof Error ? error.message : String(error ?? '');

  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Incorrect email or password. Please check your credentials and try again.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'An account with this email already exists. Switch to Sign In instead.';
  }
  if (code === 'auth/weak-password') {
    return 'Password must be at least 6 characters long.';
  }
  if (code === 'auth/invalid-email') {
    return 'Please enter a valid email address.';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Google Sign-In was cancelled before completion.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'Add this app domain to Firebase Console → Authentication → Settings → Authorized domains to enable Google Sign-In.';
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return 'An account already exists with this email using a different sign-in method.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'This sign-in provider is not enabled yet in Firebase Console (Authentication → Sign-in method).';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network unavailable. Connect to the internet once to sign in—afterward your session works offline.';
  }
  if (msg.toLowerCase().includes('missing or insufficient permissions')) {
    return 'Firestore permission denied. Publish the firestore.rules file in your Firebase Console to allow area-scoped Team access.';
  }
  return msg || 'Authentication failed. Please try again.';
}

export interface TeamRegistrationInput {
  email: string;
  password: string;
  officerName: string;
  role?: string;
  phone?: string;
  employeeCode?: string;
  district: string;
  upazila: string;
  areaName: string;
  customAreaId?: string;
}

export async function saveUserAndAreaDocs(
  user: User,
  input: Omit<TeamRegistrationInput, 'email' | 'password'>
): Promise<FirebaseUserProfile> {
  const now = new Date().toISOString();
  const officerName = clampString(input.officerName, 120) || user.displayName || 'Field Officer';
  const role = clampString(input.role || 'MPO', 60);
  const district = clampString(input.district, 80);
  const upazila = clampString(input.upazila, 80);
  const areaName = clampString(input.areaName, 120);
  const phone = clampString(input.phone, 40);
  const employeeCode = clampString(input.employeeCode, 40);
  const areaId = buildAreaIdSlug(district, upazila, areaName, input.customAreaId);

  const profile: FirebaseUserProfile = {
    uid: user.uid,
    email: clampString(user.email, 160),
    officerName,
    role,
    ...(employeeCode ? { employeeCode } : {}),
    ...(phone ? { phone } : {}),
    areaId,
    areaName,
    district,
    upazila,
    createdAt: now,
    updatedAt: now,
  };

  // 1. Write users/{uid} FIRST so Firestore security rules immediately verify user's areaId membership
  const userPath = `users/${user.uid}`;
  try {
    await setDoc(doc(db, 'users', user.uid), profile, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  // 2. Create or update areas/{areaId}
  const areaPath = `areas/${areaId}`;
  try {
    await setDoc(
      doc(db, 'areas', areaId),
      {
        areaId,
        areaName,
        district,
        upazila,
        updatedBy: user.uid,
        updatedAt: now,
        createdAt: now,
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, areaPath);
  }

  // 3. Add officer into areas/{areaId}/members/{uid} so teammates appear in Team Directory
  const memberPath = `areas/${areaId}/members/${user.uid}`;
  try {
    const memberDoc: MPOUser & { updatedAt: string; updatedBy: string } = {
      MPO_ID: user.uid,
      MPO_Name: officerName,
      Role: role,
      Designation: role,
      Employee_ID: employeeCode,
      Employee_Code: employeeCode,
      Area_ID: areaId,
      Area: areaName,
      Territory: [district, upazila].filter(Boolean).join(' · '),
      Phone_Number: phone,
      Phone: phone,
      Email: clampString(user.email, 160),
      Status: 'Active',
      updatedAt: now,
      updatedBy: user.uid,
    };
    await setDoc(doc(db, 'areas', areaId, 'members', user.uid), memberDoc, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, memberPath);
  }

  saveCachedFirebaseProfile(profile);
  return profile;
}

export async function registerTeamUserWithFirebase(
  input: TeamRegistrationInput
): Promise<FirebaseUserProfile> {
  const email = clampString(input.email, 160).toLowerCase();
  const password = input.password;
  const officerName = clampString(input.officerName, 120);

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (officerName) {
    try {
      await updateProfile(cred.user, { displayName: officerName });
    } catch {
      // Non-fatal display name update failure
    }
  }

  return saveUserAndAreaDocs(cred.user, input);
}

export async function signInTeamUserWithFirebase(
  emailInput: string,
  password: string
): Promise<{ user: User; profile: FirebaseUserProfile | null }> {
  const email = clampString(emailInput, 160).toLowerCase();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const profile = await fetchUserProfileFromFirestore(cred.user.uid);
  return { user: cred.user, profile };
}

function shouldFallbackToRedirect(error: unknown): boolean {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  return (
    code === 'auth/popup-blocked' ||
    code === 'auth/operation-not-supported-in-this-environment' ||
    code === 'auth/internal-error'
  );
}

function isStandaloneMobileOrTWA(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  const isWebView = /\bwv\b|Android.*Version\/[\d.]+/i.test(ua);
  return Boolean(isWebView || (isStandalone && /Android|iPhone|iPad/i.test(ua)));
}

export async function signInTeamWithGoogle(): Promise<
  | { redirected: true; user: null; profile: null }
  | { redirected: false; user: User; profile: FirebaseUserProfile | null }
> {
  if (isStandaloneMobileOrTWA()) {
    await signInWithRedirect(auth, googleProvider);
    return { redirected: true, user: null, profile: null };
  }

  try {
    const cred = await signInWithPopup(auth, googleProvider);
    const profile = await fetchUserProfileFromFirestore(cred.user.uid);
    return { redirected: false, user: cred.user, profile };
  } catch (error) {
    if (shouldFallbackToRedirect(error)) {
      await signInWithRedirect(auth, googleProvider);
      return { redirected: true, user: null, profile: null };
    }
    throw error;
  }
}

export async function resolveGoogleRedirectResult(): Promise<{
  user: User;
  profile: FirebaseUserProfile | null;
} | null> {
  try {
    const result = await getRedirectResult(auth);
    if (!result?.user) return null;
    const profile = await fetchUserProfileFromFirestore(result.user.uid);
    return { user: result.user, profile };
  } catch (error) {
    console.warn('Google redirect sign-in check:', formatFirebaseAuthError(error));
    return null;
  }
}

export async function signOutTeamUserFromFirebase(): Promise<void> {
  clearCachedFirebaseProfile();
  await signOut(auth);
}

export async function fetchUserProfileFromFirestore(
  uid: string
): Promise<FirebaseUserProfile | null> {
  const userPath = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const data = snap.data() as Partial<FirebaseUserProfile>;
    if (!data.areaId) return null;
    const profile: FirebaseUserProfile = {
      uid,
      email: String(data.email || auth.currentUser?.email || ''),
      officerName: String(data.officerName || auth.currentUser?.displayName || 'Field Officer'),
      role: String(data.role || 'MPO'),
      employeeCode: data.employeeCode ? String(data.employeeCode) : undefined,
      phone: data.phone ? String(data.phone) : undefined,
      areaId: String(data.areaId),
      areaName: String(data.areaName || data.areaId),
      district: String(data.district || ''),
      upazila: String(data.upazila || ''),
      createdAt: String(data.createdAt || new Date().toISOString()),
      updatedAt: String(data.updatedAt || new Date().toISOString()),
    };
    saveCachedFirebaseProfile(profile);
    return profile;
  } catch (error) {
    const cached = getCachedFirebaseProfile(uid);
    if (cached) return cached;
    console.error('Firestore Error: ', JSON.stringify(buildFirestoreErrorInfo(error, OperationType.GET, userPath)));
    return null;
  }
}

export interface AreaWorkspaceCallbacks {
  onDoctors: (rows: Doctor[]) => void;
  onChambers: (rows: Chamber[]) => void;
  onHospitals: (rows: Hospital[]) => void;
  onMembers: (rows: MPOUser[]) => void;
  onNotes: (rows: AreaNote[]) => void;
  onError?: (message: string) => void;
}

export function subscribeToAreaWorkspace(
  areaId: string,
  callbacks: AreaWorkspaceCallbacks
): Unsubscribe {
  const unsubscribers: Unsubscribe[] = [];

  const reportError = (error: unknown, path: string) => {
    const info = buildFirestoreErrorInfo(error, OperationType.LIST, path);
    console.error('Firestore Error: ', JSON.stringify(info));
    if (callbacks.onError) {
      callbacks.onError(formatFirebaseAuthError(error));
    }
  };

  const doctorsPath = `areas/${areaId}/doctors`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'areas', areaId, 'doctors'),
      (snap) => {
        const list: Doctor[] = snap.docs.map((d) => {
          const data = d.data() as Partial<Doctor>;
          return {
            Doctor_ID: String(data.Doctor_ID || d.id),
            Doctor_Name: String(data.Doctor_Name || ''),
            Degree: String(data.Degree || ''),
            Specialty: String(data.Specialty || ''),
            Department_ID: String(data.Department_ID || ''),
            Primary_Hospital_ID: String(data.Primary_Hospital_ID || ''),
            Area_ID: areaId,
            Phone: data.Phone ? String(data.Phone) : '',
            Email: data.Email ? String(data.Email) : '',
            Category: data.Category ? String(data.Category) : '',
            Doctor_Type: data.Doctor_Type ? String(data.Doctor_Type) : 'Regular',
            Visiting_Days: data.Visiting_Days ? String(data.Visiting_Days) : '',
            Visiting_Hours: data.Visiting_Hours ? String(data.Visiting_Hours) : '',
            Remarks: data.Remarks ? String(data.Remarks) : '',
            Status: data.Status ? String(data.Status) : 'Active',
          };
        });
        callbacks.onDoctors(list);
      },
      (err) => reportError(err, doctorsPath)
    )
  );

  const chambersPath = `areas/${areaId}/chambers`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'areas', areaId, 'chambers'),
      (snap) => {
        const list: Chamber[] = snap.docs.map((d) => {
          const data = d.data() as Partial<Chamber>;
          return {
            Chamber_ID: String(data.Chamber_ID || d.id),
            Doctor_ID: String(data.Doctor_ID || ''),
            Chamber_Name: String(data.Chamber_Name || ''),
            Address: String(data.Address || ''),
            Area_ID: areaId,
            Visiting_Days: String(data.Visiting_Days || ''),
            Visiting_Hours: String(data.Visiting_Hours || ''),
            Assistant_Phone: data.Assistant_Phone ? String(data.Assistant_Phone) : '',
            Status: data.Status ? String(data.Status) : 'Active',
          };
        });
        callbacks.onChambers(list);
      },
      (err) => reportError(err, chambersPath)
    )
  );

  const hospitalsPath = `areas/${areaId}/hospitals`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'areas', areaId, 'hospitals'),
      (snap) => {
        const list: Hospital[] = snap.docs.map((d) => {
          const data = d.data() as Partial<Hospital>;
          return {
            Hospital_ID: String(data.Hospital_ID || d.id),
            Hospital_Name: String(data.Hospital_Name || ''),
            Area_ID: areaId,
            Hospital_Type: data.Hospital_Type ? String(data.Hospital_Type) : '',
            Address: data.Address ? String(data.Address) : '',
            Phone: data.Phone ? String(data.Phone) : '',
            Status: data.Status ? String(data.Status) : 'Active',
          };
        });
        callbacks.onHospitals(list);
      },
      (err) => reportError(err, hospitalsPath)
    )
  );

  const membersPath = `areas/${areaId}/members`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'areas', areaId, 'members'),
      (snap) => {
        const list: MPOUser[] = snap.docs.map((d) => {
          const data = d.data() as Partial<MPOUser>;
          return {
            MPO_ID: String(data.MPO_ID || d.id),
            MPO_Name: String(data.MPO_Name || ''),
            Role: String(data.Role || data.Designation || 'MPO'),
            Designation: String(data.Designation || data.Role || 'MPO'),
            Employee_ID: String(data.Employee_ID || data.Employee_Code || ''),
            Employee_Code: String(data.Employee_Code || data.Employee_ID || ''),
            Area_ID: areaId,
            Area: String(data.Area || ''),
            Territory: String(data.Territory || ''),
            Phone_Number: String(data.Phone_Number || data.Phone || ''),
            Phone: String(data.Phone || data.Phone_Number || ''),
            Email: String(data.Email || ''),
            Status: String(data.Status || 'Active'),
          };
        });
        callbacks.onMembers(list);
      },
      (err) => reportError(err, membersPath)
    )
  );

  const notesPath = `areas/${areaId}/notes`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'areas', areaId, 'notes'),
      (snap) => {
        const list: AreaNote[] = snap.docs
          .map((d) => {
            const data = d.data() as Partial<AreaNote>;
            return {
              Note_ID: String(data.Note_ID || d.id),
              Area_ID: areaId,
              Title: String(data.Title || ''),
              Content: String(data.Content || ''),
              Category: data.Category ? String(data.Category) : 'General',
              Pinned: Boolean(data.Pinned),
              Author_Name: data.Author_Name ? String(data.Author_Name) : '',
              Author_UID: data.Author_UID ? String(data.Author_UID) : '',
              Created_At: String(data.Created_At || new Date().toISOString()),
              Updated_At: String(data.Updated_At || new Date().toISOString()),
            };
          })
          .sort((a, b) => {
            if (Boolean(a.Pinned) !== Boolean(b.Pinned)) {
              return a.Pinned ? -1 : 1;
            }
            return b.Updated_At.localeCompare(a.Updated_At);
          });
        callbacks.onNotes(list);
      },
      (err) => reportError(err, notesPath)
    )
  );

  return () => {
    unsubscribers.forEach((unsub) => {
      try {
        unsub();
      } catch {
        // Ignore cleanup errors
      }
    });
  };
}

// ============================================================================
// AREA-SCOPED FIRESTORE CRUD MUTATIONS (Strict payload sanitization + offline-safe)
// ============================================================================

async function commitFirestoreMutation(
  opPromise: Promise<void>,
  operationType: OperationType,
  path: string
): Promise<void> {
  // With persistentLocalCache(), Firestore writes to IndexedDB immediately and updates
  // onSnapshot listeners right away, while the Promise itself waits for server ACK.
  // When offline (or if connectivity stalls), resolve cleanly so UI never freezes.
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    opPromise.catch((error) => {
      console.error(
        'Offline Firestore sync error: ',
        JSON.stringify(buildFirestoreErrorInfo(error, operationType, path))
      );
    });
    return;
  }

  let timerId: number | null = null;
  try {
    await Promise.race([
      opPromise.catch((error) => {
        handleFirestoreError(error, operationType, path);
      }),
      new Promise<void>((resolve) => {
        timerId = window.setTimeout(() => resolve(), 5000);
      }),
    ]);
  } finally {
    if (timerId !== null) {
      window.clearTimeout(timerId);
    }
  }
}

export async function saveAreaDoctor(
  areaId: string,
  data: Record<string, unknown>,
  uid: string
): Promise<void> {
  const docId = sanitizeDocId(String(data.Doctor_ID || ''), 'DOC');
  const path = `areas/${areaId}/doctors/${docId}`;
  const now = new Date().toISOString();
  const payload = {
    Doctor_ID: docId,
    Doctor_Name: clampString(data.Doctor_Name, 160),
    Degree: clampString(data.Degree, 160),
    Specialty: clampString(data.Specialty, 120),
    Department_ID: clampString(data.Department_ID, 80),
    Primary_Hospital_ID: clampString(data.Primary_Hospital_ID, 80),
    Area_ID: areaId,
    Phone: clampString(data.Phone, 40),
    Email: clampString(data.Email, 160),
    Category: clampString(data.Category, 40),
    Doctor_Type: clampString(data.Doctor_Type || 'Regular', 30),
    Visiting_Days: clampString(data.Visiting_Days, 120),
    Visiting_Hours: clampString(data.Visiting_Hours, 120),
    Remarks: clampString(data.Remarks, 1500),
    Status: clampString(data.Status || 'Active', 20),
    updatedAt: now,
    updatedBy: uid,
  };
  await commitFirestoreMutation(
    setDoc(doc(db, 'areas', areaId, 'doctors', docId), payload, { merge: true }),
    OperationType.WRITE,
    path
  );
}

export async function deleteAreaDoctor(areaId: string, doctorId: string): Promise<void> {
  const docId = sanitizeDocId(doctorId, 'DOC');
  const path = `areas/${areaId}/doctors/${docId}`;
  await commitFirestoreMutation(
    deleteDoc(doc(db, 'areas', areaId, 'doctors', docId)),
    OperationType.DELETE,
    path
  );
}

export async function saveAreaChamber(
  areaId: string,
  data: Record<string, unknown>,
  uid: string
): Promise<void> {
  const docId = sanitizeDocId(String(data.Chamber_ID || ''), 'CHM');
  const path = `areas/${areaId}/chambers/${docId}`;
  const now = new Date().toISOString();
  const payload = {
    Chamber_ID: docId,
    Doctor_ID: clampString(data.Doctor_ID, 80),
    Chamber_Name: clampString(data.Chamber_Name, 160),
    Address: clampString(data.Address, 300),
    Area_ID: areaId,
    Visiting_Days: clampString(data.Visiting_Days, 120),
    Visiting_Hours: clampString(data.Visiting_Hours, 120),
    Assistant_Phone: clampString(data.Assistant_Phone, 40),
    Status: clampString(data.Status || 'Active', 20),
    updatedAt: now,
    updatedBy: uid,
  };
  await commitFirestoreMutation(
    setDoc(doc(db, 'areas', areaId, 'chambers', docId), payload, { merge: true }),
    OperationType.WRITE,
    path
  );
}

export async function deleteAreaChamber(areaId: string, chamberId: string): Promise<void> {
  const docId = sanitizeDocId(chamberId, 'CHM');
  const path = `areas/${areaId}/chambers/${docId}`;
  await commitFirestoreMutation(
    deleteDoc(doc(db, 'areas', areaId, 'chambers', docId)),
    OperationType.DELETE,
    path
  );
}

export async function saveAreaHospital(
  areaId: string,
  data: Record<string, unknown>,
  uid: string
): Promise<void> {
  const docId = sanitizeDocId(String(data.Hospital_ID || ''), 'HSP');
  const path = `areas/${areaId}/hospitals/${docId}`;
  const now = new Date().toISOString();
  const payload = {
    Hospital_ID: docId,
    Hospital_Name: clampString(data.Hospital_Name, 180),
    Area_ID: areaId,
    Hospital_Type: clampString(data.Hospital_Type, 80),
    Address: clampString(data.Address, 300),
    Phone: clampString(data.Phone, 40),
    Status: clampString(data.Status || 'Active', 20),
    updatedAt: now,
    updatedBy: uid,
  };
  await commitFirestoreMutation(
    setDoc(doc(db, 'areas', areaId, 'hospitals', docId), payload, { merge: true }),
    OperationType.WRITE,
    path
  );
}

export async function deleteAreaHospital(areaId: string, hospitalId: string): Promise<void> {
  const docId = sanitizeDocId(hospitalId, 'HSP');
  const path = `areas/${areaId}/hospitals/${docId}`;
  await commitFirestoreMutation(
    deleteDoc(doc(db, 'areas', areaId, 'hospitals', docId)),
    OperationType.DELETE,
    path
  );
}

export async function saveAreaMember(
  areaId: string,
  data: Record<string, unknown>,
  uid: string
): Promise<void> {
  const docId = sanitizeDocId(String(data.MPO_ID || ''), 'MPO');
  const path = `areas/${areaId}/members/${docId}`;
  const now = new Date().toISOString();
  const role = clampString(data.Role || data.Designation || 'MPO', 60);
  const phone = clampString(data.Phone_Number || data.Phone, 40);
  const empId = clampString(data.Employee_ID || data.Employee_Code, 40);
  const payload = {
    MPO_ID: docId,
    MPO_Name: clampString(data.MPO_Name, 120),
    Role: role,
    Designation: role,
    Employee_ID: empId,
    Employee_Code: empId,
    Area_ID: areaId,
    Area: clampString(data.Area, 120),
    Territory: clampString(data.Territory, 120),
    Phone_Number: phone,
    Phone: phone,
    Email: clampString(data.Email, 160),
    Status: clampString(data.Status || 'Active', 20),
    updatedAt: now,
    updatedBy: uid,
  };
  await commitFirestoreMutation(
    setDoc(doc(db, 'areas', areaId, 'members', docId), payload, { merge: true }),
    OperationType.WRITE,
    path
  );
}

export async function deleteAreaMember(areaId: string, memberId: string): Promise<void> {
  const docId = sanitizeDocId(memberId, 'MPO');
  const path = `areas/${areaId}/members/${docId}`;
  await commitFirestoreMutation(
    deleteDoc(doc(db, 'areas', areaId, 'members', docId)),
    OperationType.DELETE,
    path
  );
}

export async function saveAreaNote(
  areaId: string,
  note: {
    Note_ID?: string;
    Title: string;
    Content: string;
    Category?: string;
    Pinned?: boolean;
    Created_At?: string;
  },
  author: { uid: string; name: string }
): Promise<void> {
  const docId = sanitizeDocId(note.Note_ID || '', 'NOTE');
  const path = `areas/${areaId}/notes/${docId}`;
  const now = new Date().toISOString();
  const payload: AreaNote = {
    Note_ID: docId,
    Area_ID: areaId,
    Title: clampString(note.Title, 140),
    Content: clampString(note.Content, 3000),
    Category: clampString(note.Category || 'General', 40),
    Pinned: Boolean(note.Pinned),
    Author_Name: clampString(author.name, 120),
    Author_UID: author.uid,
    Created_At: note.Created_At || now,
    Updated_At: now,
  };
  await commitFirestoreMutation(
    setDoc(doc(db, 'areas', areaId, 'notes', docId), payload, { merge: true }),
    OperationType.WRITE,
    path
  );
}

export async function deleteAreaNote(areaId: string, noteId: string): Promise<void> {
  const docId = sanitizeDocId(noteId, 'NOTE');
  const path = `areas/${areaId}/notes/${docId}`;
  await commitFirestoreMutation(
    deleteDoc(doc(db, 'areas', areaId, 'notes', docId)),
    OperationType.DELETE,
    path
  );
}
