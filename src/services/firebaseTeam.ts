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
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
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
  TeamSubArea,
  TeamSuperior,
  TeamWorkspaceMeta,
} from '../types';

const FIREBASE_PROFILE_CACHE_KEY = 'mfa_di_firebase_user_profile';

function clampString(val: unknown, maxLen: number): string {
  return String(val ?? '').trim().slice(0, maxLen);
}

/**
 * Recursively removes keys with `undefined` values before passing objects to
 * Firestore `setDoc` / `updateDoc`, while preserving arrays and Firestore
 * `FieldValue` sentinels (e.g. `arrayUnion`, `arrayRemove`).
 */
export function omitUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
    ) {
      out[key] = omitUndefined(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
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

/**
 * Generates a strictly private per-user Team ID so every new user starts
 * isolated with `members: [uid]` and `superiorUids: []`.
 */
export function buildPrivateTeamId(uid: string): string {
  const cleanUid = String(uid ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '')
    .slice(0, 24);
  return cleanUid.length >= 4 ? `team-${cleanUid}` : `team-${Date.now().toString(36)}`;
}

/**
 * Retained for compatibility; builds a clean readable slug from territory/district text.
 */
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
  return slug.length >= 3 ? slug : `team-${Date.now().toString(36)}`;
}

export function normalizePhoneDigits(raw: string): string {
  return String(raw ?? '').replace(/[^0-9]/g, '').slice(0, 20);
}

/**
 * Generates a short, memorable Team Join Code like "DI-4829" deterministically from a teamId.
 */
export function deriveAreaJoinCode(teamId: string): string {
  const input = String(teamId || 'field-pro-di').trim().toLowerCase();
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
    if (!parsed || !parsed.uid || (!parsed.teamId && !parsed.areaId)) return null;
    if (uid && parsed.uid !== uid) return null;
    const teamId = String(parsed.teamId || parsed.areaId);
    const territoryName = String(parsed.territoryName || parsed.areaName || teamId);
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
      teamId,
      territoryName,
      areaId: teamId,
      areaName: territoryName,
      joinCode: parsed.joinCode ? String(parsed.joinCode) : deriveAreaJoinCode(teamId),
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
  const teamId = profile.teamId || profile.areaId;
  const territoryName = profile.territoryName || profile.areaName;
  return {
    loginMode: 'firebase',
    uid: profile.uid,
    email: profile.email,
    phone: profile.phone,
    teamId,
    territoryName,
    areaId: teamId,
    areaName: territoryName,
    joinCode: profile.joinCode || deriveAreaJoinCode(teamId),
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
      'Firestore permission denied. Publish the updated firestore.rules in Firebase Console for teams/{teamId} access.'
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

/**
 * Creates a strictly private `teams/{teamId}` workspace for a newly registered officer
 * with `members: [uid]` and `superiorUids: []`.
 */
export async function saveUserAndAreaDocs(
  user: User,
  input: Omit<TeamRegistrationInput, 'email' | 'password'> & { joinCode?: string }
): Promise<FirebaseUserProfile> {
  const now = new Date().toISOString();
  const officerName = clampString(input.officerName, 120) || user.displayName || 'Field Officer';
  const role = clampString(input.role || 'MPO', 60);
  const district = clampString(input.district, 80);
  const upazila = clampString(input.upazila, 80);
  const territoryName = clampString(input.areaName, 120) || upazila || district || 'My Territory';
  const phone = clampString(input.phone, 40);
  const phoneNormalized = phone ? normalizePhoneDigits(phone) : '';
  const employeeCode = clampString(input.employeeCode, 40);

  // Strictly private per-user Team ID by default (never a shared guessable district slug!)
  const teamId = buildPrivateTeamId(user.uid);
  const joinCode = normalizeJoinCodeInput(input.joinCode || '') || deriveAreaJoinCode(teamId);
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
    teamId,
    territoryName,
    areaId: teamId,
    areaName: territoryName,
    joinCode,
    district,
    upazila,
    createdAt: now,
    updatedAt: now,
  };

  // 1. Create private teams/{teamId} document FIRST (members: [uid], superiorUids: [])
  const teamPath = `teams/${teamId}`;
  try {
    const teamDoc: TeamWorkspaceMeta = {
      teamId,
      territoryName,
      district,
      upazila,
      joinCode,
      ownerUid: user.uid,
      members: [user.uid],
      superiorUids: [],
      createdAt: now,
      updatedAt: now,
      updatedBy: user.uid,
    };
    await setDoc(doc(db, 'teams', teamId), omitUndefined(teamDoc as unknown as Record<string, unknown>), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, teamPath);
  }

  // 2. Write users/{uid} profile pointing to their private teamId
  const userPath = `users/${user.uid}`;
  try {
    await setDoc(doc(db, 'users', user.uid), omitUndefined(profile as unknown as Record<string, unknown>), { merge: true });
    saveCachedFirebaseProfile(profile);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  // 3. Register short Join Code lookup doc joinCodes/{joinCode} (best-effort)
  try {
    await setDoc(
      doc(db, 'joinCodes', joinCode),
      omitUndefined({
        joinCode,
        teamId,
        territoryName,
        areaId: teamId,
        areaName: territoryName,
        district,
        upazila,
        updatedBy: user.uid,
        updatedAt: now,
      }),
      { merge: true }
    );
  } catch {
    // Non-fatal if joinCodes rules are not yet published
  }

  // 4. Add officer into teams/{teamId}/members/{uid}
  const memberPath = `teams/${teamId}/members/${user.uid}`;
  try {
    const memberDoc: MPOUser & { updatedAt: string; updatedBy: string } = {
      MPO_ID: user.uid,
      MPO_Name: officerName,
      Role: role,
      Designation: role,
      Employee_ID: employeeCode,
      Employee_Code: employeeCode,
      Area_ID: teamId,
      Area: territoryName,
      Territory: [district, upazila].filter(Boolean).join(' · '),
      Phone_Number: phone,
      Phone: phone,
      Email: email,
      Status: 'Active',
      updatedAt: now,
      updatedBy: user.uid,
    };
    await setDoc(
      doc(db, 'teams', teamId, 'members', user.uid),
      omitUndefined(memberDoc as unknown as Record<string, unknown>),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, memberPath);
  }

  // 5. If user provided an optional existing Join Code on registration, join that team immediately
  if (input.customAreaId && input.customAreaId.trim()) {
    try {
      return await joinTeamByCode(user, profile, input.customAreaId.trim());
    } catch {
      // Keep their private team if the entered code was not found
    }
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

/**
 * Loads `users/{uid}` and seamlessly upgrades legacy `areas/{slug}` profiles to a
 * private `teams/{teamId}` workspace if `teamId` was not yet assigned.
 */
export async function fetchUserProfileFromFirestore(
  uid: string
): Promise<FirebaseUserProfile | null> {
  const userPath = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const data = snap.data() as Partial<FirebaseUserProfile>;
    if (!data.teamId && !data.areaId) return null;

    const legacyAreaId = data.areaId ? String(data.areaId) : '';
    const hasExplicitTeamId = Boolean(data.teamId);
    const teamId = hasExplicitTeamId ? String(data.teamId) : buildPrivateTeamId(uid);
    const territoryName = String(data.territoryName || data.areaName || teamId);
    const email = String(data.email || auth.currentUser?.email || '');
    const phone = data.phone ? String(data.phone) : undefined;
    const joinCode = hasExplicitTeamId && data.joinCode
      ? String(data.joinCode)
      : deriveAreaJoinCode(teamId);

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
      teamId,
      territoryName,
      areaId: teamId,
      areaName: territoryName,
      joinCode,
      district: String(data.district || ''),
      upazila: String(data.upazila || ''),
      createdAt: String(data.createdAt || new Date().toISOString()),
      updatedAt: String(data.updatedAt || new Date().toISOString()),
    };

    // If upgrading a legacy account without `teamId`, initialize their private `teams/{teamId}` cleanly
    if (!hasExplicitTeamId) {
      void migrateLegacyProfileToPrivateTeam(profile, legacyAreaId);
    }

    saveCachedFirebaseProfile(profile);
    return profile;
  } catch (error) {
    const cached = getCachedFirebaseProfile(uid);
    if (cached) return cached;
    console.error(
      'Firestore Error: ',
      JSON.stringify(buildFirestoreErrorInfo(error, OperationType.GET, userPath))
    );
    return null;
  }
}

async function migrateLegacyProfileToPrivateTeam(
  profile: FirebaseUserProfile,
  legacyAreaId: string
): Promise<void> {
  const now = new Date().toISOString();
  const { teamId, uid } = profile;
  try {
    const teamRef = doc(db, 'teams', teamId);
    const existing = await getDoc(teamRef).catch(() => null);
    if (!existing || !existing.exists()) {
      await setDoc(
        teamRef,
        omitUndefined({
          teamId,
          territoryName: profile.territoryName,
          district: profile.district || '',
          upazila: profile.upazila || '',
          joinCode: profile.joinCode || deriveAreaJoinCode(teamId),
          ownerUid: uid,
          members: [uid],
          superiorUids: [],
          createdAt: profile.createdAt || now,
          updatedAt: now,
          updatedBy: uid,
        }),
        { merge: true }
      );
    }

    // Update users/{uid} with new private teamId
    await setDoc(
      doc(db, 'users', uid),
      omitUndefined({
        teamId,
        territoryName: profile.territoryName,
        areaId: teamId,
        areaName: profile.territoryName,
        joinCode: profile.joinCode || deriveAreaJoinCode(teamId),
        updatedAt: now,
      }),
      { merge: true }
    );

    // Ensure officer is in teams/{teamId}/members/{uid}
    await setDoc(
      doc(db, 'teams', teamId, 'members', uid),
      omitUndefined({
        MPO_ID: uid,
        MPO_Name: profile.officerName,
        Role: profile.role || 'MPO',
        Designation: profile.role || 'MPO',
        Employee_ID: profile.employeeCode || '',
        Employee_Code: profile.employeeCode || '',
        Area_ID: teamId,
        Area: profile.territoryName,
        Territory: [profile.district, profile.upazila].filter(Boolean).join(' · '),
        Phone_Number: profile.phone || '',
        Phone: profile.phone || '',
        Email: profile.email || '',
        Status: 'Active',
        updatedAt: now,
        updatedBy: uid,
      }),
      { merge: true }
    );

    // Best-effort copy of any legacy doctors & hospitals from areas/{legacyAreaId}
    if (legacyAreaId && legacyAreaId !== teamId) {
      const legacyDocs = await getDocs(collection(db, 'areas', legacyAreaId, 'doctors')).catch(
        () => null
      );
      if (legacyDocs && !legacyDocs.empty) {
        for (const d of legacyDocs.docs) {
          const raw = d.data() as Record<string, unknown>;
          await saveAreaDoctor(teamId, { ...raw, Area_ID: teamId }, uid).catch(() => {});
        }
      }
      const legacyHosps = await getDocs(collection(db, 'areas', legacyAreaId, 'hospitals')).catch(
        () => null
      );
      if (legacyHosps && !legacyHosps.empty) {
        for (const h of legacyHosps.docs) {
          const raw = h.data() as Record<string, unknown>;
          await saveAreaHospital(teamId, { ...raw, Area_ID: teamId }, uid).catch(() => {});
        }
      }
    }
  } catch {
    // Best-effort silent migration
  }
}

/**
 * Updates the Territory Name (and optional District / Upazila) on `teams/{teamId}`,
 * `users/{uid}`, `joinCodes/{joinCode}`, and `teams/{teamId}/members/{uid}`.
 */
export async function updateTeamTerritoryName(params: {
  profile: FirebaseUserProfile;
  territoryName: string;
  district?: string;
  upazila?: string;
}): Promise<FirebaseUserProfile> {
  const { profile } = params;
  const now = new Date().toISOString();
  const teamId = profile.teamId || profile.areaId;
  const nextTerritoryName = clampString(params.territoryName, 120);
  if (!nextTerritoryName) {
    throw new Error('Territory name cannot be empty.');
  }
  const nextDistrict =
    params.district !== undefined ? clampString(params.district, 80) : profile.district || '';
  const nextUpazila =
    params.upazila !== undefined ? clampString(params.upazila, 80) : profile.upazila || '';
  const joinCode = profile.joinCode || deriveAreaJoinCode(teamId);

  const teamRef = doc(db, 'teams', teamId);
  const teamPath = `teams/${teamId}`;
  const existingTeam = await getDoc(teamRef).catch(() => null);
  const teamPayload =
    existingTeam && existingTeam.exists()
      ? omitUndefined({
          territoryName: nextTerritoryName,
          district: nextDistrict,
          upazila: nextUpazila,
          joinCode,
          updatedBy: profile.uid,
          updatedAt: now,
        })
      : omitUndefined({
          teamId,
          territoryName: nextTerritoryName,
          district: nextDistrict,
          upazila: nextUpazila,
          joinCode,
          ownerUid: profile.uid,
          members: [profile.uid],
          superiorUids: [],
          createdAt: profile.createdAt || now,
          updatedBy: profile.uid,
          updatedAt: now,
        });

  await commitFirestoreMutation(
    setDoc(teamRef, teamPayload, { merge: true }),
    OperationType.UPDATE,
    teamPath
  );

  const updatedProfile: FirebaseUserProfile = {
    ...profile,
    teamId,
    territoryName: nextTerritoryName,
    areaId: teamId,
    areaName: nextTerritoryName,
    district: nextDistrict,
    upazila: nextUpazila,
    joinCode,
    updatedAt: now,
  };

  await commitFirestoreMutation(
    setDoc(
      doc(db, 'users', profile.uid),
      omitUndefined(updatedProfile as unknown as Record<string, unknown>),
      { merge: true }
    ),
    OperationType.UPDATE,
    `users/${profile.uid}`
  );
  saveCachedFirebaseProfile(updatedProfile);

  // Sync joinCodes/{joinCode} and member card (best-effort)
  void setDoc(
    doc(db, 'joinCodes', joinCode),
    omitUndefined({
      joinCode,
      teamId,
      territoryName: nextTerritoryName,
      areaId: teamId,
      areaName: nextTerritoryName,
      district: nextDistrict,
      upazila: nextUpazila,
      updatedBy: profile.uid,
      updatedAt: now,
    }),
    { merge: true }
  ).catch(() => {});

  void setDoc(
    doc(db, 'teams', teamId, 'members', profile.uid),
    omitUndefined({
      Area: nextTerritoryName,
      Territory: [nextDistrict, nextUpazila].filter(Boolean).join(' · '),
      updatedAt: now,
      updatedBy: profile.uid,
    }),
    { merge: true }
  ).catch(() => {});

  return updatedProfile;
}

export interface TeamWorkspaceCallbacks {
  onMeta?: (meta: TeamWorkspaceMeta | null) => void;
  onDoctors: (rows: Doctor[]) => void;
  onChambers: (rows: Chamber[]) => void;
  onHospitals: (rows: Hospital[]) => void;
  onSubAreas: (rows: TeamSubArea[]) => void;
  onMembers: (rows: MPOUser[]) => void;
  onSuperiors: (rows: TeamSuperior[]) => void;
  onNotes: (rows: AreaNote[]) => void;
  onError?: (message: string) => void;
}

export function subscribeToAreaWorkspace(
  teamId: string,
  callbacks: TeamWorkspaceCallbacks
): Unsubscribe {
  const unsubscribers: Unsubscribe[] = [];

  const reportError = (error: unknown, path: string) => {
    const info = buildFirestoreErrorInfo(error, OperationType.LIST, path);
    console.error('Firestore Error: ', JSON.stringify(info));
    if (callbacks.onError) {
      callbacks.onError(formatFirebaseAuthError(error));
    }
  };

  // Team metadata doc (live territoryName, members, superiorUids)
  if (callbacks.onMeta) {
    const metaPath = `teams/${teamId}`;
    unsubscribers.push(
      onSnapshot(
        doc(db, 'teams', teamId),
        (snap) => {
          if (!snap.exists()) {
            callbacks.onMeta?.(null);
            return;
          }
          const d = snap.data() as Partial<TeamWorkspaceMeta>;
          callbacks.onMeta?.({
            teamId: String(d.teamId || snap.id),
            territoryName: String(d.territoryName || snap.id),
            district: String(d.district || ''),
            upazila: String(d.upazila || ''),
            joinCode: String(d.joinCode || deriveAreaJoinCode(snap.id)),
            ownerUid: String(d.ownerUid || ''),
            members: Array.isArray(d.members) ? d.members.map(String) : [],
            superiorUids: Array.isArray(d.superiorUids) ? d.superiorUids.map(String) : [],
            createdAt: d.createdAt ? String(d.createdAt) : undefined,
            updatedAt: d.updatedAt ? String(d.updatedAt) : undefined,
            updatedBy: d.updatedBy ? String(d.updatedBy) : undefined,
          });
        },
        (err) => reportError(err, metaPath)
      )
    );
  }

  const doctorsPath = `teams/${teamId}/doctors`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'teams', teamId, 'doctors'),
      (snap) => {
        const list: Doctor[] = snap.docs.map((d) => {
          const data = d.data() as Partial<Doctor>;
          const subArea = String(data.Sub_Area || data.areaName || '').trim();
          return {
            Doctor_ID: String(data.Doctor_ID || d.id),
            Doctor_Name: String(data.Doctor_Name || ''),
            Degree: String(data.Degree || ''),
            Specialty: String(data.Specialty || ''),
            Department_ID: String(data.Department_ID || ''),
            Primary_Hospital_ID: String(data.Primary_Hospital_ID || ''),
            Area_ID: teamId,
            Sub_Area: subArea,
            areaName: subArea,
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

  const chambersPath = `teams/${teamId}/chambers`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'teams', teamId, 'chambers'),
      (snap) => {
        const list: Chamber[] = snap.docs.map((d) => {
          const data = d.data() as Partial<Chamber>;
          return {
            Chamber_ID: String(data.Chamber_ID || d.id),
            Doctor_ID: String(data.Doctor_ID || ''),
            Chamber_Name: String(data.Chamber_Name || ''),
            Address: String(data.Address || ''),
            Area_ID: teamId,
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

  const hospitalsPath = `teams/${teamId}/hospitals`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'teams', teamId, 'hospitals'),
      (snap) => {
        const list: Hospital[] = snap.docs.map((d) => {
          const data = d.data() as Partial<Hospital>;
          const subArea = String(data.Sub_Area || data.areaName || '').trim();
          return {
            Hospital_ID: String(data.Hospital_ID || d.id),
            Hospital_Name: String(data.Hospital_Name || ''),
            Area_ID: teamId,
            Sub_Area: subArea,
            areaName: subArea,
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

  const subAreasPath = `teams/${teamId}/areas`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'teams', teamId, 'areas'),
      (snap) => {
        const list: TeamSubArea[] = snap.docs
          .map((d) => {
            const data = d.data() as Partial<TeamSubArea>;
            return {
              SubArea_ID: String(data.SubArea_ID || d.id),
              Team_ID: teamId,
              Area_Name: String(data.Area_Name || ''),
              Market_Type: data.Market_Type ? String(data.Market_Type) : 'Market / Bazar',
              Notes: data.Notes ? String(data.Notes) : '',
              Status: data.Status ? String(data.Status) : 'Active',
              Created_At: data.Created_At ? String(data.Created_At) : '',
              Updated_At: data.Updated_At ? String(data.Updated_At) : '',
            };
          })
          .filter((a) => a.Area_Name.trim().length > 0)
          .sort((a, b) => a.Area_Name.localeCompare(b.Area_Name));
        callbacks.onSubAreas(list);
      },
      (err) => reportError(err, subAreasPath)
    )
  );

  const membersPath = `teams/${teamId}/members`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'teams', teamId, 'members'),
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
            Area_ID: teamId,
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

  const superiorsPath = `teams/${teamId}/superiors`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'teams', teamId, 'superiors'),
      (snap) => {
        const list: TeamSuperior[] = snap.docs
          .map((d) => {
            const data = d.data() as Partial<TeamSuperior>;
            return {
              uid: String(data.uid || d.id),
              officerName: String(data.officerName || 'Manager'),
              email: String(data.email || ''),
              phone: data.phone ? String(data.phone) : undefined,
              role: String(data.role || 'Superior'),
              approvedAt: String(data.approvedAt || new Date().toISOString()),
              invitedByUid: data.invitedByUid ? String(data.invitedByUid) : undefined,
              invitedByName: data.invitedByName ? String(data.invitedByName) : undefined,
            };
          })
          .sort((a, b) => b.approvedAt.localeCompare(a.approvedAt));
        callbacks.onSuperiors(list);
      },
      (err) => reportError(err, superiorsPath)
    )
  );

  const notesPath = `teams/${teamId}/notes`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'teams', teamId, 'notes'),
      (snap) => {
        const list: AreaNote[] = snap.docs
          .map((d) => {
            const data = d.data() as Partial<AreaNote>;
            return {
              Note_ID: String(data.Note_ID || d.id),
              Area_ID: teamId,
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

/**
 * Subscribes to all Teams where this officer has been granted read-only Manager View Access
 * (`superiorUids` contains `uid`). Revocation removes the team instantaneously.
 */
export function subscribeToSuperiorTeams(
  uid: string,
  onTeams: (teams: TeamWorkspaceMeta[]) => void
): Unsubscribe {
  const q = query(collection(db, 'teams'), where('superiorUids', 'array-contains', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list: TeamWorkspaceMeta[] = snap.docs.map((docSnap) => {
        const d = docSnap.data() as Partial<TeamWorkspaceMeta>;
        return {
          teamId: String(d.teamId || docSnap.id),
          territoryName: String(d.territoryName || docSnap.id),
          district: String(d.district || ''),
          upazila: String(d.upazila || ''),
          joinCode: String(d.joinCode || deriveAreaJoinCode(docSnap.id)),
          ownerUid: String(d.ownerUid || ''),
          members: Array.isArray(d.members) ? d.members.map(String) : [],
          superiorUids: Array.isArray(d.superiorUids) ? d.superiorUids.map(String) : [],
          createdAt: d.createdAt ? String(d.createdAt) : undefined,
          updatedAt: d.updatedAt ? String(d.updatedAt) : undefined,
        };
      });
      list.sort((a, b) => a.territoryName.localeCompare(b.territoryName));
      onTeams(list);
    },
    (err) => {
      console.warn('Superior teams listener warning:', formatFirebaseAuthError(err));
      onTeams([]);
    }
  );
}

// ============================================================================
// TEAM-SCOPED FIRESTORE CRUD MUTATIONS (Strict payload sanitization + offline-safe)
// ============================================================================

async function commitFirestoreMutation(
  opPromise: Promise<void>,
  operationType: OperationType,
  path: string
): Promise<void> {
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

export async function saveTeamSubArea(
  teamId: string,
  input: {
    SubArea_ID?: string;
    Area_Name: string;
    Market_Type?: string;
    Notes?: string;
    Status?: string;
    Created_At?: string;
  },
  uid: string
): Promise<TeamSubArea> {
  const areaName = clampString(input.Area_Name, 120);
  if (!areaName) {
    throw new Error('Enter a Sub-Area / Market name.');
  }
  const docId = sanitizeDocId(input.SubArea_ID || `SUB-${Date.now().toString(36)}`, 'SUB');
  const path = `teams/${teamId}/areas/${docId}`;
  const now = new Date().toISOString();
  const payload: TeamSubArea & { updatedAt: string; updatedBy: string } = {
    SubArea_ID: docId,
    Team_ID: teamId,
    Area_Name: areaName,
    Market_Type: clampString(input.Market_Type || 'Market / Bazar', 60),
    Notes: clampString(input.Notes, 400),
    Status: clampString(input.Status || 'Active', 20),
    Created_At: input.Created_At || now,
    Updated_At: now,
    updatedAt: now,
    updatedBy: uid,
  };
  await commitFirestoreMutation(
    setDoc(
      doc(db, 'teams', teamId, 'areas', docId),
      omitUndefined(payload as unknown as Record<string, unknown>),
      { merge: true }
    ),
    OperationType.WRITE,
    path
  );
  return payload;
}

export async function deleteTeamSubArea(teamId: string, subAreaId: string): Promise<void> {
  const docId = sanitizeDocId(subAreaId, 'SUB');
  const path = `teams/${teamId}/areas/${docId}`;
  await commitFirestoreMutation(
    deleteDoc(doc(db, 'teams', teamId, 'areas', docId)),
    OperationType.DELETE,
    path
  );
}

export async function saveAreaDoctor(
  teamId: string,
  data: Record<string, unknown>,
  uid: string
): Promise<void> {
  const docId = sanitizeDocId(String(data.Doctor_ID || ''), 'DOC');
  const path = `teams/${teamId}/doctors/${docId}`;
  const now = new Date().toISOString();
  const subArea = clampString(data.Sub_Area || data.areaName, 120);
  const payload = {
    Doctor_ID: docId,
    Doctor_Name: clampString(data.Doctor_Name, 160),
    Degree: clampString(data.Degree, 160),
    Specialty: clampString(data.Specialty, 120),
    Department_ID: clampString(data.Department_ID, 80),
    Primary_Hospital_ID: clampString(data.Primary_Hospital_ID, 80),
    Area_ID: teamId,
    Sub_Area: subArea,
    areaName: subArea,
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
    setDoc(doc(db, 'teams', teamId, 'doctors', docId), omitUndefined(payload), { merge: true }),
    OperationType.WRITE,
    path
  );
}

export async function deleteAreaDoctor(teamId: string, doctorId: string): Promise<void> {
  const docId = sanitizeDocId(doctorId, 'DOC');
  const path = `teams/${teamId}/doctors/${docId}`;
  await commitFirestoreMutation(
    deleteDoc(doc(db, 'teams', teamId, 'doctors', docId)),
    OperationType.DELETE,
    path
  );
}

export async function saveAreaChamber(
  teamId: string,
  data: Record<string, unknown>,
  uid: string
): Promise<void> {
  const docId = sanitizeDocId(String(data.Chamber_ID || ''), 'CHM');
  const path = `teams/${teamId}/chambers/${docId}`;
  const now = new Date().toISOString();
  const payload = {
    Chamber_ID: docId,
    Doctor_ID: clampString(data.Doctor_ID, 80),
    Chamber_Name: clampString(data.Chamber_Name, 160),
    Address: clampString(data.Address, 300),
    Area_ID: teamId,
    Visiting_Days: clampString(data.Visiting_Days, 120),
    Visiting_Hours: clampString(data.Visiting_Hours, 120),
    Assistant_Phone: clampString(data.Assistant_Phone, 40),
    Status: clampString(data.Status || 'Active', 20),
    updatedAt: now,
    updatedBy: uid,
  };
  await commitFirestoreMutation(
    setDoc(doc(db, 'teams', teamId, 'chambers', docId), omitUndefined(payload), { merge: true }),
    OperationType.WRITE,
    path
  );
}

export async function deleteAreaChamber(teamId: string, chamberId: string): Promise<void> {
  const docId = sanitizeDocId(chamberId, 'CHM');
  const path = `teams/${teamId}/chambers/${docId}`;
  await commitFirestoreMutation(
    deleteDoc(doc(db, 'teams', teamId, 'chambers', docId)),
    OperationType.DELETE,
    path
  );
}

export async function saveAreaHospital(
  teamId: string,
  data: Record<string, unknown>,
  uid: string
): Promise<void> {
  const docId = sanitizeDocId(String(data.Hospital_ID || ''), 'HSP');
  const path = `teams/${teamId}/hospitals/${docId}`;
  const now = new Date().toISOString();
  const subArea = clampString(data.Sub_Area || data.areaName, 120);
  const payload = {
    Hospital_ID: docId,
    Hospital_Name: clampString(data.Hospital_Name, 180),
    Area_ID: teamId,
    Sub_Area: subArea,
    areaName: subArea,
    Hospital_Type: clampString(data.Hospital_Type, 80),
    Address: clampString(data.Address, 300),
    Phone: clampString(data.Phone, 40),
    Status: clampString(data.Status || 'Active', 20),
    updatedAt: now,
    updatedBy: uid,
  };
  await commitFirestoreMutation(
    setDoc(doc(db, 'teams', teamId, 'hospitals', docId), omitUndefined(payload), { merge: true }),
    OperationType.WRITE,
    path
  );
}

export async function deleteAreaHospital(teamId: string, hospitalId: string): Promise<void> {
  const docId = sanitizeDocId(hospitalId, 'HSP');
  const path = `teams/${teamId}/hospitals/${docId}`;
  await commitFirestoreMutation(
    deleteDoc(doc(db, 'teams', teamId, 'hospitals', docId)),
    OperationType.DELETE,
    path
  );
}

export async function saveAreaMember(
  teamId: string,
  data: Record<string, unknown>,
  uid: string
): Promise<void> {
  const docId = sanitizeDocId(String(data.MPO_ID || ''), 'MPO');
  const path = `teams/${teamId}/members/${docId}`;
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
    Area_ID: teamId,
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
    setDoc(doc(db, 'teams', teamId, 'members', docId), omitUndefined(payload), { merge: true }),
    OperationType.WRITE,
    path
  );
}

export async function deleteAreaMember(teamId: string, memberId: string): Promise<void> {
  const docId = sanitizeDocId(memberId, 'MPO');
  const path = `teams/${teamId}/members/${docId}`;
  await commitFirestoreMutation(
    deleteDoc(doc(db, 'teams', teamId, 'members', docId)),
    OperationType.DELETE,
    path
  );
}

export async function saveAreaNote(
  teamId: string,
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
  const path = `teams/${teamId}/notes/${docId}`;
  const now = new Date().toISOString();
  const payload: AreaNote = {
    Note_ID: docId,
    Area_ID: teamId,
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
    setDoc(
      doc(db, 'teams', teamId, 'notes', docId),
      omitUndefined(payload as unknown as Record<string, unknown>),
      { merge: true }
    ),
    OperationType.WRITE,
    path
  );
}

export async function deleteAreaNote(teamId: string, noteId: string): Promise<void> {
  const docId = sanitizeDocId(noteId, 'NOTE');
  const path = `teams/${teamId}/notes/${docId}`;
  await commitFirestoreMutation(
    deleteDoc(doc(db, 'teams', teamId, 'notes', docId)),
    OperationType.DELETE,
    path
  );
}

// =========================================================================
// REAL TEAM & SUPERIOR INVITE + JOIN CODE SYSTEM (Firestore `teams/{teamId}`)
// =========================================================================

/**
 * Ensures the signed-in officer's `teams/{teamId}` and `joinCodes/{joinCode}` exist
 * and that `emailLower`/`phoneNormalized` are indexed on `users/{uid}`.
 */
export async function ensureAreaJoinCodeRegistered(profile: FirebaseUserProfile): Promise<void> {
  const teamId = profile.teamId || profile.areaId;
  const territoryName = profile.territoryName || profile.areaName;
  const joinCode = profile.joinCode || deriveAreaJoinCode(teamId);
  const now = new Date().toISOString();
  const emailLower = (profile.email || '').trim().toLowerCase();
  const phoneNormalized = profile.phone ? normalizePhoneDigits(profile.phone) : '';

  try {
    const teamRef = doc(db, 'teams', teamId);
    const snap = await getDoc(teamRef).catch(() => null);
    if (!snap || !snap.exists()) {
      await setDoc(
        teamRef,
        omitUndefined({
          teamId,
          territoryName,
          district: profile.district || '',
          upazila: profile.upazila || '',
          joinCode,
          ownerUid: profile.uid,
          members: [profile.uid],
          superiorUids: [],
          createdAt: profile.createdAt || now,
          updatedAt: now,
          updatedBy: profile.uid,
        }),
        { merge: true }
      );
    }
  } catch {
    // Non-fatal
  }

  try {
    await setDoc(
      doc(db, 'users', profile.uid),
      omitUndefined({
        teamId,
        territoryName,
        areaId: teamId,
        areaName: territoryName,
        joinCode,
        ...(emailLower ? { emailLower } : {}),
        ...(phoneNormalized ? { phoneNormalized } : {}),
      }),
      { merge: true }
    );
  } catch {
    // Non-fatal background sync
  }

  try {
    await setDoc(
      doc(db, 'joinCodes', joinCode),
      omitUndefined({
        joinCode,
        teamId,
        territoryName,
        areaId: teamId,
        areaName: territoryName,
        district: profile.district || '',
        upazila: profile.upazila || '',
        updatedBy: profile.uid,
        updatedAt: now,
      }),
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
        const resolvedTeamId = String(d.teamId || d.areaId || '');
        const resolvedTerritory = String(d.territoryName || d.areaName || resolvedTeamId);
        if (!found.has(uid)) {
          found.set(uid, {
            uid,
            officerName: String(d.officerName || 'Field Officer'),
            email: String(d.email || ''),
            phone: d.phone ? String(d.phone) : undefined,
            role: d.role ? String(d.role) : 'MPO',
            teamId: resolvedTeamId,
            territoryName: resolvedTerritory,
            areaId: resolvedTeamId,
            areaName: resolvedTerritory,
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
 * Supports both `'member'` (shared territory collaboration) and `'superior'` (read-only Manager View).
 */
export async function sendTeamInvite(params: {
  recipient: OfficerSearchResult;
  senderProfile: FirebaseUserProfile;
  inviteType?: 'member' | 'superior';
}): Promise<TeamInvite> {
  const { recipient, senderProfile, inviteType = 'member' } = params;
  const now = new Date().toISOString();
  const teamId = senderProfile.teamId || senderProfile.areaId;
  const territoryName = senderProfile.territoryName || senderProfile.areaName;
  const joinCode = senderProfile.joinCode || deriveAreaJoinCode(teamId);
  const inviteId = sanitizeDocId(`${teamId}_${inviteType}_${recipient.uid}`, 'INV');
  const invite: TeamInvite = {
    inviteId,
    inviteType,
    toUid: recipient.uid,
    toEmail: recipient.email,
    ...(recipient.phone ? { toPhone: recipient.phone } : {}),
    toName: recipient.officerName,
    fromUid: senderProfile.uid,
    fromName: senderProfile.officerName,
    teamId,
    territoryName,
    areaId: teamId,
    areaName: territoryName,
    district: senderProfile.district || '',
    upazila: senderProfile.upazila || '',
    joinCode,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(
    doc(db, 'invites', inviteId),
    omitUndefined(invite as unknown as Record<string, unknown>),
    { merge: true }
  );
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
        const resolvedTeamId = String(d.teamId || d.areaId || '');
        const resolvedTerritory = String(d.territoryName || d.areaName || resolvedTeamId);
        pending.push({
          inviteId: String(d.inviteId || docSnap.id),
          inviteType: d.inviteType === 'superior' ? 'superior' : 'member',
          toUid: String(d.toUid || uid),
          toEmail: String(d.toEmail || ''),
          toPhone: d.toPhone ? String(d.toPhone) : undefined,
          toName: d.toName ? String(d.toName) : undefined,
          fromUid: String(d.fromUid || ''),
          fromName: String(d.fromName || 'Team Officer'),
          teamId: resolvedTeamId,
          territoryName: resolvedTerritory,
          areaId: resolvedTeamId,
          areaName: resolvedTerritory,
          district: d.district ? String(d.district) : '',
          upazila: d.upazila ? String(d.upazila) : '',
          joinCode: String(d.joinCode || deriveAreaJoinCode(resolvedTeamId)),
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
 * Adds a teammate atomically to `teams/{targetTeamId}.members`, switches their `users/{uid}.teamId`,
 * and registers their card in `teams/{targetTeamId}/members/{uid}`.
 */
async function switchUserToSharedTeam(
  user: User,
  currentProfile: FirebaseUserProfile,
  target: {
    teamId: string;
    territoryName: string;
    district?: string;
    upazila?: string;
    joinCode?: string;
    joinedByCode?: boolean;
  }
): Promise<FirebaseUserProfile> {
  const now = new Date().toISOString();
  const joinCode = target.joinCode || deriveAreaJoinCode(target.teamId);

  // 1. Add user atomically to teams/{targetTeamId}.members FIRST so rules immediately recognize membership
  await updateDoc(
    doc(db, 'teams', target.teamId),
    omitUndefined({
      members: arrayUnion(user.uid),
      ...(target.joinedByCode ? { lastJoinProof: `${joinCode}_${now}` } : {}),
      updatedAt: now,
    })
  );

  // 2. Update users/{uid} to point to the shared teamId (stripping all undefined fields)
  const updatedProfile: FirebaseUserProfile = {
    ...currentProfile,
    teamId: target.teamId,
    territoryName: target.territoryName || target.teamId,
    areaId: target.teamId,
    areaName: target.territoryName || target.teamId,
    district: target.district ?? currentProfile.district ?? '',
    upazila: target.upazila ?? currentProfile.upazila ?? '',
    joinCode,
    updatedAt: now,
  };
  await setDoc(
    doc(db, 'users', user.uid),
    omitUndefined(updatedProfile as unknown as Record<string, unknown>),
    { merge: true }
  );
  saveCachedFirebaseProfile(updatedProfile);

  // 3. Add/update the officer in teams/{targetTeamId}/members/{uid}
  const memberDoc: MPOUser & { updatedAt: string; updatedBy: string } = {
    MPO_ID: user.uid,
    MPO_Name: updatedProfile.officerName,
    Role: updatedProfile.role || 'MPO',
    Designation: updatedProfile.role || 'MPO',
    Employee_ID: updatedProfile.employeeCode || '',
    Employee_Code: updatedProfile.employeeCode || '',
    Area_ID: updatedProfile.teamId,
    Area: updatedProfile.territoryName,
    Territory: [updatedProfile.district, updatedProfile.upazila].filter(Boolean).join(' · '),
    Phone_Number: updatedProfile.phone || '',
    Phone: updatedProfile.phone || '',
    Email: updatedProfile.email || user.email || '',
    Status: 'Active',
    updatedAt: now,
    updatedBy: user.uid,
  };
  await setDoc(
    doc(db, 'teams', updatedProfile.teamId, 'members', user.uid),
    omitUndefined(memberDoc as unknown as Record<string, unknown>),
    { merge: true }
  );

  return updatedProfile;
}

/**
 * Accepts a pending invite:
 * - `'member'`: joins the shared Team (`members` array) and switches officer's active workspace.
 * - `'superior'`: grants read-only Manager View Access (`superiorUids` array) while keeping
 *   the Superior's own private workspace intact.
 */
export async function acceptTeamInvite(
  user: User,
  currentProfile: FirebaseUserProfile,
  invite: TeamInvite
): Promise<{
  profile: FirebaseUserProfile;
  mode: 'member' | 'superior';
  targetTeamId: string;
  targetTerritoryName: string;
}> {
  const now = new Date().toISOString();
  const targetTeamId = invite.teamId || invite.areaId;
  const targetTerritoryName = invite.territoryName || invite.areaName;

  if (invite.inviteType === 'superior') {
    // 1. Atomically add Superior UID to teams/{targetTeamId}.superiorUids
    await updateDoc(
      doc(db, 'teams', targetTeamId),
      omitUndefined({
        superiorUids: arrayUnion(user.uid),
        updatedAt: now,
      })
    );

    // 2. Write Superior metadata card under teams/{targetTeamId}/superiors/{uid}
    const superiorDoc: TeamSuperior = {
      uid: user.uid,
      officerName: currentProfile.officerName || user.displayName || 'Manager',
      email: currentProfile.email || user.email || '',
      ...(currentProfile.phone ? { phone: currentProfile.phone } : {}),
      role: currentProfile.role || 'Superior',
      approvedAt: now,
      invitedByUid: invite.fromUid,
      invitedByName: invite.fromName,
    };
    await setDoc(
      doc(db, 'teams', targetTeamId, 'superiors', user.uid),
      omitUndefined(superiorDoc as unknown as Record<string, unknown>),
      { merge: true }
    );

    // 3. Mark invite accepted
    await setDoc(
      doc(db, 'invites', invite.inviteId),
      omitUndefined({ status: 'accepted', updatedAt: now }),
      { merge: true }
    );

    return {
      profile: currentProfile,
      mode: 'superior',
      targetTeamId,
      targetTerritoryName,
    };
  }

  // Member invite flow: join shared Team FIRST (while pending invite exists for rules), then mark accepted
  const updated = await switchUserToSharedTeam(user, currentProfile, {
    teamId: targetTeamId,
    territoryName: targetTerritoryName,
    district: invite.district,
    upazila: invite.upazila,
    joinCode: invite.joinCode,
  });

  await setDoc(
    doc(db, 'invites', invite.inviteId),
    omitUndefined({ status: 'accepted', updatedAt: now }),
    { merge: true }
  );

  return {
    profile: updated,
    mode: 'member',
    targetTeamId,
    targetTerritoryName,
  };
}

/**
 * Revokes a Superior's Manager View Access immediately by removing their UID from
 * `teams/{teamId}.superiorUids` and deleting `teams/{teamId}/superiors/{superiorUid}`.
 */
export async function revokeSuperiorAccess(
  teamId: string,
  superiorUid: string,
  actorUid: string
): Promise<void> {
  const now = new Date().toISOString();
  await commitFirestoreMutation(
    updateDoc(
      doc(db, 'teams', teamId),
      omitUndefined({
        superiorUids: arrayRemove(superiorUid),
        updatedBy: actorUid,
        updatedAt: now,
      })
    ),
    OperationType.UPDATE,
    `teams/${teamId}`
  );
  await commitFirestoreMutation(
    deleteDoc(doc(db, 'teams', teamId, 'superiors', superiorUid)),
    OperationType.DELETE,
    `teams/${teamId}/superiors/${superiorUid}`
  );
}

/**
 * Declines a pending invite.
 */
export async function declineTeamInvite(inviteId: string): Promise<void> {
  await setDoc(
    doc(db, 'invites', inviteId),
    omitUndefined({ status: 'declined', updatedAt: new Date().toISOString() }),
    { merge: true }
  );
}

/**
 * Joins an existing shared Team immediately using its short Join Code (e.g. DI-4829).
 * Queries `teams` where `joinCode == normalizedCode` first, with seamless fallback
 * to `joinCodes/{normalizedCode}`, adds `uid` via `arrayUnion(uid)`, and updates `users/{uid}.teamId`.
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
    teamId: string;
    territoryName: string;
    district?: string;
    upazila?: string;
    joinCode?: string;
  } | null = null;
  let lastError: unknown = null;

  // 1. Primary lookup: query `teams` where `joinCode == normalizedCode`
  try {
    const teamQuery = query(
      collection(db, 'teams'),
      where('joinCode', '==', normalizedCode),
      limit(1)
    );
    const snap = await getDocs(teamQuery);
    if (!snap.empty) {
      const first = snap.docs[0];
      const d = first.data() as Partial<TeamWorkspaceMeta>;
      const resolvedId = String(d.teamId || first.id).trim();
      if (resolvedId) {
        target = {
          teamId: resolvedId,
          territoryName: String(d.territoryName || resolvedId),
          district: d.district ? String(d.district) : '',
          upazila: d.upazila ? String(d.upazila) : '',
          joinCode: String(d.joinCode || normalizedCode),
        };
      }
    }
  } catch (err) {
    lastError = err;
  }

  // 2. Fallback lookup: direct `joinCodes/{DI-XXXX}` document
  if (!target) {
    try {
      const codeSnap = await getDoc(doc(db, 'joinCodes', normalizedCode));
      if (codeSnap.exists()) {
        const d = codeSnap.data() as Record<string, unknown>;
        const resolvedId = String(d.teamId || d.areaId || '').trim();
        if (resolvedId) {
          target = {
            teamId: resolvedId,
            territoryName: String(d.territoryName || d.areaName || resolvedId),
            district: d.district ? String(d.district) : '',
            upazila: d.upazila ? String(d.upazila) : '',
            joinCode: String(d.joinCode || normalizedCode),
          };
        }
      }
    } catch (err) {
      if (!lastError) lastError = err;
    }
  }

  if (!target) {
    if (lastError) {
      throw new Error(formatFirebaseAuthError(lastError));
    }
    throw new Error(
      `No Team found for code "${normalizedCode}". Double-check the Join Code shared by your teammate.`
    );
  }

  const currentTeamId = currentProfile.teamId || currentProfile.areaId;
  if (target.teamId === currentTeamId) {
    throw new Error(`You are already a member of ${target.territoryName}.`);
  }

  return switchUserToSharedTeam(user, currentProfile, { ...target, joinedByCode: true });
}
