import React, {
  createContext,
  startTransition,
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
  OfficerSearchResult,
  Product,
  QueuedMutation,
  SheetName,
  TeamInvite,
  TeamSession,
  ToastNotification,
} from '../types';
import { auth, testFirestoreConnection } from '../lib/firebase';
import { loadDatasetFromIndexedDB, saveDatasetToIndexedDB } from '../lib/cacheDb';
import {
  TeamRegistrationInput,
  acceptTeamInvite,
  clearCachedFirebaseProfile,
  declineTeamInvite,
  deleteAreaChamber,
  deleteAreaDoctor,
  deleteAreaHospital,
  deleteAreaMember,
  deleteAreaNote,
  ensureAreaJoinCodeRegistered,
  fetchUserProfileFromFirestore,
  formatFirebaseAuthError,
  getCachedFirebaseProfile,
  joinTeamByCode,
  profileToTeamSession,
  registerTeamUserWithFirebase,
  resolveGoogleRedirectResult,
  saveAreaChamber,
  saveAreaDoctor,
  saveAreaHospital,
  saveAreaMember,
  saveAreaNote,
  saveUserAndAreaDocs,
  searchRegisteredOfficers,
  sendTeamInvite,
  signInTeamUserWithFirebase,
  signInTeamWithGoogle,
  signOutTeamUserFromFirebase,
  subscribeToAreaWorkspace,
  subscribeToIncomingInvites,
} from '../services/firebaseTeam';
import {
  DEFAULT_API_URL,
  DEFAULT_APPS_SCRIPT_URL,
  GenericGroup,
  SHEET_PRIMARY_KEY,
  SuperAdminConfigSource,
  applyMutationLocally,
  authenticateAreaTeam,
  authenticateMpoUser,
  buildGenericGroups,
  changeSuperAdminPasscodeOnServer,
  clearLegacyPendingGroupUpdates,
  clearTeamSession,
  fetchAllDataFromAppsScript,
  fetchSuperAdminStatus,
  getInitialStarterDataset,
  getLastSyncTime,
  getSavedActiveMpoId,
  getSavedApiUrl,
  getSavedSuperAdminSession,
  getSavedTeamPin,
  getSavedTeamSession,
  getSavedTheme,
  isConfiguredApiUrl,
  loadSyncQueue,
  loginSuperAdminOnServer,
  logoutSuperAdminOnServer,
  matchSpecialistName,
  normalizeCachedDataset,
  postMutationToAppsScript,
  resetCachedDatasetToStarter,
  saveActiveMpoId,
  saveApiUrl,
  saveLastSyncTime,
  saveSyncQueue,
  saveTeamPin,
  saveTeamSession,
  saveTheme,
  setupSuperAdminPasscodeOnServer,
} from '../services/api';

export type TeamWorkspaceSubTab = 'doctors' | 'chambers' | 'hospitals' | 'team';

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
  teamSubTab: TeamWorkspaceSubTab;
  setTeamSubTab: (subTab: TeamWorkspaceSubTab) => void;
  openTeamSection: (subTab: TeamWorkspaceSubTab) => void;

  // Team / Area Session (Firebase Auth + Cloud Firestore private workspace — works online & offline)
  currentUser: User | null;
  teamSession: TeamSession | null;
  firebaseAuthReady: boolean;
  isProfileLoading: boolean;
  firebaseUserEmail: string | null;
  firebaseUserName: string | null;
  needsFirebaseAreaSetup: boolean;
  firebaseSyncError: string | null;
  googleRedirectError: string | null;
  clearGoogleRedirectError: () => void;
  areaNotes: AreaNote[];
  pendingInvites: TeamInvite[];
  teamPinConfigured: boolean;
  loginTeamWithGoogle: () => Promise<{ ok: boolean; redirected?: boolean; error?: string }>;
  loginTeamWithFirebase: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  registerTeamWithFirebase: (
    input: TeamRegistrationInput
  ) => Promise<{ ok: boolean; error?: string }>;
  completeFirebaseAreaProfile: (
    input: Omit<TeamRegistrationInput, 'email' | 'password'>
  ) => Promise<{ ok: boolean; error?: string }>;
  searchTeamOfficers: (
    queryText: string
  ) => Promise<{ ok: boolean; results: OfficerSearchResult[]; error?: string }>;
  sendOfficerTeamInvite: (recipient: OfficerSearchResult) => Promise<{ ok: boolean; error?: string }>;
  acceptIncomingInvite: (invite: TeamInvite) => Promise<{ ok: boolean; error?: string }>;
  declineIncomingInvite: (inviteId: string) => Promise<{ ok: boolean; error?: string }>;
  joinTeamWithCode: (code: string) => Promise<{ ok: boolean; error?: string }>;
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
  pendingKnowledgeChapter: {
    tab: 'mpo_desk' | 'medical_knowledge';
    chapterNo: string;
  } | null;
  setPendingKnowledgeChapter: (
    val: { tab: 'mpo_desk' | 'medical_knowledge'; chapterNo: string } | null
  ) => void;
  openKnowledgeChapter: (
    tab: 'mpo_desk' | 'medical_knowledge',
    chapterNo: string
  ) => void;
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

  // Lookup maps & precomputed generic groups
  areaMap: Map<string, Area>;
  hospitalMap: Map<string, Hospital>;
  doctorMap: Map<string, Doctor>;
  departmentMap: Map<string, Department>;
  productMap: Map<string, Product>;
  mpoMap: Map<string, MPOUser>;
  genericGroups: GenericGroup[];
  genericScriptCountMap: Map<string, number>;
}

interface NavigationContextValue {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  navigateHome: () => void;
  teamSubTab: TeamWorkspaceSubTab;
  setTeamSubTab: (subTab: TeamWorkspaceSubTab) => void;
  openTeamSection: (subTab: TeamWorkspaceSubTab) => void;
}

const AppContext = createContext<AppContextValue | null>(null);
const NavigationContext = createContext<NavigationContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Boot instantly with lightweight starter shell; full cached dataset hydrates async from IndexedDB
  const [sheetDataset, setDataset] = useState<FieldDataset>(() => {
    clearLegacyPendingGroupUpdates();
    return getInitialStarterDataset();
  });
  const [apiUrl, setApiUrl] = useState<string>(() => getSavedApiUrl());
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => getLastSyncTime());
  const [syncQueue, setSyncQueue] = useState<QueuedMutation[]>(() => loadSyncQueue());
  const [activeTab, setActiveTabState] = useState<NavTab>('dashboard');
  const [teamSubTab, setTeamSubTabState] = useState<TeamWorkspaceSubTab>('doctors');
  const [firebaseAuthReady, setFirebaseAuthReady] = useState(false);

  // Wrap tab switching in React.startTransition so every mobile tap responds in <100ms
  const setActiveTab = useCallback((tab: NavTab) => {
    startTransition(() => {
      setActiveTabState(tab);
    });
  }, []);

  const setTeamSubTab = useCallback((subTab: TeamWorkspaceSubTab) => {
    startTransition(() => {
      setTeamSubTabState(subTab);
    });
  }, []);

  const openTeamSection = useCallback((subTab: TeamWorkspaceSubTab) => {
    startTransition(() => {
      setTeamSubTabState(subTab);
      setActiveTabState('team');
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(() => auth.currentUser);
  const [firebaseProfile, setFirebaseProfile] = useState<FirebaseUserProfile | null>(() =>
    getCachedFirebaseProfile()
  );
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const firebaseProfileRef = useRef<FirebaseUserProfile | null>(firebaseProfile);
  const authSeqRef = useRef(0);
  const [firebaseSyncError, setFirebaseSyncError] = useState<string | null>(null);
  const [googleRedirectError, setGoogleRedirectError] = useState<string | null>(null);
  const clearGoogleRedirectError = useCallback(() => setGoogleRedirectError(null), []);
  const [firebaseDoctors, setFirebaseDoctors] = useState<Doctor[]>([]);
  const [firebaseChambers, setFirebaseChambers] = useState<Chamber[]>([]);
  const [firebaseHospitals, setFirebaseHospitals] = useState<Hospital[]>([]);
  const [firebaseMembers, setFirebaseMembers] = useState<MPOUser[]>([]);
  const [areaNotes, setAreaNotes] = useState<AreaNote[]>([]);
  const [pendingInvites, setPendingInvites] = useState<TeamInvite[]>([]);

  useEffect(() => {
    firebaseProfileRef.current = firebaseProfile;
  }, [firebaseProfile]);

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
  const [pendingKnowledgeChapter, setPendingKnowledgeChapter] = useState<{
    tab: 'mpo_desk' | 'medical_knowledge';
    chapterNo: string;
  } | null>(null);
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
        const snapshot = pendingDatasetSaveRef.current;
        pendingDatasetSaveRef.current = null;
        void saveDatasetToIndexedDB(snapshot);
      }
      datasetSaveTimerRef.current = null;
    }, 300);
  }, []);

  // Hydrate full cached dataset asynchronously from IndexedDB (never blocks initial paint or taps)
  const hasServerRefreshedRef = useRef(false);
  useEffect(() => {
    let active = true;
    void loadDatasetFromIndexedDB().then((cached) => {
      if (!active || !cached || hasServerRefreshedRef.current) return;
      const normalized = normalizeCachedDataset(cached);
      startTransition(() => {
        setDataset(normalized);
      });
      // Ensure any migrated legacy snapshot is persisted cleanly to IndexedDB
      void saveDatasetToIndexedDB(normalized);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const flushPendingDataset = () => {
      if (pendingDatasetSaveRef.current) {
        const snapshot = pendingDatasetSaveRef.current;
        pendingDatasetSaveRef.current = null;
        void saveDatasetToIndexedDB(snapshot);
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

  // Firebase Auth listener + Google redirect completion — primary auth source (works online & offline)
  useEffect(() => {
    let active = true;

    void resolveGoogleRedirectResult().then((redirected) => {
      if (!active || !redirected) return;
      if (redirected.error) {
        setGoogleRedirectError(redirected.error);
        setFirebaseAuthReady(true);
        setActiveTab('team');
        return;
      }
      if (!redirected.user) return;
      setGoogleRedirectError(null);
      setFirebaseUser(redirected.user);
      if (redirected.profile) {
        firebaseProfileRef.current = redirected.profile;
        setFirebaseProfile(redirected.profile);
        const session = profileToTeamSession(redirected.profile);
        setTeamSession(session);
        saveTeamSession(session);
      }
      setIsProfileLoading(false);
      setFirebaseAuthReady(true);
      setActiveTab('team');
    });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!active) return;
      const seq = ++authSeqRef.current;
      setFirebaseUser(user);

      if (!user) {
        firebaseProfileRef.current = null;
        setFirebaseProfile(null);
        setIsProfileLoading(false);
        clearCachedFirebaseProfile();
        setFirebaseDoctors([]);
        setFirebaseChambers([]);
        setFirebaseHospitals([]);
        setFirebaseMembers([]);
        setAreaNotes([]);
        setPendingInvites([]);
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

      // Immediately restore cached or in-memory profile for instant unlocked UI (zero Sign-In flicker)
      const inMemoryProfile =
        firebaseProfileRef.current?.uid === user.uid ? firebaseProfileRef.current : null;
      const cached = inMemoryProfile || getCachedFirebaseProfile(user.uid);
      if (cached) {
        firebaseProfileRef.current = cached;
        setFirebaseProfile(cached);
        const cachedSession = profileToTeamSession(cached);
        setTeamSession(cachedSession);
        saveTeamSession(cachedSession);
        setIsProfileLoading(false);
      } else {
        setIsProfileLoading(true);
      }
      setFirebaseAuthReady(true);

      const freshProfile = await fetchUserProfileFromFirestore(user.uid);
      if (!active || seq !== authSeqRef.current) return;

      if (freshProfile) {
        firebaseProfileRef.current = freshProfile;
        setFirebaseProfile(freshProfile);
        const nextSession = profileToTeamSession(freshProfile);
        setTeamSession(nextSession);
        saveTeamSession(nextSession);
      } else if (!cached && firebaseProfileRef.current?.uid !== user.uid) {
        firebaseProfileRef.current = null;
        setFirebaseProfile(null);
        setTeamSession(null);
        clearTeamSession();
      }
      setIsProfileLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [setActiveTab]);

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

  // Ensure the active area has its short Join Code (e.g. DI-4829) registered in Firestore
  useEffect(() => {
    if (!firebaseUser || !firebaseProfile?.areaId) return;
    void ensureAreaJoinCodeRegistered(firebaseProfile);
  }, [firebaseUser, firebaseProfile]);

  // Live subscription to incoming Team Invites for the logged-in officer
  useEffect(() => {
    if (!firebaseUser?.uid) {
      setPendingInvites([]);
      return;
    }
    const unsub = subscribeToIncomingInvites(firebaseUser.uid, (invites) => {
      setPendingInvites(invites);
    });
    return () => {
      unsub();
    };
  }, [firebaseUser?.uid]);

  const needsFirebaseAreaSetup = Boolean(
    firebaseUser && !isProfileLoading && !firebaseProfile && !teamSession
  );

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
      authSeqRef.current += 1;
      setFirebaseUser(result.user);
      setFirebaseAuthReady(true);
      setIsProfileLoading(false);
      if (result.profile) {
        firebaseProfileRef.current = result.profile;
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
        firebaseProfileRef.current = null;
        setFirebaseProfile(null);
        setTeamSession(null);
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
        const { user, profile } = await signInTeamUserWithFirebase(email, password);
        authSeqRef.current += 1;
        setFirebaseUser(user);
        setFirebaseAuthReady(true);
        setIsProfileLoading(false);
        if (profile) {
          firebaseProfileRef.current = profile;
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
          firebaseProfileRef.current = null;
          setFirebaseProfile(null);
          setTeamSession(null);
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
        authSeqRef.current += 1;
        if (auth.currentUser) {
          setFirebaseUser(auth.currentUser);
        }
        firebaseProfileRef.current = profile;
        setFirebaseProfile(profile);
        setIsProfileLoading(false);
        setFirebaseAuthReady(true);
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
        authSeqRef.current += 1;
        setFirebaseUser(currentUser);
        firebaseProfileRef.current = profile;
        setFirebaseProfile(profile);
        setIsProfileLoading(false);
        setFirebaseAuthReady(true);
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

  const searchTeamOfficers = useCallback(
    async (
      queryText: string
    ): Promise<{ ok: boolean; results: OfficerSearchResult[]; error?: string }> => {
      if (!firebaseUser) {
        return { ok: false, results: [], error: 'Please sign in first.' };
      }
      try {
        const results = await searchRegisteredOfficers(queryText, firebaseUser.uid);
        return { ok: true, results };
      } catch (err) {
        return { ok: false, results: [], error: formatFirebaseAuthError(err) };
      }
    },
    [firebaseUser]
  );

  const sendOfficerTeamInvite = useCallback(
    async (recipient: OfficerSearchResult): Promise<{ ok: boolean; error?: string }> => {
      if (!firebaseUser || !firebaseProfile) {
        return { ok: false, error: 'Complete your Area Profile first before sending invites.' };
      }
      try {
        await sendTeamInvite({ recipient, senderProfile: firebaseProfile });
        pushToast({
          type: 'success',
          title: `Invite sent to ${recipient.officerName}`,
          message: `They will receive a live Team notification to join ${firebaseProfile.areaName}.`,
        });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: formatFirebaseAuthError(err) };
      }
    },
    [firebaseUser, firebaseProfile, pushToast]
  );

  const acceptIncomingInvite = useCallback(
    async (invite: TeamInvite): Promise<{ ok: boolean; error?: string }> => {
      const current = auth.currentUser || firebaseUser;
      const activeProfile = firebaseProfileRef.current;
      if (!current) {
        return { ok: false, error: 'Please sign in again first.' };
      }
      if (!activeProfile) {
        return { ok: false, error: 'Complete your Area Profile first before accepting invites.' };
      }
      try {
        const updated = await acceptTeamInvite(current, activeProfile, invite);
        authSeqRef.current += 1;
        firebaseProfileRef.current = updated;
        setFirebaseProfile(updated);
        const nextSession = profileToTeamSession(updated);
        setTeamSession(nextSession);
        saveTeamSession(nextSession);
        setPendingInvites((prev) => prev.filter((item) => item.inviteId !== invite.inviteId));
        pushToast({
          type: 'success',
          title: `Joined ${updated.areaName}`,
          message: 'Shared Doctors, Chambers, Hospitals & Team Members are now synced.',
        });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: formatFirebaseAuthError(err) };
      }
    },
    [firebaseUser, pushToast]
  );

  const declineIncomingInvite = useCallback(
    async (inviteId: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        await declineTeamInvite(inviteId);
        setPendingInvites((prev) => prev.filter((item) => item.inviteId !== inviteId));
        pushToast({
          type: 'info',
          title: 'Invite declined',
        });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: formatFirebaseAuthError(err) };
      }
    },
    [pushToast]
  );

  const joinTeamWithCode = useCallback(
    async (code: string): Promise<{ ok: boolean; error?: string }> => {
      const current = auth.currentUser || firebaseUser;
      const activeProfile = firebaseProfileRef.current;
      if (!current) {
        return { ok: false, error: 'Please sign in again first.' };
      }
      if (!activeProfile) {
        return { ok: false, error: 'Complete your Area Profile first before joining a team.' };
      }
      try {
        const updated = await joinTeamByCode(current, activeProfile, code);
        authSeqRef.current += 1;
        firebaseProfileRef.current = updated;
        setFirebaseProfile(updated);
        const nextSession = profileToTeamSession(updated);
        setTeamSession(nextSession);
        saveTeamSession(nextSession);
        pushToast({
          type: 'success',
          title: `Joined ${updated.areaName}`,
          message: `Connected via Join Code ${updated.joinCode}. Shared area records are now live.`,
        });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: formatFirebaseAuthError(err) };
      }
    },
    [firebaseUser, pushToast]
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
    authSeqRef.current += 1;
    void signOutTeamUserFromFirebase().catch(() => {
      // Best-effort sign out
    });
    setFirebaseUser(null);
    firebaseProfileRef.current = null;
    setFirebaseProfile(null);
    setIsProfileLoading(false);
    clearCachedFirebaseProfile();
    setFirebaseDoctors([]);
    setFirebaseChambers([]);
    setFirebaseHospitals([]);
    setFirebaseMembers([]);
    setAreaNotes([]);
    setPendingInvites([]);
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
  }, [pushToast]);

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
    startTransition(() => {
      setSelectedDoctorId(null);
      setSelectedProductId(null);
      setSelectedSpecialistId(null);
      setRecordModal(null);
      setActiveTabState('dashboard');
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
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
        hasServerRefreshedRef.current = true;
        startTransition(() => {
          setDataset(fetched);
        });
        void saveDatasetToIndexedDB(fetched);
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
        void saveDatasetToIndexedDB(updated);
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
    void saveDatasetToIndexedDB(fresh);
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

  // Precompute genericGroups + script count map ONCE per dataset update (0ms on Products/Detailing tab tap)
  const genericGroups = useMemo(
    () => buildGenericGroups(dataset.Products, dataset.Doctor_Product_Detailing),
    [dataset.Products, dataset.Doctor_Product_Detailing]
  );

  const genericScriptCountMap = useMemo(() => {
    const map = new Map<string, number>();
    genericGroups.forEach((g) => {
      map.set(g.key, g.scripts.length);
    });
    return map;
  }, [genericGroups]);

  const activeMpo = useMemo(
    () =>
      (teamSession?.mpoId ? mpoMap.get(teamSession.mpoId) : undefined) ||
      mpoMap.get(activeMpoId) ||
      dataset.MPO_Users[0],
    [teamSession?.mpoId, mpoMap, activeMpoId, dataset.MPO_Users]
  );

  // Navigation shortcuts (wrapped in startTransition for instant tap response)
  const openDoctorProfile = useCallback((doctorId: string) => {
    startTransition(() => {
      setSelectedDoctorId(doctorId);
      setTeamSubTabState('doctors');
      setActiveTabState('team');
    });
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
      startTransition(() => {
        setSelectedSpecialistId(matched ? matched.Department_ID : target);
        setActiveTabState('specialists');
      });
    },
    [dataset.Departments]
  );

  const openProductBrief = useCallback((productId: string) => {
    setSelectedProductId(productId);
  }, []);

  const openKnowledgeChapter = useCallback(
    (tab: 'mpo_desk' | 'medical_knowledge', chapterNo: string) => {
      const cleaned = String(chapterNo ?? '').trim();
      if (!cleaned) return;
      startTransition(() => {
        setPendingKnowledgeChapter({ tab, chapterNo: cleaned });
        setActiveTabState('knowledge');
      });
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    },
    []
  );

  const startDetailingFlow = useCallback(
    (opts: {
      doctorId?: string;
      productId?: string;
      genericName?: string;
      specialist?: string;
      subTab?: 'catalog' | 'detailing';
    }) => {
      startTransition(() => {
        setPrefillDetailing(opts);
        setActiveTabState('detailing');
      });
    },
    []
  );

  const navValue = useMemo<NavigationContextValue>(
    () => ({
      activeTab,
      setActiveTab,
      navigateHome,
      teamSubTab,
      setTeamSubTab,
      openTeamSection,
    }),
    [activeTab, setActiveTab, navigateHome, teamSubTab, setTeamSubTab, openTeamSection]
  );

  const value = useMemo<AppContextValue>(
    () => ({
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
      teamSubTab,
      setTeamSubTab,
      openTeamSection,
      currentUser: firebaseUser,
      teamSession,
      firebaseAuthReady,
      isProfileLoading,
      firebaseUserEmail: firebaseUser?.email ?? null,
      firebaseUserName: firebaseUser?.displayName ?? null,
      needsFirebaseAreaSetup,
      firebaseSyncError,
      googleRedirectError,
      clearGoogleRedirectError,
      areaNotes,
      pendingInvites,
      teamPinConfigured,
      loginTeamWithGoogle,
      loginTeamWithFirebase,
      registerTeamWithFirebase,
      completeFirebaseAreaProfile,
      searchTeamOfficers,
      sendOfficerTeamInvite,
      acceptIncomingInvite,
      declineIncomingInvite,
      joinTeamWithCode,
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
    pendingKnowledgeChapter,
    setPendingKnowledgeChapter,
    openKnowledgeChapter,
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
      genericGroups,
      genericScriptCountMap,
    }),
    [
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
      teamSubTab,
      setTeamSubTab,
      openTeamSection,
      teamSession,
      firebaseAuthReady,
      isProfileLoading,
      firebaseUser,
      needsFirebaseAreaSetup,
      firebaseSyncError,
      googleRedirectError,
      clearGoogleRedirectError,
      areaNotes,
      pendingInvites,
      teamPinConfigured,
      loginTeamWithGoogle,
      loginTeamWithFirebase,
      registerTeamWithFirebase,
      completeFirebaseAreaProfile,
      searchTeamOfficers,
      sendOfficerTeamInvite,
      acceptIncomingInvite,
      declineIncomingInvite,
      joinTeamWithCode,
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
      activeMpo,
      activeMpoId,
      setActiveMpoId,
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
      selectedSpecialistId,
      selectedProductId,
      openProductBrief,
      prefillDetailing,
      doctorDirectoryHospitalFilter,
      doctorDirectoryAreaFilter,
      doctorDirectorySpecialtyFilter,
      openDoctorProfile,
      openSpecialistDetail,
      pendingKnowledgeChapter,
      openKnowledgeChapter,
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
      genericGroups,
      genericScriptCountMap,
    ]
  );

  return (
    <NavigationContext.Provider value={navValue}>
      <AppContext.Provider value={value}>{children}</AppContext.Provider>
    </NavigationContext.Provider>
  );
};

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error('useNavigation must be used inside AppProvider');
  }
  return ctx;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return ctx;
}
