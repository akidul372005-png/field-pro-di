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
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  where,
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
  OfficerSearchResult,
  TeamInvite,
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

export function normalizePhoneDigits(raw: string): string {
  return String(raw ?? '').replace(/[^0-9]/g, '').slice(0, 20);
}

/**
 * Generates a short, memorable Team Join Code like "DI-4829" deterministically from an areaId
 * so existing and new areas always have a clean 4-digit shareable code.
 */
export function deriveAreaJoinCode(areaId: string): string {
  const input = String(areaId || 'field-pro-di').trim().toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const num = 1000 + (Math.abs(hash) % 9000);
  return `DI-${num}`;
}

export function normalizeJoinCodeInput(raw: string): string {
  const cleaned = String(raw ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (!cleaned) return '';
  if (/^\d{4}$/.test(cleaned)) return `DI-${cleaned}`;
  if (/^DI\d{4}$/.test(cleaned)) return `DI-${cleaned.slice(2)}`;
  return cleaned;
}

export function getCachedFirebaseProfile(uid?: string | null): FirebaseUserProfile | null {
  try {
    const raw = localStorage.getItem(FIREBASE_PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FirebaseUserProfile>;
    if (!parsed || !parsed.uid || !parsed.areaId) return null;
    if (uid && parsed.uid !== uid) return null;
    const areaId = String(parsed.areaId);
    return {
      uid: String(parsed.uid),
      email: String(parsed.email || ''),
      emailLower: String(parsed.emailLower || parsed.email || '').toLowerCase(),
      officerName: String(parsed.officerName || 'Field Officer'),
      role: String(parsed.role || 'MPO'),
      employeeCode: parsed.employeeCode ? String(parsed.employeeCode) : undefined,
      phone: parsed.phone ? String(parsed.phone) : undefined,
      phoneNormalized: parsed.phoneNormalized
        ? String(parsed.phoneNormalized)
        : parsed.phone
          ? normalizePhoneDigits(String(parsed.phone))
          : undefined,
      areaId,
      areaName: String(parsed.areaName || areaId),
      joinCode: parsed.joinCode ? String(parsed.joinCode) : deriveAreaJoinCode(areaId),
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
    phone: profile.phone,
    areaId: profile.areaId,
    areaName: profile.areaName,
    joinCode: profile.joinCode || deriveAreaJoinCode(profile.areaId),
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
      ? String((error as { code?: unknown }).code ?? '').trim()
      : '';
  const msg = error instanceof Error ? error.message.trim() : String(error ?? '').trim();
  const detail = [code, msg && !msg.includes(code) ? msg : ''].filter(Boolean).join(' — ');
  const withDetail = (friendly: string) =>
    code || msg ? `${friendly} [${detail || code || msg}]` : friendly;

  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return withDetail('Incorrect email or password. Please check your credentials and try again.');
  }
  if (code === 'auth/email-already-in-use') {
    return withDetail('An account with this email already exists. Switch to Sign In instead.');
  }
  if (code === 'auth/weak-password') {
    return withDetail('Password must be at least 6 characters long.');
  }
  if (code === 'auth/invalid-email') {
    return withDetail('Please enter a valid email address.');
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return withDetail('Google Sign-In popup was closed before completion.');
  }
  if (code === 'auth/unauthorized-domain') {
    return withDetail(
      'Add this domain to Firebase Console → Authentication → Settings → Authorized domains.'
    );
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return withDetail('An account already exists with this email using a different sign-in method.');
  }
  if (code === 'auth/operation-not-allowed') {
    return withDetail(
      'This sign-in provider is not enabled in Firebase Console (Authentication → Sign-in method).'
    );
  }
  if (code === 'auth/too-many-requests') {
    return withDetail('Too many attempts. Please wait a moment and try again.');
  }
  if (code === 'auth/network-request-failed') {
    return withDetail(
      'Network unavailable. Connect to the internet once to sign in—afterward your session works offline.'
    );
  }
  if (msg.toLowerCase().includes('missing or insufficient permissions')) {
    return withDetail(
      'Firestore permission denied. Publish firestore.rules in Firebase Console to allow area-scoped Team access.'
    );
  }
  if (code && msg) {
    return msg.includes(code) ? msg : `${code}: ${msg}`;
  }
  return msg || code || 'Authentication failed. Please try again.';
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
  input: Omit<TeamRegistrationInput, 'email' | 'password'> & { joinCode?: string }
): Promise<FirebaseUserProfile> {
  const now = new Date().toISOString();
  const officerName = clampString(input.officerName, 120) || user.displayName || 'Field Officer';
  const role = clampString(input.role || 'MPO', 60);
  const district = clampString(input.district, 80);
  const upazila = clampString(input.upazila, 80);
  const areaName = clampString(input.areaName, 120);
  const phone = clampString(input.phone, 40);
  const phoneNormalized = phone ? normalizePhoneDigits(phone) : '';
  const employeeCode = clampString(input.employeeCode, 40);
  const areaId = buildAreaIdSlug(district, upazila, areaName, input.customAreaId);
  const joinCode = normalizeJoinCodeInput(input.joinCode || '') || deriveAreaJoinCode(areaId);
  const email = clampString(user.email, 160);
  const emailLower = email.toLowerCase();

  const profile: FirebaseUserProfile = {
    uid: user.uid,
    email,
    ...(emailLower ? { emailLower } : {}),
    officerName,
    role,
    ...(employeeCode ? { employeeCode } : {}),
    ...(phone ? { phone, phoneNormalized } : {}),
    areaId,
    areaName,
    joinCode,
    district,
    upazila,
    createdAt: now,
    updatedAt: now,
  };

  // 1. Write users/{uid} FIRST so Firestore security rules immediately verify user's areaId membership
  const userPath = `users/${user.uid}`;
  try {
    await setDoc(doc(db, 'users', user.uid), profile, { merge: true });
    // Cache immediately so concurrent onAuthStateChanged checks never see a null profile
    saveCachedFirebaseProfile(profile);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  // 2. Create or update areas/{areaId} with shareable joinCode
  const areaPath = `areas/${areaId}`;
  try {
    await setDoc(
      doc(db, 'areas', areaId),
      {
        areaId,
        areaName,
        joinCode,
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

  // 2b. Register short Join Code lookup doc joinCodes/{joinCode} (best-effort)
  try {
    await setDoc(
      doc(db, 'joinCodes', joinCode),
      {
        joinCode,
        areaId,
        areaName,
        district,
        upazila,
        updatedBy: user.uid,
        updatedAt: now,
      },
      { merge: true }
    );
  } catch {
    // Non-fatal if joinCodes rules are not yet published
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
      Email: email,
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
  const msg = error instanceof Error ? error.message.toLowerCase() : '';
  return (
    code === 'auth/popup-blocked' ||
    code === 'auth/operation-not-supported-in-this-environment' ||
    code === 'auth/internal-error' ||
    code === 'auth/web-storage-unsupported' ||
    msg.includes('popup') ||
    msg.includes('blocked')
  );
}

/**
 * Always tries signInWithPopup first for immediate sign-in on desktop/mobile/TWA,
 * and falls back automatically to signInWithRedirect if popup is blocked or unsupported.
 */
export async function signInTeamWithGoogle(): Promise<
  | { redirected: true; user: null; profile: null }
  | { redirected: false; user: User; profile: FirebaseUserProfile | null }
> {
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
  user: User | null;
  profile: FirebaseUserProfile | null;
  error?: string;
} | null> {
  try {
    const result = await getRedirectResult(auth);
    if (!result?.user) return null;
    const profile = await fetchUserProfileFromFirestore(result.user.uid);
    return { user: result.user, profile };
  } catch (error) {
    const formatted = formatFirebaseAuthError(error);
    console.warn('Google redirect sign-in error:', formatted);
    return { user: null, profile: null, error: formatted };
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
    const areaId = String(data.areaId);
    const email = String(data.email || auth.currentUser?.email || '');
    const phone = data.phone ? String(data.phone) : undefined;
    const joinCode = data.joinCode ? String(data.joinCode) : deriveAreaJoinCode(areaId);
    const profile: FirebaseUserProfile = {
      uid,
      email,
      emailLower: String(data.emailLower || email).toLowerCase(),
      officerName: String(data.officerName || auth.currentUser?.displayName || 'Field Officer'),
      role: String(data.role || 'MPO'),
      employeeCode: data.employeeCode ? String(data.employeeCode) : undefined,
      phone,
      phoneNormalized: data.phoneNormalized
        ? String(data.phoneNormalized)
        : phone
          ? normalizePhoneDigits(phone)
          : undefined,
      areaId,
      areaName: String(data.areaName || areaId),
      joinCode,
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

// =========================================================================
// REAL TEAM INVITE & JOIN CODE SYSTEM (Firestore `invites` + `joinCodes`)
// =========================================================================

/**
 * Ensures the signed-in officer's area has its shareable Join Code (e.g. DI-4829) registered
 * in `areas/{areaId}` and `joinCodes/{joinCode}`, and that `emailLower`/`phoneNormalized` are indexed.
 */
export async function ensureAreaJoinCodeRegistered(profile: FirebaseUserProfile): Promise<void> {
  const joinCode = profile.joinCode || deriveAreaJoinCode(profile.areaId);
  const now = new Date().toISOString();
  const emailLower = (profile.email || '').trim().toLowerCase();
  const phoneNormalized = profile.phone ? normalizePhoneDigits(profile.phone) : '';

  try {
    await setDoc(
      doc(db, 'users', profile.uid),
      {
        joinCode,
        ...(emailLower ? { emailLower } : {}),
        ...(phoneNormalized ? { phoneNormalized } : {}),
      },
      { merge: true }
    );
  } catch {
    // Non-fatal background sync
  }

  try {
    await setDoc(
      doc(db, 'areas', profile.areaId),
      {
        areaId: profile.areaId,
        areaName: profile.areaName,
        joinCode,
        district: profile.district || '',
        upazila: profile.upazila || '',
        updatedBy: profile.uid,
        updatedAt: now,
      },
      { merge: true }
    );
  } catch {
    // Non-fatal
  }

  try {
    await setDoc(
      doc(db, 'joinCodes', joinCode),
      {
        joinCode,
        areaId: profile.areaId,
        areaName: profile.areaName,
        district: profile.district || '',
        upazila: profile.upazila || '',
        updatedBy: profile.uid,
        updatedAt: now,
      },
      { merge: true }
    );
  } catch {
    // Non-fatal
  }
}

/**
 * Searches registered officers in Firestore `users` collection by exact Email or Phone Number.
 */
export async function searchRegisteredOfficers(
  searchInput: string,
  excludeUid?: string
): Promise<OfficerSearchResult[]> {
  const raw = searchInput.trim();
  if (!raw) return [];

  const lower = raw.toLowerCase();
  const digits = normalizePhoneDigits(raw);
  const isEmailQuery = raw.includes('@');

  const queries = [];
  if (isEmailQuery) {
    queries.push(query(collection(db, 'users'), where('email', '==', raw), limit(8)));
    if (lower !== raw) {
      queries.push(query(collection(db, 'users'), where('email', '==', lower), limit(8)));
    }
    queries.push(query(collection(db, 'users'), where('emailLower', '==', lower), limit(8)));
  } else {
    queries.push(query(collection(db, 'users'), where('phone', '==', raw), limit(8)));
    if (digits.length >= 6) {
      queries.push(query(collection(db, 'users'), where('phoneNormalized', '==', digits), limit(8)));
      if (digits !== raw) {
        queries.push(query(collection(db, 'users'), where('phone', '==', digits), limit(8)));
      }
    }
    // Also allow searching by exact email if someone typed an email without realizing
    queries.push(query(collection(db, 'users'), where('emailLower', '==', lower), limit(5)));
  }

  const found = new Map<string, OfficerSearchResult>();
  let permissionError: unknown = null;

  for (const q of queries) {
    try {
      const snap = await getDocs(q);
      snap.forEach((docSnap) => {
        const d = docSnap.data() as Partial<FirebaseUserProfile>;
        const uid = String(d.uid || docSnap.id);
        if (excludeUid && uid === excludeUid) return;
        if (!found.has(uid)) {
          found.set(uid, {
            uid,
            officerName: String(d.officerName || 'Field Officer'),
            email: String(d.email || ''),
            phone: d.phone ? String(d.phone) : undefined,
            role: d.role ? String(d.role) : 'MPO',
            areaId: String(d.areaId || ''),
            areaName: String(d.areaName || d.areaId || ''),
            district: d.district ? String(d.district) : undefined,
          });
        }
      });
    } catch (err) {
      permissionError = err;
    }
  }

  if (found.size === 0 && permissionError) {
    throw permissionError;
  }

  return Array.from(found.values());
}

/**
 * Sends a real Firestore invite into the `invites` collection.
 */
export async function sendTeamInvite(params: {
  recipient: OfficerSearchResult;
  senderProfile: FirebaseUserProfile;
}): Promise<TeamInvite> {
  const { recipient, senderProfile } = params;
  const now = new Date().toISOString();
  const joinCode = senderProfile.joinCode || deriveAreaJoinCode(senderProfile.areaId);
  const inviteId = sanitizeDocId(`${senderProfile.areaId}_${recipient.uid}`, 'INV');
  const invite: TeamInvite = {
    inviteId,
    toUid: recipient.uid,
    toEmail: recipient.email,
    ...(recipient.phone ? { toPhone: recipient.phone } : {}),
    toName: recipient.officerName,
    fromUid: senderProfile.uid,
    fromName: senderProfile.officerName,
    areaId: senderProfile.areaId,
    areaName: senderProfile.areaName,
    district: senderProfile.district || '',
    upazila: senderProfile.upazila || '',
    joinCode,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, 'invites', inviteId), invite, { merge: true });
  return invite;
}

/**
 * Subscribes in real time to pending invites addressed to the signed-in officer (`toUid == uid`).
 */
export function subscribeToIncomingInvites(
  uid: string,
  onInvites: (invites: TeamInvite[]) => void
): Unsubscribe {
  const q = query(collection(db, 'invites'), where('toUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const pending: TeamInvite[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data() as Partial<TeamInvite>;
        if ((d.status || 'pending') !== 'pending') return;
        pending.push({
          inviteId: String(d.inviteId || docSnap.id),
          toUid: String(d.toUid || uid),
          toEmail: String(d.toEmail || ''),
          toPhone: d.toPhone ? String(d.toPhone) : undefined,
          toName: d.toName ? String(d.toName) : undefined,
          fromUid: String(d.fromUid || ''),
          fromName: String(d.fromName || 'Team Officer'),
          areaId: String(d.areaId || ''),
          areaName: String(d.areaName || d.areaId || ''),
          district: d.district ? String(d.district) : '',
          upazila: d.upazila ? String(d.upazila) : '',
          joinCode: String(d.joinCode || deriveAreaJoinCode(String(d.areaId || ''))),
          status: 'pending',
          createdAt: String(d.createdAt || new Date().toISOString()),
          updatedAt: String(d.updatedAt || new Date().toISOString()),
        });
      });
      pending.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      onInvites(pending);
    },
    (error) => {
      console.warn('Invites listener warning:', formatFirebaseAuthError(error));
    }
  );
}

/**
 * Switches a user's `users/{uid}.areaId` to the target shared Area and registers them in `areas/{areaId}/members/{uid}`.
 */
async function switchUserToSharedArea(
  user: User,
  currentProfile: FirebaseUserProfile,
  target: {
    areaId: string;
    areaName: string;
    district?: string;
    upazila?: string;
    joinCode?: string;
  }
): Promise<FirebaseUserProfile> {
  const now = new Date().toISOString();
  const joinCode = target.joinCode || deriveAreaJoinCode(target.areaId);
  const updatedProfile: FirebaseUserProfile = {
    ...currentProfile,
    areaId: target.areaId,
    areaName: target.areaName || target.areaId,
    district: target.district ?? currentProfile.district ?? '',
    upazila: target.upazila ?? currentProfile.upazila ?? '',
    joinCode,
    updatedAt: now,
  };

  // 1. Update users/{uid} FIRST so Firestore rules grant membership to the new areaId
  await setDoc(doc(db, 'users', user.uid), updatedProfile, { merge: true });
  saveCachedFirebaseProfile(updatedProfile);

  // 2. Add/update the officer in the shared area's members subcollection
  const memberDoc: MPOUser & { updatedAt: string; updatedBy: string } = {
    MPO_ID: user.uid,
    MPO_Name: updatedProfile.officerName,
    Role: updatedProfile.role || 'MPO',
    Designation: updatedProfile.role || 'MPO',
    Employee_ID: updatedProfile.employeeCode || '',
    Employee_Code: updatedProfile.employeeCode || '',
    Area_ID: updatedProfile.areaId,
    Area: updatedProfile.areaName,
    Territory: [updatedProfile.district, updatedProfile.upazila].filter(Boolean).join(' · '),
    Phone_Number: updatedProfile.phone || '',
    Phone: updatedProfile.phone || '',
    Email: updatedProfile.email || user.email || '',
    Status: 'Active',
    updatedAt: now,
    updatedBy: user.uid,
  };
  await setDoc(doc(db, 'areas', updatedProfile.areaId, 'members', user.uid), memberDoc, {
    merge: true,
  });

  return updatedProfile;
}

/**
 * Accepts a pending invite: marks invite accepted and switches officer into the shared Area/Team.
 */
export async function acceptTeamInvite(
  user: User,
  currentProfile: FirebaseUserProfile,
  invite: TeamInvite
): Promise<FirebaseUserProfile> {
  const now = new Date().toISOString();
  await setDoc(
    doc(db, 'invites', invite.inviteId),
    { status: 'accepted', updatedAt: now },
    { merge: true }
  );

  return switchUserToSharedArea(user, currentProfile, {
    areaId: invite.areaId,
    areaName: invite.areaName,
    district: invite.district,
    upazila: invite.upazila,
    joinCode: invite.joinCode,
  });
}

/**
 * Declines a pending invite.
 */
export async function declineTeamInvite(inviteId: string): Promise<void> {
  await setDoc(
    doc(db, 'invites', inviteId),
    { status: 'declined', updatedAt: new Date().toISOString() },
    { merge: true }
  );
}

/**
 * Joins an existing shared Area/Team immediately using its short Join Code (e.g. DI-4829) or Area ID.
 */
export async function joinTeamByCode(
  user: User,
  currentProfile: FirebaseUserProfile,
  codeInput: string
): Promise<FirebaseUserProfile> {
  const raw = codeInput.trim();
  if (!raw) {
    throw new Error('Please enter a Team Join Code (e.g. DI-4829).');
  }

  const normalizedCode = normalizeJoinCodeInput(raw);
  let target: {
    areaId: string;
    areaName: string;
    district?: string;
    upazila?: string;
    joinCode?: string;
  } | null = null;

  // 1. Direct lookup in joinCodes/{DI-XXXX}
  try {
    const codeSnap = await getDoc(doc(db, 'joinCodes', normalizedCode));
    if (codeSnap.exists()) {
      const d = codeSnap.data() as Record<string, unknown>;
      if (d.areaId) {
        target = {
          areaId: String(d.areaId),
          areaName: String(d.areaName || d.areaId),
          district: d.district ? String(d.district) : '',
          upazila: d.upazila ? String(d.upazila) : '',
          joinCode: String(d.joinCode || normalizedCode),
        };
      }
    }
  } catch {
    // Fall through to areas query
  }

  // 2. Fallback query on areas collection where joinCode == normalizedCode
  if (!target) {
    try {
      const snap = await getDocs(
        query(collection(db, 'areas'), where('joinCode', '==', normalizedCode), limit(1))
      );
      if (!snap.empty) {
        const d = snap.docs[0].data() as Record<string, unknown>;
        target = {
          areaId: String(d.areaId || snap.docs[0].id),
          areaName: String(d.areaName || snap.docs[0].id),
          district: d.district ? String(d.district) : '',
          upazila: d.upazila ? String(d.upazila) : '',
          joinCode: String(d.joinCode || normalizedCode),
        };
      }
    } catch {
      // Fall through
    }
  }

  // 3. Fallback: allow joining directly by exact Area ID slug if pasted
  if (!target) {
    const rawSlug = raw.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    try {
      const snap = await getDocs(
        query(collection(db, 'areas'), where('areaId', '==', rawSlug), limit(1))
      );
      if (!snap.empty) {
        const d = snap.docs[0].data() as Record<string, unknown>;
        target = {
          areaId: String(d.areaId || snap.docs[0].id),
          areaName: String(d.areaName || snap.docs[0].id),
          district: d.district ? String(d.district) : '',
          upazila: d.upazila ? String(d.upazila) : '',
          joinCode: String(d.joinCode || deriveAreaJoinCode(String(d.areaId || snap.docs[0].id))),
        };
      }
    } catch {
      // Ignore
    }
  }

  if (!target) {
    throw new Error(
      `No Team found for code "${normalizedCode}". Double-check the Join Code shared by your teammate.`
    );
  }

  if (target.areaId === currentProfile.areaId) {
    throw new Error(`You are already a member of ${target.areaName}.`);
  }

  return switchUserToSharedArea(user, currentProfile, target);
}
