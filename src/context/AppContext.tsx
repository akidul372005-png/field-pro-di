import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  Area,
  AreaNote,
  Chamber,
  Department,
  Doctor,
  FieldDataset,
  FirebaseUserProfile,
  Hospital,
  MPOUser,
  NavTab,
  Product,
  QueuedMutation,
  SheetName,
  TeamSession,
  ToastNotification,
} from '../types';
import { auth, testFirestoreConnection } from '../lib/firebase';
import {
  TeamRegistrationInput,
  clearCachedFirebaseProfile,
  deleteAreaChamber,
  deleteAreaDoctor,
  deleteAreaHospital,
  deleteAreaMember,
  deleteAreaNote,
  fetchUserProfileFromFirestore,
  formatFirebaseAuthError,
  getCachedFirebaseProfile,
  profileToTeamSession,
  registerTeamUserWithFirebase,
  resolveGoogleRedirectResult,
  saveAreaChamber,
  saveAreaDoctor,
  saveAreaHospital,
  saveAreaMember,
  saveAreaNote,
  saveUserAndAreaDocs,
  signInTeamUserWithFirebase,
  signInTeamWithGoogle,
  signOutTeamUserFromFirebase,
  subscribeToAreaWorkspace,
} from '../services/firebaseTeam';
import {
  DEFAULT_API_URL,
  DEFAULT_APPS_SCRIPT_URL,
  SHEET_PRIMARY_KEY,
  SuperAdminConfigSource,
  applyMutationLocally,
  authenticateAreaTeam,
  authenticateMpoUser,
  changeSuperAdminPasscodeOnServer,
  clearLegacyPendingGroupUpdates,
  clearTeamSession,
  fetchAllDataFromAppsScript,
  fetchSuperAdminStatus,
  getLastSyncTime,
  getSavedActiveMpoId,
  getSavedApiUrl,
  getSavedSuperAdminSession,
  getSavedTeamPin,
  getSavedTeamSession,
  getSavedTheme,
  isConfiguredApiUrl,
  loadCachedDataset,
  loadSyncQueue,
  loginSuperAdminOnServer,
  logoutSuperAdminOnServer,
  matchSpecialistName,
  postMutationToAppsScript,
  resetCachedDatasetToStarter,
  saveActiveMpoId,
  saveApiUrl,
  saveCachedDataset,
  saveLastSyncTime,
  saveSyncQueue,
  saveTeamPin,
  saveTeamSession,
  saveTheme,
  setupSuperAdminPasscodeOnServer,
} from '../services/api';

const MASTER_DATA_SHEETS = new Set<string>([
  'Products',
  'Doctor_Product_Detailing',
  'Indications',
  'Departments',
  'MPO_Desk',
  'Medical_Knowledge',
]);

export interface RecordModalState {
  mode: 'add' | 'edit';
  sheet: SheetName;
  initialRecord?: Record<string, unknown>;
}

export interface DeleteTargetState {
  sheet: SheetName;
  record: Record<string, unknown>;
  displayLabel?: string;
}

interface AppContextValue {
  dataset: FieldDataset;
  apiUrl: string;
  isApiConfigured: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  isLoadingData: boolean;
  lastSyncedAt: string | null;
  syncQueue: QueuedMutation[];
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  navigateHome: () => void;

  // Team / Area Session (Firebase Auth + Cloud Firestore private workspace — works online & offline)
  teamSession: TeamSession | null;
  firebaseAuthReady: boolean;
  firebaseUserEmail: string | null;
  firebaseUserName: string | null;
  needsFirebaseAreaSetup: boolean;
  firebaseSyncError: string | null;
  areaNotes: AreaNote[];
  teamPinConfigured: boolean;
  loginTeamWithGoogle: () => Promise<{ ok: boolean; redirected?: boolean; error?: string }>;
  loginTeamWithFirebase: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  registerTeamWithFirebase: (
    input: TeamRegistrationInput
  ) => Promise<{ ok: boolean; error?: string }>;
  completeFirebaseAreaProfile: (
    input: Omit<TeamRegistrationInput, 'email' | 'password'>
  ) => Promise<{ ok: boolean; error?: string }>;
  saveTeamAreaNote: (note: {
    Note_ID?: string;
    Title: string;
    Content: string;
    Category?: string;
    Pinned?: boolean;
    Created_At?: string;
  }) => Promise<boolean>;
  deleteTeamAreaNote: (noteId: string) => Promise<boolean>;
  loginWithAreaPin: (areaId: string, pin: string) => { ok: boolean; error?: string };
  loginWithMpoCredentials: (identifier: string, pin: string) => { ok: boolean; error?: string };
  logoutTeam: () => void;
  updateTeamPin: (newPin: string) => boolean;

  // Super Admin Mode (Server-verified Bearer token held in memory — strictly Read-Only for non-admins)
  isSuperAdmin: boolean;
  superAdminSource: SuperAdminConfigSource | 'loading';
  refreshSuperAdminStatus: () => Promise<void>;
  setupSuperAdmin: (passcode: string) => Promise<{ ok: boolean; error?: string }>;
  loginSuperAdmin: (passcode: string) => Promise<{ ok: boolean; error?: string }>;
  changeSuperAdminPasscode: (
    currentPasscode: string,
    newPasscode: string
  ) => Promise<{ ok: boolean; error?: string }>;
  logoutSuperAdmin: () => Promise<void>;

  // Active MPO reference for record forms
  activeMpoId: string;
  setActiveMpoId: (mpoId: string) => void;
  activeMpo: MPOUser | undefined;

  theme: 'light' | 'dark';
  toggleTheme: () => void;
  toasts: ToastNotification[];
  pushToast: (toast: Omit<ToastNotification, 'id'>) => void;
  dismissToast: (id: string) => void;

  // Global CRUD modal states
  recordModal: RecordModalState | null;
  openAddModal: (sheet: SheetName, initialValues?: Record<string, unknown>) => void;
  openEditModal: (sheet: SheetName, record: Record<string, unknown>) => void;
  closeRecordModal: () => void;
  deleteTarget: DeleteTargetState | null;
  isDeleting: boolean;
  requestDeleteRecord: (
    sheet: SheetName,
    record: Record<string, unknown>,
    displayLabel?: string
  ) => void;
  closeDeleteConfirm: () => void;
  confirmDeleteRecord: () => Promise<void>;

  // Cross-screen contextual handoffs
  selectedDoctorId: string | null;
  setSelectedDoctorId: (id: string | null) => void;
  selectedSpecialistId: string | null;
  setSelectedSpecialistId: (id: string | null) => void;
  selectedProductId: string | null;
  setSelectedProductId: (id: string | null) => void;
  openProductBrief: (productId: string) => void;
  prefillDetailing: {
    doctorId?: string;
    productId?: string;
    genericName?: string;
    specialist?: string;
    subTab?: 'catalog' | 'detailing';
  } | null;
  setPrefillDetailing: (
    val: {
      doctorId?: string;
      productId?: string;
      genericName?: string;
      specialist?: string;
      subTab?: 'catalog' | 'detailing';
    } | null
  ) => void;
  doctorDirectoryHospitalFilter: string;
  setDoctorDirectoryHospitalFilter: (hospitalId: string) => void;
  doctorDirectoryAreaFilter: string;
  setDoctorDirectoryAreaFilter: (areaId: string) => void;
  doctorDirectorySpecialtyFilter: string;
  setDoctorDirectorySpecialtyFilter: (specialty: string) => void;

  // Navigation shortcuts
  openDoctorProfile: (doctorId: string) => void;
  openSpecialistDetail: (specialistNameOrId: string) => void;
  startDetailingFlow: (opts: {
    doctorId?: string;
    productId?: string;
    genericName?: string;
    specialist?: string;
    subTab?: 'catalog' | 'detailing';
  }) => void;

  // Data operations
  updateApiUrl: (url: string) => void;
  refreshFromServer: (silent?: boolean) => Promise<boolean>;
  syncPendingQueue: (silent?: boolean) => Promise<{ synced: number; failed: number }>;
  flushPendingQueueNow: () => Promise<{ synced: number; failed: number }>;
  queueBatchUpdates: (sheet: SheetName, records: Record<string, unknown>[]) => void;
  submitRecord: (
    action: 'add' | 'update' | 'delete',
    sheet: SheetName,
    data: Record<string, unknown>
  ) => Promise<{ syncedImmediately: boolean }>;
  removeQueuedItem: (queueId: string) => void;
  clearSyncQueue: () => void;
  resetLocalStarterData: () => void;

  // Lookup maps
  areaMap: Map<string, Area>;
  hospitalMap: Map<string, Hospital>;
  doctorMap: Map<string, Doctor>;
  departmentMap: Map<string, Department>;
  productMap: Map<string, Product>;
  mpoMap: Map<string, MPOUser>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sheetDataset, setDataset] = useState<FieldDataset>(() => {
    clearLegacyPendingGroupUpdates();
    return loadCachedDataset();
  });
  const [apiUrl, setApiUrl] = useState<string>(() => getSavedApiUrl());
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => getLastSyncTime());
  const [syncQueue, setSyncQueue] = useState<QueuedMutation[]>(() => loadSyncQueue());
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [firebaseAuthReady, setFirebaseAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [firebaseProfile, setFirebaseProfile] = useState<FirebaseUserProfile | null>(() =>
    getCachedFirebaseProfile()
  );
  const [firebaseSyncError, setFirebaseSyncError] = useState<string | null>(null);
  const [firebaseDoctors, setFirebaseDoctors] = useState<Doctor[]>([]);
  const [firebaseChambers, setFirebaseChambers] = useState<Chamber[]>([]);
  const [firebaseHospitals, setFirebaseHospitals] = useState<Hospital[]>([]);
  const [firebaseMembers, setFirebaseMembers] = useState<MPOUser[]>([]);
  const [areaNotes, setAreaNotes] = useState<AreaNote[]>([]);

  const [teamSession, setTeamSession] = useState<TeamSession | null>(() => {
    const cachedProfile = getCachedFirebaseProfile();
    if (cachedProfile) return profileToTeamSession(cachedProfile);
    const saved = getSavedTeamSession();
    return saved?.loginMode === 'firebase' ? saved : null;
  });
  const [teamPinConfigured, setTeamPinConfigured] = useState<boolean>(() =>
    Boolean(getSavedTeamPin())
  );
  // Client-verified Super Admin session persisted in sessionStorage (zero /api/ dependency)
  const [superAdminToken, setSuperAdminToken] = useState<string | null>(
    () => getSavedSuperAdminSession()?.token ?? null
  );
  const [superAdminSource, setSuperAdminSource] = useState<SuperAdminConfigSource | 'loading'>(
    'loading'
  );
  const isSuperAdmin = Boolean(superAdminToken);

  const [activeMpoId, setActiveMpoIdState] = useState<string>(() => getSavedActiveMpoId());
  const [theme, setTheme] = useState<'light' | 'dark'>(() => getSavedTheme());
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Global CRUD modals
  const [recordModal, setRecordModal] = useState<RecordModalState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTargetState | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Cross-screen states
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [prefillDetailing, setPrefillDetailing] = useState<{
    doctorId?: string;
    productId?: string;
    genericName?: string;
    specialist?: string;
    subTab?: 'catalog' | 'detailing';
  } | null>(null);
  const [doctorDirectoryHospitalFilter, setDoctorDirectoryHospitalFilter] = useState('');
  const [doctorDirectoryAreaFilter, setDoctorDirectoryAreaFilter] = useState('');
  const [doctorDirectorySpecialtyFilter, setDoctorDirectorySpecialtyFilter] = useState('');

  const syncInFlightRef = useRef(false);
  const syncQueueRef = useRef<QueuedMutation[]>(syncQueue);
  const inFlightQueueIdRef = useRef<string | null>(null);
  const autoFlushTimerRef = useRef<number | null>(null);
  const datasetSaveTimerRef = useRef<number | null>(null);
  const pendingDatasetSaveRef = useRef<FieldDataset | null>(null);
  const isApiConfigured = isConfiguredApiUrl(apiUrl);

  const scheduleDatasetPersist = useCallback((nextDataset: FieldDataset) => {
    pendingDatasetSaveRef.current = nextDataset;
    if (datasetSaveTimerRef.current !== null) {
      window.clearTimeout(datasetSaveTimerRef.current);
    }
    datasetSaveTimerRef.current = window.setTimeout(() => {
      if (pendingDatasetSaveRef.current) {
        saveCachedDataset(pendingDatasetSaveRef.current);
        pendingDatasetSaveRef.current = null;
      }
      datasetSaveTimerRef.current = null;
    }, 350);
  }, []);

  useEffect(() => {
    const flushPendingDataset = () => {
      if (pendingDatasetSaveRef.current) {
        saveCachedDataset(pendingDatasetSaveRef.current);
        pendingDatasetSaveRef.current = null;
      }
    };
    window.addEventListener('beforeunload', flushPendingDataset);
    return () => {
      window.removeEventListener('beforeunload', flushPendingDataset);
      if (datasetSaveTimerRef.current !== null) {
        window.clearTimeout(datasetSaveTimerRef.current);
      }
      if (autoFlushTimerRef.current !== null) {
        window.clearTimeout(autoFlushTimerRef.current);
      }
      flushPendingDataset();
    };
  }, []);

  const pushToast = useCallback((toast: Omit<ToastNotification, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Apply Dark Mode class cleanly to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    saveTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setActiveMpoId = useCallback((mpoId: string) => {
    setActiveMpoIdState(mpoId);
    saveActiveMpoId(mpoId);
  }, []);

  // Keep Public Dashboard strictly from Google Sheets while scoping Team records strictly to Firestore areas/{areaId}
  const dataset = useMemo<FieldDataset>(() => {
    if (teamSession?.loginMode === 'firebase' && firebaseProfile) {
      const firebaseAreaRecord: Area = {
        Area_ID: firebaseProfile.areaId,
        Area_Name: firebaseProfile.areaName,
        District: firebaseProfile.district,
        Zone: firebaseProfile.upazila || firebaseProfile.district,
        Territory: firebaseProfile.upazila || firebaseProfile.district,
        Status: 'Active',
      };
      return {
        ...sheetDataset,
        Areas: [firebaseAreaRecord],
        Doctors: firebaseDoctors,
        Chambers: firebaseChambers,
        Hospitals: firebaseHospitals,
        MPO_Users: firebaseMembers,
      };
    }
    return sheetDataset;
  }, [
    sheetDataset,
    teamSession?.loginMode,
    firebaseProfile,
    firebaseDoctors,
    firebaseChambers,
    firebaseHospitals,
    firebaseMembers,
  ]);

  // Lightweight Firestore connectivity check on boot
  useEffect(() => {
    void testFirestoreConnection();
  }, []);

  // Firebase Auth listener + Google redirect completion — keeps Team users signed in offline automatically
  useEffect(() => {
    let active = true;

    void resolveGoogleRedirectResult().then((redirected) => {
      if (!active || !redirected) return;
      if (redirected.profile) {
        setFirebaseProfile(redirected.profile);
        const session = profileToTeamSession(redirected.profile);
        setTeamSession(session);
        saveTeamSession(session);
      }
      setActiveTab('team');
    });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!active) return;
      setFirebaseUser(user);

      if (!user) {
        setFirebaseProfile(null);
        clearCachedFirebaseProfile();
        setFirebaseDoctors([]);
        setFirebaseChambers([]);
        setFirebaseHospitals([]);
        setFirebaseMembers([]);
        setAreaNotes([]);
        setFirebaseSyncError(null);
        setTeamSession((prev) => {
          if (prev?.loginMode === 'firebase') {
            clearTeamSession();
            return null;
          }
          return prev;
        });
        setFirebaseAuthReady(true);
        return;
      }

      // Immediately restore cached profile if available (instant offline experience)
      const cached = getCachedFirebaseProfile(user.uid);
      if (cached) {
        setFirebaseProfile(cached);
        const cachedSession = profileToTeamSession(cached);
        setTeamSession(cachedSession);
        saveTeamSession(cachedSession);
      }

      const freshProfile = await fetchUserProfileFromFirestore(user.uid);
      if (!active) return;
      if (freshProfile) {
        setFirebaseProfile(freshProfile);
        const nextSession = profileToTeamSession(freshProfile);
        setTeamSession(nextSession);
        saveTeamSession(nextSession);
      } else if (!cached) {
        setFirebaseProfile(null);
        setTeamSession(null);
        clearTeamSession();
      }
      setFirebaseAuthReady(true);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Real-time Firestore subscriptions strictly scoped to areas/{areaId} (works offline via IndexedDB cache)
  useEffect(() => {
    if (!firebaseUser || !firebaseProfile?.areaId) {
      return;
    }

    setFirebaseSyncError(null);
    const unsub = subscribeToAreaWorkspace(firebaseProfile.areaId, {
      onDoctors: (rows) => {
        setFirebaseDoctors(rows);
        setFirebaseSyncError(null);
      },
      onChambers: (rows) => setFirebaseChambers(rows),
      onHospitals: (rows) => setFirebaseHospitals(rows),
      onMembers: (rows) => setFirebaseMembers(rows),
      onNotes: (rows) => setAreaNotes(rows),
      onError: (msg) => setFirebaseSyncError(msg),
    });

    return () => {
      unsub();
    };
  }, [firebaseUser, firebaseProfile?.areaId]);

  const needsFirebaseAreaSetup = Boolean(firebaseUser && firebaseAuthReady && !firebaseProfile);

  // Firebase Team Authentication handlers
  const loginTeamWithGoogle = useCallback(async (): Promise<{
    ok: boolean;
    redirected?: boolean;
    error?: string;
  }> => {
    try {
      const result = await signInTeamWithGoogle();
      if (result.redirected) {
        return { ok: true, redirected: true };
      }
      if (result.profile) {
        setFirebaseProfile(result.profile);
        const session = profileToTeamSession(result.profile);
        setTeamSession(session);
        saveTeamSession(session);
        pushToast({
          type: 'success',
          title: `Signed in to ${result.profile.areaName}`,
          message: 'Private area workspace unlocked and cached for offline use.',
        });
      } else {
        pushToast({
          type: 'info',
          title: 'Complete your Area Profile',
          message: 'Enter your District and Upazila / Area Name to unlock your workspace.',
        });
      }
      return { ok: true, redirected: false };
    } catch (err) {
      return { ok: false, error: formatFirebaseAuthError(err) };
    }
  }, [pushToast]);

  const loginTeamWithFirebase = useCallback(
    async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const { profile } = await signInTeamUserWithFirebase(email, password);
        if (profile) {
          setFirebaseProfile(profile);
          const session = profileToTeamSession(profile);
          setTeamSession(session);
          saveTeamSession(session);
          pushToast({
            type: 'success',
            title: `Signed in to ${profile.areaName}`,
            message: 'Private area workspace unlocked and cached for offline use.',
          });
        } else {
          pushToast({
            type: 'info',
            title: 'Complete your Area Profile',
            message: 'Enter your District, Upazila, and Area Name to finish setup.',
          });
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, error: formatFirebaseAuthError(err) };
      }
    },
    [pushToast]
  );

  const registerTeamWithFirebase = useCallback(
    async (input: TeamRegistrationInput): Promise<{ ok: boolean; error?: string }> => {
      try {
        const profile = await registerTeamUserWithFirebase(input);
        setFirebaseProfile(profile);
        const session = profileToTeamSession(profile);
        setTeamSession(session);
        saveTeamSession(session);
        pushToast({
          type: 'success',
          title: `Welcome, ${profile.officerName}`,
          message: `${profile.areaName} private workspace is ready and synced with Firebase.`,
        });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: formatFirebaseAuthError(err) };
      }
    },
    [pushToast]
  );

  const completeFirebaseAreaProfile = useCallback(
    async (
      input: Omit<TeamRegistrationInput, 'email' | 'password'>
    ): Promise<{ ok: boolean; error?: string }> => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return { ok: false, error: 'Please sign in again first.' };
      }
      try {
        const profile = await saveUserAndAreaDocs(currentUser, input);
        setFirebaseProfile(profile);
        const session = profileToTeamSession(profile);
        setTeamSession(session);
        saveTeamSession(session);
        pushToast({
          type: 'success',
          title: `${profile.areaName} configured`,
          message: 'Your private area workspace is ready.',
        });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: formatFirebaseAuthError(err) };
      }
    },
    [pushToast]
  );

  const saveTeamAreaNote = useCallback(
    async (note: {
      Note_ID?: string;
      Title: string;
      Content: string;
      Category?: string;
      Pinned?: boolean;
      Created_At?: string;
    }): Promise<boolean> => {
      if (!firebaseUser || !firebaseProfile?.areaId) {
        pushToast({
          type: 'warning',
          title: 'Sign in required',
          message: 'Sign in to your Firebase Team workspace to save area notes.',
        });
        return false;
      }
      try {
        await saveAreaNote(firebaseProfile.areaId, note, {
          uid: firebaseUser.uid,
          name: firebaseProfile.officerName,
        });
        pushToast({
          type: 'success',
          title: note.Note_ID ? 'Area note updated' : 'Area note saved',
          message: navigator.onLine
            ? 'Synced to your private area workspace.'
            : 'Saved offline — will sync automatically when online.',
        });
        return true;
      } catch (err) {
        pushToast({
          type: 'error',
          title: 'Could not save note',
          message: formatFirebaseAuthError(err),
        });
        return false;
      }
    },
    [firebaseUser, firebaseProfile, pushToast]
  );

  const deleteTeamAreaNote = useCallback(
    async (noteId: string): Promise<boolean> => {
      if (!firebaseUser || !firebaseProfile?.areaId) return false;
      try {
        await deleteAreaNote(firebaseProfile.areaId, noteId);
        pushToast({
          type: 'info',
          title: 'Area note deleted',
        });
        return true;
      } catch (err) {
        pushToast({
          type: 'error',
          title: 'Could not delete note',
          message: formatFirebaseAuthError(err),
        });
        return false;
      }
    },
    [firebaseUser, firebaseProfile, pushToast]
  );

  // Team Login & Logout handlers (legacy fallback preserved for compatibility)
  const loginWithAreaPin = useCallback(
    (areaId: string, pin: string): { ok: boolean; error?: string } => {
      const result = authenticateAreaTeam(sheetDataset, areaId, pin);
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      setTeamSession(result.session);
      saveTeamSession(result.session);
      if (result.session.mpoId) {
        setActiveMpoId(result.session.mpoId);
      }
      pushToast({
        type: 'success',
        title: `Signed in to ${result.session.areaName}`,
        message: 'Area Doctors, Chambers, Hospitals & Team Directory unlocked (available offline).',
      });
      return { ok: true };
    },
    [sheetDataset, pushToast, setActiveMpoId]
  );

  const loginWithMpoCredentials = useCallback(
    (identifier: string, pin: string): { ok: boolean; error?: string } => {
      const result = authenticateMpoUser(sheetDataset, identifier, pin);
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      setTeamSession(result.session);
      saveTeamSession(result.session);
      if (result.session.mpoId) {
        setActiveMpoId(result.session.mpoId);
      }
      pushToast({
        type: 'success',
        title: `Welcome, ${result.session.mpoName || result.session.areaName}`,
        message: `${result.session.areaName} workspace unlocked & cached for offline use.`,
      });
      return { ok: true };
    },
    [sheetDataset, pushToast, setActiveMpoId]
  );

  const logoutTeam = useCallback(() => {
    if (firebaseUser) {
      void signOutTeamUserFromFirebase().catch(() => {
        // Best-effort sign out
      });
    }
    setFirebaseProfile(null);
    clearCachedFirebaseProfile();
    setFirebaseDoctors([]);
    setFirebaseChambers([]);
    setFirebaseHospitals([]);
    setFirebaseMembers([]);
    setAreaNotes([]);
    setFirebaseSyncError(null);
    setTeamSession(null);
    clearTeamSession();
    setSelectedDoctorId(null);
    setDoctorDirectoryAreaFilter('');
    setDoctorDirectoryHospitalFilter('');
    setDoctorDirectorySpecialtyFilter('');
    pushToast({
      type: 'info',
      title: 'Signed out of Team Workspace',
      message: 'Public Dashboard remains accessible anytime.',
    });
  }, [firebaseUser, pushToast]);

  const updateTeamPin = useCallback(
    (newPin: string): boolean => {
      const cleaned = newPin.trim();
      if (cleaned.length > 0 && cleaned.length < 4) {
        pushToast({
          type: 'warning',
          title: 'PIN too short',
          message: 'Use at least 4 characters or digits for the local Team PIN.',
        });
        return false;
      }
      saveTeamPin(cleaned);
      setTeamPinConfigured(Boolean(cleaned));
      pushToast({
        type: 'success',
        title: cleaned ? 'Local Team PIN updated' : 'Local Team PIN cleared',
        message: cleaned
          ? 'Saved locally on this device for offline Area login.'
          : 'Area login will use your synced Google Sheet Team_PIN or Area ID.',
      });
      return true;
    },
    [pushToast]
  );

  const refreshSuperAdminStatus = useCallback(async () => {
    const status = await fetchSuperAdminStatus(superAdminToken);
    setSuperAdminSource(status.source);
    if (superAdminToken && !status.authenticated) {
      setSuperAdminToken(null);
    }
  }, [superAdminToken]);

  useEffect(() => {
    void refreshSuperAdminStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setupSuperAdmin = useCallback(
    async (passcode: string): Promise<{ ok: boolean; error?: string }> => {
      const result = await setupSuperAdminPasscodeOnServer(passcode);
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      setSuperAdminToken(result.token);
      setSuperAdminSource(result.source);
      pushToast({
        type: 'success',
        title: 'Super Admin Mode unlocked',
        message: 'Master data Add, Edit & Delete controls are now enabled for this session.',
      });
      return { ok: true };
    },
    [pushToast]
  );

  const loginSuperAdmin = useCallback(
    async (passcode: string): Promise<{ ok: boolean; error?: string }> => {
      const result = await loginSuperAdminOnServer(passcode);
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      setSuperAdminToken(result.token);
      setSuperAdminSource(result.source);
      pushToast({
        type: 'success',
        title: 'Super Admin Mode active',
        message: 'Master data editing controls are unlocked until you log out.',
      });
      return { ok: true };
    },
    [pushToast]
  );

  const changeSuperAdminPasscode = useCallback(
    async (
      currentPasscode: string,
      newPasscode: string
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!superAdminToken) {
        return { ok: false, error: 'Sign in as Super Admin first.' };
      }
      const res = await changeSuperAdminPasscodeOnServer(
        superAdminToken,
        currentPasscode,
        newPasscode
      );
      if (res.ok) {
        pushToast({
          type: 'success',
          title: 'Super Admin passcode updated',
          message: 'Use your new passcode the next time you unlock Super Admin Mode.',
        });
      }
      return res;
    },
    [superAdminToken, pushToast]
  );

  const logoutSuperAdmin = useCallback(async () => {
    const tokenToRevoke = superAdminToken;
    setSuperAdminToken(null);
    setRecordModal((prev) => (prev && MASTER_DATA_SHEETS.has(prev.sheet) ? null : prev));
    setDeleteTarget((prev) => (prev && MASTER_DATA_SHEETS.has(prev.sheet) ? null : prev));
    await logoutSuperAdminOnServer(tokenToRevoke);
    pushToast({
      type: 'info',
      title: 'Signed out of Super Admin Mode',
      message: 'All master data modules are now locked in Read-Only mode.',
    });
  }, [superAdminToken, pushToast]);

  const navigateHome = useCallback(() => {
    setSelectedDoctorId(null);
    setSelectedProductId(null);
    setSelectedSpecialistId(null);
    setRecordModal(null);
    setActiveTab('dashboard');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const openAddModal = useCallback(
    (sheet: SheetName, initialValues?: Record<string, unknown>) => {
      if (MASTER_DATA_SHEETS.has(sheet) && !isSuperAdmin) {
        pushToast({
          type: 'warning',
          title: 'Read-Only Mode',
          message: 'Unlock Super Admin Mode in Settings to add master data records.',
        });
        return;
      }
      setRecordModal({ mode: 'add', sheet, initialRecord: initialValues });
    },
    [isSuperAdmin, pushToast]
  );

  const openEditModal = useCallback(
    (sheet: SheetName, record: Record<string, unknown>) => {
      if (MASTER_DATA_SHEETS.has(sheet) && !isSuperAdmin) {
        pushToast({
          type: 'warning',
          title: 'Read-Only Mode',
          message: 'Unlock Super Admin Mode in Settings to edit master data records.',
        });
        return;
      }
      setRecordModal({ mode: 'edit', sheet, initialRecord: record });
    },
    [isSuperAdmin, pushToast]
  );

  const closeRecordModal = useCallback(() => {
    setRecordModal(null);
  }, []);

  const requestDeleteRecord = useCallback(
    (sheet: SheetName, record: Record<string, unknown>, displayLabel?: string) => {
      if (MASTER_DATA_SHEETS.has(sheet) && !isSuperAdmin) {
        pushToast({
          type: 'warning',
          title: 'Read-Only Mode',
          message: 'Unlock Super Admin Mode in Settings to delete master data records.',
        });
        return;
      }
      setDeleteTarget({ sheet, record, displayLabel });
    },
    [isSuperAdmin, pushToast]
  );

  const closeDeleteConfirm = useCallback(() => {
    if (!isDeleting) {
      setDeleteTarget(null);
    }
  }, [isDeleting]);

  const updateApiUrl = useCallback(
    (url: string) => {
      const cleaned = url.trim() || DEFAULT_API_URL;
      setApiUrl(cleaned);
      saveApiUrl(cleaned);

      const validUrl = isConfiguredApiUrl(cleaned);
      pushToast({
        type: 'success',
        title: 'Web App URL saved',
        message: validUrl
          ? 'Ready to sync directly with Google Sheets.'
          : 'Reverted to default endpoint.',
      });
    },
    [pushToast]
  );

  // Hydrate built-in DEFAULT_APPS_SCRIPT_URL directly on client (zero /api/ dependency)
  useEffect(() => {
    if (isConfiguredApiUrl(DEFAULT_APPS_SCRIPT_URL)) {
      setApiUrl((prev) => {
        if (isConfiguredApiUrl(prev)) return prev;
        saveApiUrl(DEFAULT_APPS_SCRIPT_URL);
        return DEFAULT_APPS_SCRIPT_URL;
      });
    }
  }, []);

  const refreshFromServer = useCallback(
    async (silent = false): Promise<boolean> => {
      let targetUrl = apiUrl;
      if (!isConfiguredApiUrl(targetUrl) && isConfiguredApiUrl(DEFAULT_APPS_SCRIPT_URL)) {
        targetUrl = DEFAULT_APPS_SCRIPT_URL;
        setApiUrl(targetUrl);
        saveApiUrl(targetUrl);
      }

      if (!isConfiguredApiUrl(targetUrl)) {
        if (!silent) {
          pushToast({
            type: 'info',
            title: 'Up to date (offline cache)',
            message: 'Configure your Google Apps Script Web App URL in Settings → Super Admin.',
          });
        }
        return false;
      }

      if (!navigator.onLine) {
        if (!silent) {
          pushToast({
            type: 'warning',
            title: 'Device is offline',
            message: 'Displaying cached field data from local storage.',
          });
        }
        return false;
      }

      setIsLoadingData(true);
      try {
        const fetched = await fetchAllDataFromAppsScript(targetUrl);
        setDataset(fetched);
        saveCachedDataset(fetched);
        const nowIso = new Date().toISOString();
        setLastSyncedAt(nowIso);
        saveLastSyncTime(nowIso);

        if (
          fetched.MPO_Users.length > 0 &&
          !fetched.MPO_Users.some((m) => m.MPO_ID === activeMpoId)
        ) {
          setActiveMpoId(fetched.MPO_Users[0].MPO_ID);
        }

        if (!silent) {
          pushToast({
            type: 'success',
            title: 'Field data updated',
            message: `Synced ${fetched.Products.length} products, ${fetched.Doctor_Product_Detailing.length} detailing scripts, and ${fetched.MPO_Desk.length + fetched.Medical_Knowledge.length} knowledge chapters.`,
          });
        }
        return true;
      } catch (err) {
        if (!silent) {
          pushToast({
            type: 'error',
            title: 'Sync failed — using cached data',
            message: err instanceof Error ? err.message : 'Unable to reach Apps Script Web App.',
          });
        }
        return false;
      } finally {
        setIsLoadingData(false);
      }
    },
    [apiUrl, activeMpoId, pushToast, setActiveMpoId]
  );

  const syncPendingQueue = useCallback(
    async (
      silent = false,
      options?: { skipRefreshAfter?: boolean }
    ): Promise<{ synced: number; failed: number }> => {
      const initialQueue = syncQueueRef.current.length > 0 ? syncQueueRef.current : loadSyncQueue();
      if (initialQueue.length === 0) {
        return { synced: 0, failed: 0 };
      }
      syncQueueRef.current = [...initialQueue];

      if (!isConfiguredApiUrl(apiUrl)) {
        if (!silent) {
          pushToast({
            type: 'warning',
            title: 'Configure Web App URL to sync',
            message: `${syncQueueRef.current.length} local entr${
              syncQueueRef.current.length === 1 ? 'y is' : 'ies are'
            } waiting in the queue.`,
          });
        }
        return { synced: 0, failed: syncQueueRef.current.length };
      }

      if (!navigator.onLine) {
        if (!silent) {
          pushToast({
            type: 'warning',
            title: 'Still offline',
            message: 'Queued entries will automatically sync when internet returns.',
          });
        }
        return { synced: 0, failed: syncQueueRef.current.length };
      }

      if (syncInFlightRef.current) {
        return { synced: 0, failed: 0 };
      }

      syncInFlightRef.current = true;
      setIsSyncing(true);

      let syncedCount = 0;
      let failedCount = 0;
      let firstErrorMsg = '';
      const failedIds = new Set<string>();

      try {
        while (navigator.onLine && isConfiguredApiUrl(apiUrl)) {
          const nextItem = syncQueueRef.current.find((q) => !failedIds.has(q.queueId));
          if (!nextItem) break;

          inFlightQueueIdRef.current = nextItem.queueId;
          try {
            await postMutationToAppsScript(apiUrl, {
              action: nextItem.action,
              sheet: nextItem.sheet,
              data: nextItem.data,
            });
            syncedCount += 1;
            syncQueueRef.current = syncQueueRef.current.filter(
              (q) => q.queueId !== nextItem.queueId
            );
            setSyncQueue([...syncQueueRef.current]);
            saveSyncQueue(syncQueueRef.current);

            const nowIso = new Date().toISOString();
            setLastSyncedAt(nowIso);
            saveLastSyncTime(nowIso);
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Network error';
            if (!firstErrorMsg) firstErrorMsg = errMsg;
            failedCount += 1;
            failedIds.add(nextItem.queueId);
            syncQueueRef.current = syncQueueRef.current.map((q) =>
              q.queueId === nextItem.queueId ? { ...q, lastError: errMsg } : q
            );
            setSyncQueue([...syncQueueRef.current]);
            saveSyncQueue(syncQueueRef.current);
          } finally {
            inFlightQueueIdRef.current = null;
          }
        }
      } finally {
        setIsSyncing(false);
        syncInFlightRef.current = false;
      }

      const remainingLen = syncQueueRef.current.length;

      if (syncedCount > 0) {
        if (!silent) {
          pushToast({
            type: 'success',
            title: `Saved ${syncedCount} change${syncedCount === 1 ? '' : 's'} to Google Sheets`,
            message:
              remainingLen > 0
                ? `${remainingLen} item${remainingLen === 1 ? '' : 's'} still pending.`
                : 'All pending changes are now synced.',
          });
        }
        if (remainingLen === 0 && !options?.skipRefreshAfter) {
          void refreshFromServer(true);
        }
      } else if (!silent && failedCount > 0) {
        pushToast({
          type: 'error',
          title: 'Could not sync queued entries',
          message: firstErrorMsg || 'Check your Web App URL and network connection.',
        });
      }

      return { synced: syncedCount, failed: remainingLen };
    },
    [apiUrl, pushToast, refreshFromServer]
  );

  const flushPendingQueueNow = useCallback(async (): Promise<{
    synced: number;
    failed: number;
  }> => {
    if (autoFlushTimerRef.current !== null) {
      window.clearTimeout(autoFlushTimerRef.current);
      autoFlushTimerRef.current = null;
    }
    return syncPendingQueue(false, { skipRefreshAfter: true });
  }, [syncPendingQueue]);

  const queueBatchUpdates = useCallback(
    (sheet: SheetName, records: Record<string, unknown>[]) => {
      if (records.length === 0) return;
      if (MASTER_DATA_SHEETS.has(sheet) && !isSuperAdmin) return;

      const idKey = SHEET_PRIMARY_KEY[sheet];
      const patchById = new Map<string, Record<string, unknown>>();
      records.forEach((rec) => {
        const id = String(rec[idKey] ?? '').trim();
        if (id) {
          patchById.set(id, rec);
        }
      });
      if (patchById.size === 0) return;

      setDataset((prev) => {
        const currentList = prev[sheet] as unknown as Record<string, unknown>[];
        const nextList = currentList.map((item) => {
          const itemId = String(item[idKey] ?? '').trim();
          const patch = patchById.get(itemId);
          return patch ? { ...item, ...patch } : item;
        });
        const updated = {
          ...prev,
          [sheet]: nextList,
        } as FieldDataset;
        scheduleDatasetPersist(updated);
        return updated;
      });

      const nowIso = new Date().toISOString();
      const nextQueue = [...syncQueueRef.current];
      patchById.forEach((rec, targetId) => {
        const existingIdx = nextQueue.findIndex(
          (q) =>
            q.queueId !== inFlightQueueIdRef.current &&
            q.action === 'update' &&
            q.sheet === sheet &&
            String(q.data[idKey] ?? '').trim() === targetId
        );
        if (existingIdx !== -1) {
          nextQueue[existingIdx] = {
            ...nextQueue[existingIdx],
            data: rec,
            createdAt: nowIso,
            lastError: undefined,
          };
        } else {
          nextQueue.push({
            queueId: `Q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            createdAt: nowIso,
            action: 'update',
            sheet,
            data: rec,
          });
        }
      });

      syncQueueRef.current = nextQueue;
      setSyncQueue(nextQueue);
      saveSyncQueue(nextQueue);

      if (navigator.onLine && isConfiguredApiUrl(apiUrl)) {
        if (autoFlushTimerRef.current !== null) {
          window.clearTimeout(autoFlushTimerRef.current);
        }
        autoFlushTimerRef.current = window.setTimeout(() => {
          autoFlushTimerRef.current = null;
          void syncPendingQueue(true, { skipRefreshAfter: true });
        }, 500);
      }
    },
    [apiUrl, scheduleDatasetPersist, syncPendingQueue]
  );

  // Listen to browser online/offline transitions and auto-sync when online
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      const pending = syncQueueRef.current.length;
      if (pending > 0 && isConfiguredApiUrl(apiUrl)) {
        pushToast({
          type: 'info',
          title: 'Connection restored',
          message: `Syncing ${pending} offline entr${pending === 1 ? 'y' : 'ies'}...`,
        });
        void syncPendingQueue(false);
      } else if (isConfiguredApiUrl(apiUrl)) {
        void refreshFromServer(true);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      pushToast({
        type: 'warning',
        title: 'Offline mode active',
        message: 'Changes will be saved locally and synced automatically when online.',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [apiUrl, pushToast, refreshFromServer, syncPendingQueue]);

  // Auto-sync queued entries and fetch fresh Google Sheets data asynchronously when idle
  useEffect(() => {
    let cancelled = false;
    let lastAutoRefreshMs = 0;
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;

    const cancelScheduledSync = () => {
      if (idleHandle !== null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleHandle);
        idleHandle = null;
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    };

    const runFreshSync = async () => {
      if (cancelled || !isConfiguredApiUrl(apiUrl) || !navigator.onLine) return;
      if (syncInFlightRef.current) return;
      lastAutoRefreshMs = Date.now();
      if (syncQueueRef.current.length > 0) {
        await syncPendingQueue(true, { skipRefreshAfter: true });
      }
      if (!cancelled && syncQueueRef.current.length === 0 && !syncInFlightRef.current) {
        await refreshFromServer(true);
      }
    };

    // Defer background refresh off the critical paint/tap path so cached UI responds in <100ms
    const scheduleBackgroundSync = () => {
      cancelScheduledSync();
      if (typeof window.requestIdleCallback === 'function') {
        idleHandle = window.requestIdleCallback(
          () => {
            idleHandle = null;
            void runFreshSync();
          },
          { timeout: 1200 }
        );
      } else {
        timeoutHandle = window.setTimeout(() => {
          timeoutHandle = null;
          void runFreshSync();
        }, 180);
      }
    };

    scheduleBackgroundSync();

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'hidden') return;
      if (Date.now() - lastAutoRefreshMs < 15000) return;
      scheduleBackgroundSync();
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    return () => {
      cancelled = true;
      cancelScheduledSync();
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  const submitRecord = useCallback(
    async (
      action: 'add' | 'update' | 'delete',
      sheet: SheetName,
      data: Record<string, unknown>
    ): Promise<{ syncedImmediately: boolean }> => {
      if (MASTER_DATA_SHEETS.has(sheet) && !isSuperAdmin) {
        pushToast({
          type: 'warning',
          title: 'Read-Only Mode',
          message: 'Super Admin Mode is required to modify master data.',
        });
        return { syncedImmediately: false };
      }

      // Route private Team workspace records directly to Cloud Firestore areas/{areaId}/*
      const isPrivateTeamSheet =
        sheet === 'Doctors' ||
        sheet === 'Chambers' ||
        sheet === 'Hospitals' ||
        sheet === 'MPO_Users';

      if (
        isPrivateTeamSheet &&
        teamSession?.loginMode === 'firebase' &&
        firebaseUser &&
        firebaseProfile?.areaId
      ) {
        const areaId = firebaseProfile.areaId;
        const uid = firebaseUser.uid;
        try {
          if (sheet === 'Doctors') {
            if (action === 'delete') {
              await deleteAreaDoctor(areaId, String(data.Doctor_ID || ''));
            } else {
              await saveAreaDoctor(areaId, { ...data, Area_ID: areaId }, uid);
            }
          } else if (sheet === 'Chambers') {
            if (action === 'delete') {
              await deleteAreaChamber(areaId, String(data.Chamber_ID || ''));
            } else {
              await saveAreaChamber(areaId, { ...data, Area_ID: areaId }, uid);
            }
          } else if (sheet === 'Hospitals') {
            if (action === 'delete') {
              await deleteAreaHospital(areaId, String(data.Hospital_ID || ''));
            } else {
              await saveAreaHospital(areaId, { ...data, Area_ID: areaId }, uid);
            }
          } else if (sheet === 'MPO_Users') {
            if (action === 'delete') {
              await deleteAreaMember(areaId, String(data.MPO_ID || ''));
            } else {
              await saveAreaMember(
                areaId,
                {
                  ...data,
                  Area_ID: areaId,
                  Area: data.Area || firebaseProfile.areaName,
                  Territory:
                    data.Territory ||
                    [firebaseProfile.district, firebaseProfile.upazila].filter(Boolean).join(' · '),
                },
                uid
              );
            }
          }
          return { syncedImmediately: navigator.onLine };
        } catch (err) {
          pushToast({
            type: 'error',
            title: 'Firestore sync error',
            message: formatFirebaseAuthError(err),
          });
          return { syncedImmediately: false };
        }
      }

      setDataset((prev) => {
        const updated = applyMutationLocally(prev, action, sheet, data);
        saveCachedDataset(updated);
        return updated;
      });

      const queueItem: QueuedMutation = {
        queueId: `Q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
        action,
        sheet,
        data,
      };

      if (navigator.onLine && isConfiguredApiUrl(apiUrl)) {
        try {
          await postMutationToAppsScript(apiUrl, { action, sheet, data });
          const nowIso = new Date().toISOString();
          setLastSyncedAt(nowIso);
          saveLastSyncTime(nowIso);
          return { syncedImmediately: true };
        } catch (err) {
          queueItem.lastError = err instanceof Error ? err.message : 'Network error';
          syncQueueRef.current = [...syncQueueRef.current, queueItem];
          setSyncQueue([...syncQueueRef.current]);
          saveSyncQueue(syncQueueRef.current);
          return { syncedImmediately: false };
        }
      }

      syncQueueRef.current = [...syncQueueRef.current, queueItem];
      setSyncQueue([...syncQueueRef.current]);
      saveSyncQueue(syncQueueRef.current);
      return { syncedImmediately: false };
    },
    [apiUrl, firebaseProfile, firebaseUser, isSuperAdmin, pushToast, teamSession?.loginMode]
  );

  const confirmDeleteRecord = useCallback(async () => {
    if (!deleteTarget) return;
    const { sheet, record, displayLabel } = deleteTarget;
    const pkCol = SHEET_PRIMARY_KEY[sheet];
    const recordId = String(record[pkCol] ?? '').trim();

    if (!recordId) {
      pushToast({
        type: 'error',
        title: 'Unable to delete record',
        message: `Missing primary key (${pkCol}).`,
      });
      setDeleteTarget(null);
      return;
    }

    setIsDeleting(true);
    try {
      const deletePromise = submitRecord('delete', sheet, { [pkCol]: recordId });

      setDeleteTarget(null);
      if (sheet === 'Doctors' && selectedDoctorId === recordId) {
        setSelectedDoctorId(null);
      }
      if (sheet === 'Products' && selectedProductId === recordId) {
        setSelectedProductId(null);
      }

      const result = await deletePromise;

      pushToast({
        type: result.syncedImmediately ? 'success' : 'info',
        title: result.syncedImmediately
          ? `Deleted from ${sheet}`
          : `Removed locally & queued delete for ${sheet}`,
        message: displayLabel ? `${displayLabel} (${recordId})` : `${pkCol}: ${recordId}`,
      });
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, pushToast, selectedDoctorId, selectedProductId, submitRecord]);

  const removeQueuedItem = useCallback((queueId: string) => {
    syncQueueRef.current = syncQueueRef.current.filter((item) => item.queueId !== queueId);
    setSyncQueue([...syncQueueRef.current]);
    saveSyncQueue(syncQueueRef.current);
  }, []);

  const clearSyncQueue = useCallback(() => {
    syncQueueRef.current = [];
    setSyncQueue([]);
    saveSyncQueue([]);
    pushToast({
      type: 'info',
      title: 'Sync queue cleared',
    });
  }, [pushToast]);

  const resetLocalStarterData = useCallback(() => {
    const fresh = resetCachedDatasetToStarter();
    setDataset(fresh);
    syncQueueRef.current = [];
    setSyncQueue([]);
    saveSyncQueue([]);
    clearLegacyPendingGroupUpdates();
    pushToast({
      type: 'info',
      title: 'Local dataset reset',
      message: 'Restored starter Drug International Limited field records.',
    });
  }, [pushToast]);

  // Lookup maps
  const areaMap = useMemo(
    () => new Map(dataset.Areas.map((a) => [a.Area_ID, a])),
    [dataset.Areas]
  );
  const hospitalMap = useMemo(
    () => new Map(dataset.Hospitals.map((h) => [h.Hospital_ID, h])),
    [dataset.Hospitals]
  );
  const doctorMap = useMemo(
    () => new Map(dataset.Doctors.map((d) => [d.Doctor_ID, d])),
    [dataset.Doctors]
  );
  const departmentMap = useMemo(
    () => new Map(dataset.Departments.map((d) => [d.Department_ID, d])),
    [dataset.Departments]
  );
  const productMap = useMemo(
    () => new Map(dataset.Products.map((p) => [p.Product_ID, p])),
    [dataset.Products]
  );
  const mpoMap = useMemo(
    () => new Map(dataset.MPO_Users.map((m) => [m.MPO_ID, m])),
    [dataset.MPO_Users]
  );

  const activeMpo = useMemo(
    () =>
      (teamSession?.mpoId ? mpoMap.get(teamSession.mpoId) : undefined) ||
      mpoMap.get(activeMpoId) ||
      dataset.MPO_Users[0],
    [teamSession?.mpoId, mpoMap, activeMpoId, dataset.MPO_Users]
  );

  // Navigation shortcuts
  const openDoctorProfile = useCallback((doctorId: string) => {
    setSelectedDoctorId(doctorId);
    setActiveTab('team');
  }, []);

  const openSpecialistDetail = useCallback(
    (specialistNameOrId: string) => {
      const target = String(specialistNameOrId ?? '').trim();
      if (!target) return;
      const matched = dataset.Departments.find(
        (d) =>
          d.Department_ID.toLowerCase() === target.toLowerCase() ||
          d.Department_Name.toLowerCase() === target.toLowerCase() ||
          matchSpecialistName(d.Department_Name, target)
      );
      if (matched) {
        setSelectedSpecialistId(matched.Department_ID);
      } else {
        setSelectedSpecialistId(target);
      }
      setActiveTab('specialists');
    },
    [dataset.Departments]
  );

  const openProductBrief = useCallback((productId: string) => {
    setSelectedProductId(productId);
  }, []);

  const startDetailingFlow = useCallback(
    (opts: {
      doctorId?: string;
      productId?: string;
      genericName?: string;
      specialist?: string;
      subTab?: 'catalog' | 'detailing';
    }) => {
      setPrefillDetailing(opts);
      setActiveTab('detailing');
    },
    []
  );

  const value: AppContextValue = {
    dataset,
    apiUrl,
    isApiConfigured,
    isOnline,
    isSyncing,
    isLoadingData,
    lastSyncedAt,
    syncQueue,
    activeTab,
    setActiveTab,
    navigateHome,
    teamSession,
    firebaseAuthReady,
    firebaseUserEmail: firebaseUser?.email ?? null,
    firebaseUserName: firebaseUser?.displayName ?? null,
    needsFirebaseAreaSetup,
    firebaseSyncError,
    areaNotes,
    teamPinConfigured,
    loginTeamWithGoogle,
    loginTeamWithFirebase,
    registerTeamWithFirebase,
    completeFirebaseAreaProfile,
    saveTeamAreaNote,
    deleteTeamAreaNote,
    loginWithAreaPin,
    loginWithMpoCredentials,
    logoutTeam,
    updateTeamPin,
    isSuperAdmin,
    superAdminSource,
    refreshSuperAdminStatus,
    setupSuperAdmin,
    loginSuperAdmin,
    changeSuperAdminPasscode,
    logoutSuperAdmin,
    activeMpoId: activeMpo?.MPO_ID || activeMpoId,
    setActiveMpoId,
    activeMpo,
    theme,
    toggleTheme,
    toasts,
    pushToast,
    dismissToast,
    recordModal,
    openAddModal,
    openEditModal,
    closeRecordModal,
    deleteTarget,
    isDeleting,
    requestDeleteRecord,
    closeDeleteConfirm,
    confirmDeleteRecord,
    selectedDoctorId,
    setSelectedDoctorId,
    selectedSpecialistId,
    setSelectedSpecialistId,
    selectedProductId,
    setSelectedProductId,
    openProductBrief,
    prefillDetailing,
    setPrefillDetailing,
    doctorDirectoryHospitalFilter,
    setDoctorDirectoryHospitalFilter,
    doctorDirectoryAreaFilter,
    setDoctorDirectoryAreaFilter,
    doctorDirectorySpecialtyFilter,
    setDoctorDirectorySpecialtyFilter,
    openDoctorProfile,
    openSpecialistDetail,
    startDetailingFlow,
    updateApiUrl,
    refreshFromServer,
    syncPendingQueue,
    flushPendingQueueNow,
    queueBatchUpdates,
    submitRecord,
    removeQueuedItem,
    clearSyncQueue,
    resetLocalStarterData,
    areaMap,
    hospitalMap,
    doctorMap,
    departmentMap,
    productMap,
    mpoMap,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return ctx;
}
