import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BellRing,
  Building2,
  Check,
  Copy,
  Eye,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { getRedirectResult } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useApp, TeamWorkspaceSubTab } from '../context/AppContext';
import { StickyBackBar } from './StickyBackBar';
import { DoctorsView } from './DoctorsView';
import { OfficerSearchResult, TeamInvite, TeamSubArea } from '../types';
import {
  deriveAreaJoinCode,
  formatFirebaseAuthError,
} from '../services/firebaseTeam';

type AuthMode = 'signin' | 'signup';

const GoogleMark: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.56-5.15 3.56-8.65z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.95H1.29v3.1A12 12 0 0 0 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.29A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.29v-3.1H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.39l3.99-3.1z"
    />
    <path
      fill="#EA4335"
      d="M12 4.76c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.94 1.19 15.23 0 12 0A12 12 0 0 0 1.29 6.61l3.99 3.1C6.23 6.87 8.88 4.76 12 4.76z"
    />
  </svg>
);

const BD_DISTRICTS = [
  'Dhaka',
  'Chattogram',
  'Sylhet',
  'Rajshahi',
  'Khulna',
  'Barishal',
  'Rangpur',
  'Mymensingh',
  'Cumilla',
  'Gazipur',
  'Narayanganj',
  'Bogura',
  'Jashore',
  'Dinajpur',
  'Tangail',
  'Faridpur',
  'Noakhali',
  'Cox’s Bazar',
  'Pabna',
  'Kushtia',
  'Narsingdi',
  'Feni',
  'Brahmanbaria',
];

const OFFICER_ROLES = [
  'MPO',
  'Senior MPO',
  'Territory Officer',
  'Area Manager',
  'Regional Manager',
];

const SUB_AREA_TYPES = [
  'Market / Bazar',
  'Union',
  'Pourashava',
  'Upazila HQ',
  'Town / Ward',
  'Hospital Zone',
  'Other',
];

export const TeamWorkspaceView: React.FC = () => {
  const {
    dataset,
    currentUser,
    teamSession,
    teamSubTab,
    setTeamSubTab,
    teamMeta,
    teamSubAreas,
    teamSuperiors,
    superiorAccessibleTeams,
    activeViewingTeamId,
    setActiveViewingTeamId,
    isReadOnlySuperiorView,
    effectiveTeamId,
    activeTerritoryName,
    firebaseAuthReady,
    isProfileLoading,
    firebaseUserEmail,
    firebaseUserName,
    firebaseSyncError,
    googleRedirectError,
    clearGoogleRedirectError,
    loginTeamWithGoogle,
    loginTeamWithFirebase,
    registerTeamWithFirebase,
    completeFirebaseAreaProfile,
    updateTerritoryName,
    saveSubArea,
    deleteSubArea,
    pendingInvites,
    searchTeamOfficers,
    sendOfficerTeamInvite,
    revokeTeamSuperior,
    acceptIncomingInvite,
    declineIncomingInvite,
    joinTeamWithCode,
    logoutTeam,
    isOnline,
    openAddModal,
    openEditModal,
    requestDeleteRecord,
    setDoctorDirectoryHospitalFilter,
    setDoctorDirectorySubAreaFilter,
    hospitalDirectorySubAreaFilter,
    setHospitalDirectorySubAreaFilter,
    pushToast,
  } = useApp();

  // Firebase Auth form state
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [officerNameInput, setOfficerNameInput] = useState('');
  const [roleInput, setRoleInput] = useState('MPO');
  const [phoneInput, setPhoneInput] = useState('');
  const [districtInput, setDistrictInput] = useState('');
  const [upazilaInput, setUpazilaInput] = useState('');
  const [areaNameInput, setAreaNameInput] = useState('');
  const [customAreaCode, setCustomAreaCode] = useState('');
  const [showAreaCodeOption, setShowAreaCodeOption] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  // Auto-fill Officer Name from Google displayName when entering 1-step Area setup
  useEffect(() => {
    if (currentUser && !teamSession && !officerNameInput.trim()) {
      const displayName = firebaseUserName || currentUser.displayName || '';
      if (displayName) {
        setOfficerNameInput(displayName);
      }
    }
  }, [currentUser, teamSession, firebaseUserName, officerNameInput]);

  // Run getRedirectResult(auth) on Team screen mount so redirect completion or errors surface immediately
  useEffect(() => {
    let active = true;
    void getRedirectResult(auth)
      .then((result) => {
        if (!active || !result?.user) return;
        setAuthError('');
        clearGoogleRedirectError();
        setTeamSubTab('doctors');
      })
      .catch((err: unknown) => {
        if (!active) return;
        setAuthError(formatFirebaseAuthError(err));
      });
    return () => {
      active = false;
    };
  }, [clearGoogleRedirectError, setTeamSubTab]);

  // Sync any boot-level Google redirect error into the visible Team auth alert
  useEffect(() => {
    if (googleRedirectError) {
      setAuthError(googleRedirectError);
    }
  }, [googleRedirectError]);

  // Unlocked workspace state (sub-tab synced via NavigationContext for instant Home quick-pill jumps)
  const activeSubTab = teamSubTab;
  const setActiveSubTab = setTeamSubTab;
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [subAreaSearch, setSubAreaSearch] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [copiedJoinCode, setCopiedJoinCode] = useState(false);

  // Inline Editable Territory Name state
  const [editingTerritory, setEditingTerritory] = useState(false);
  const [territoryNameDraft, setTerritoryNameDraft] = useState('');
  const [territoryDistrictDraft, setTerritoryDistrictDraft] = useState('');
  const [territoryUpazilaDraft, setTerritoryUpazilaDraft] = useState('');
  const [territorySaving, setTerritorySaving] = useState(false);
  const [territoryEditError, setTerritoryEditError] = useState('');

  // Sub-Areas (Areas tab) Add / Edit / Delete state
  const [showSubAreaForm, setShowSubAreaForm] = useState(false);
  const [editingSubArea, setEditingSubArea] = useState<TeamSubArea | null>(null);
  const [subAreaNameDraft, setSubAreaNameDraft] = useState('');
  const [subAreaTypeDraft, setSubAreaTypeDraft] = useState('Market / Bazar');
  const [subAreaNotesDraft, setSubAreaNotesDraft] = useState('');
  const [subAreaSaving, setSubAreaSaving] = useState(false);
  const [subAreaFormError, setSubAreaFormError] = useState('');
  const [confirmDeleteSubAreaId, setConfirmDeleteSubAreaId] = useState<string | null>(null);
  const [deletingSubAreaId, setDeletingSubAreaId] = useState<string | null>(null);

  // Superior Revoke inline 2-tap confirm state
  const [confirmRevokeSuperiorUid, setConfirmRevokeSuperiorUid] = useState<string | null>(null);
  const [revokingSuperiorUid, setRevokingSuperiorUid] = useState<string | null>(null);

  // Invite Member / Superior Modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteModalMode, setInviteModalMode] = useState<'member' | 'superior'>('member');
  const [inviteSearchInput, setInviteSearchInput] = useState('');
  const [inviteSearchLoading, setInviteSearchLoading] = useState(false);
  const [inviteSearchResults, setInviteSearchResults] = useState<OfficerSearchResult[]>([]);
  const [inviteSearchDone, setInviteSearchDone] = useState(false);
  const [inviteSearchError, setInviteSearchError] = useState('');
  const [sendingInviteUid, setSendingInviteUid] = useState<string | null>(null);
  const [sentInviteKeys, setSentInviteKeys] = useState<Record<string, boolean>>({});

  // Join Team by Code Modal state
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinCodeSubmitting, setJoinCodeSubmitting] = useState(false);
  const [joinCodeError, setJoinCodeError] = useState('');

  // Pending invite action busy tracker
  const [inviteActionId, setInviteActionId] = useState<string | null>(null);

  const effectiveAreaId = effectiveTeamId || teamSession?.teamId || teamSession?.areaId || '';
  const activeJoinCode =
    teamMeta?.joinCode ||
    teamSession?.joinCode ||
    (effectiveAreaId ? deriveAreaJoinCode(effectiveAreaId) : '');

  const scopedDoctors = useMemo(() => {
    if (!teamSession) return [];
    return dataset.Doctors.filter(
      (d) => !effectiveAreaId || !d.Area_ID || d.Area_ID === effectiveAreaId
    );
  }, [dataset.Doctors, teamSession, effectiveAreaId]);

  const scopedDoctorsCount = scopedDoctors.length;

  const scopedHospitalsBase = useMemo(() => {
    return dataset.Hospitals.filter(
      (h) => !effectiveAreaId || !h.Area_ID || h.Area_ID === effectiveAreaId
    );
  }, [dataset.Hospitals, effectiveAreaId]);

  const hospitalSubAreaOptions = useMemo(() => {
    const names = new Set<string>();
    teamSubAreas.forEach((sa) => {
      if (sa.Area_Name.trim()) names.add(sa.Area_Name.trim());
    });
    scopedHospitalsBase.forEach((h) => {
      const sub = (h.Sub_Area || h.areaName || '').trim();
      if (sub) names.add(sub);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [teamSubAreas, scopedHospitalsBase]);

  const scopedHospitals = useMemo(() => {
    const q = hospitalSearch.trim().toLowerCase();
    const subFilter = hospitalDirectorySubAreaFilter.trim().toLowerCase();
    return scopedHospitalsBase.filter((h) => {
      const hospSub = String(h.Sub_Area || h.areaName || '').trim();
      if (subFilter && hospSub.toLowerCase() !== subFilter) return false;
      if (!q) return true;
      return (
        String(h.Hospital_Name ?? '').toLowerCase().includes(q) ||
        String(h.Hospital_Type ?? '').toLowerCase().includes(q) ||
        hospSub.toLowerCase().includes(q) ||
        String(h.Address ?? '').toLowerCase().includes(q) ||
        String(h.Phone ?? '').toLowerCase().includes(q)
      );
    });
  }, [scopedHospitalsBase, hospitalSearch, hospitalDirectorySubAreaFilter]);

  const doctorCountByHospital = useMemo(() => {
    const counts = new Map<string, number>();
    scopedDoctors.forEach((d) => {
      counts.set(d.Primary_Hospital_ID, (counts.get(d.Primary_Hospital_ID) || 0) + 1);
    });
    return counts;
  }, [scopedDoctors]);

  const doctorCountBySubArea = useMemo(() => {
    const counts = new Map<string, number>();
    scopedDoctors.forEach((d) => {
      const key = String(d.Sub_Area || d.areaName || '').trim().toLowerCase();
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [scopedDoctors]);

  const hospitalCountBySubArea = useMemo(() => {
    const counts = new Map<string, number>();
    scopedHospitalsBase.forEach((h) => {
      const key = String(h.Sub_Area || h.areaName || '').trim().toLowerCase();
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [scopedHospitalsBase]);

  const filteredSubAreas = useMemo(() => {
    const q = subAreaSearch.trim().toLowerCase();
    if (!q) return teamSubAreas;
    return teamSubAreas.filter(
      (sa) =>
        sa.Area_Name.toLowerCase().includes(q) ||
        String(sa.Market_Type ?? '').toLowerCase().includes(q) ||
        String(sa.Notes ?? '').toLowerCase().includes(q)
    );
  }, [teamSubAreas, subAreaSearch]);

  const scopedTeamMembers = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    return dataset.MPO_Users.filter((m) => {
      if (effectiveAreaId && m.Area_ID && m.Area_ID !== effectiveAreaId) return false;
      if (!q) return true;
      return (
        String(m.MPO_Name ?? '').toLowerCase().includes(q) ||
        String(m.Role ?? m.Designation ?? '').toLowerCase().includes(q) ||
        String(m.Employee_ID ?? m.Employee_Code ?? '').toLowerCase().includes(q) ||
        String(m.Phone_Number ?? m.Phone ?? '').toLowerCase().includes(q) ||
        String(m.Email ?? '').toLowerCase().includes(q)
      );
    });
  }, [dataset.MPO_Users, effectiveAreaId, teamSearch]);

  const handleGoogleSignIn = async () => {
    setAuthError('');
    clearGoogleRedirectError();
    setGoogleSubmitting(true);
    try {
      const res = await loginTeamWithGoogle();
      if (!res.ok) {
        setAuthError(res.error || 'Could not complete Google Sign-In.');
      } else if (!res.redirected) {
        setActiveSubTab('doctors');
      }
    } catch (err: unknown) {
      setAuthError(formatFirebaseAuthError(err));
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!emailInput.trim() || !passwordInput) {
      setAuthError('Please enter both your email and password.');
      return;
    }
    setAuthSubmitting(true);
    try {
      const res = await loginTeamWithFirebase(emailInput.trim(), passwordInput);
      if (!res.ok) {
        setAuthError(res.error || 'Could not sign in.');
      } else {
        setPasswordInput('');
        setActiveSubTab('doctors');
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!officerNameInput.trim()) {
      setAuthError('Enter your Full Name.');
      return;
    }
    if (!districtInput.trim() || !areaNameInput.trim()) {
      setAuthError('Enter your District and Upazila / Area Name.');
      return;
    }
    if (!emailInput.trim() || passwordInput.length < 6) {
      setAuthError('Enter a valid email and a password of at least 6 characters.');
      return;
    }

    setAuthSubmitting(true);
    try {
      const res = await registerTeamWithFirebase({
        email: emailInput.trim(),
        password: passwordInput,
        officerName: officerNameInput.trim(),
        role: roleInput,
        phone: phoneInput.trim(),
        district: districtInput.trim(),
        upazila: upazilaInput.trim(),
        areaName: areaNameInput.trim(),
        customAreaId: customAreaCode.trim() || undefined,
      });
      if (!res.ok) {
        setAuthError(res.error || 'Could not create account.');
      } else {
        setPasswordInput('');
        setActiveSubTab('doctors');
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleCompleteProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!officerNameInput.trim() || !districtInput.trim() || !areaNameInput.trim()) {
      setAuthError('Enter Officer Name, District, and Area Name to continue.');
      return;
    }
    setAuthSubmitting(true);
    try {
      const res = await completeFirebaseAreaProfile({
        officerName: officerNameInput.trim(),
        role: roleInput,
        phone: phoneInput.trim(),
        district: districtInput.trim(),
        upazila: upazilaInput.trim(),
        areaName: areaNameInput.trim(),
        customAreaId: customAreaCode.trim() || undefined,
      });
      if (!res.ok) {
        setAuthError(res.error || 'Could not save area profile.');
      } else {
        setActiveSubTab('doctors');
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleCopyJoinCode = () => {
    if (!activeJoinCode) return;
    void navigator.clipboard?.writeText(activeJoinCode).then(() => {
      setCopiedJoinCode(true);
      pushToast({
        type: 'success',
        title: `Join Code ${activeJoinCode} copied`,
        message: 'Share this code with teammates so they can join your Area workspace.',
      });
      window.setTimeout(() => setCopiedJoinCode(false), 2000);
    });
  };

  const handleOpenInviteModal = (mode: 'member' | 'superior') => {
    setInviteModalMode(mode);
    setInviteSearchInput('');
    setInviteSearchResults([]);
    setInviteSearchDone(false);
    setInviteSearchError('');
    setShowInviteModal(true);
  };

  const handleSearchOfficersSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteSearchError('');
    if (!inviteSearchInput.trim()) {
      setInviteSearchError('Enter an officer email address or phone number.');
      return;
    }
    setInviteSearchLoading(true);
    setInviteSearchDone(false);
    try {
      const res = await searchTeamOfficers(inviteSearchInput.trim());
      if (!res.ok) {
        setInviteSearchError(res.error || 'Could not search officers.');
        setInviteSearchResults([]);
      } else {
        setInviteSearchResults(res.results);
      }
      setInviteSearchDone(true);
    } finally {
      setInviteSearchLoading(false);
    }
  };

  const handleSendInvite = async (recipient: OfficerSearchResult) => {
    setInviteSearchError('');
    setSendingInviteUid(recipient.uid);
    try {
      const res = await sendOfficerTeamInvite(recipient, inviteModalMode);
      if (!res.ok) {
        setInviteSearchError(res.error || 'Could not send invite.');
      } else {
        const key = `${inviteModalMode}:${recipient.uid}`;
        setSentInviteKeys((prev) => ({ ...prev, [key]: true }));
      }
    } finally {
      setSendingInviteUid(null);
    }
  };

  const handleStartTerritoryEdit = () => {
    if (isReadOnlySuperiorView) return;
    setTerritoryNameDraft(activeTerritoryName || teamSession?.territoryName || teamSession?.areaName || '');
    setTerritoryDistrictDraft(teamMeta?.district || teamSession?.district || '');
    setTerritoryUpazilaDraft(teamMeta?.upazila || teamSession?.upazila || '');
    setTerritoryEditError('');
    setEditingTerritory(true);
  };

  const handleSaveTerritoryEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTerritoryEditError('');
    const trimmed = territoryNameDraft.trim();
    if (!trimmed) {
      setTerritoryEditError('Territory name is required.');
      return;
    }
    setTerritorySaving(true);
    try {
      const res = await updateTerritoryName(
        trimmed,
        territoryDistrictDraft.trim(),
        territoryUpazilaDraft.trim()
      );
      if (!res.ok) {
        setTerritoryEditError(res.error || 'Could not update territory name.');
      } else {
        setEditingTerritory(false);
      }
    } finally {
      setTerritorySaving(false);
    }
  };

  const handleOpenSubAreaAdd = () => {
    if (isReadOnlySuperiorView) return;
    setEditingSubArea(null);
    setSubAreaNameDraft('');
    setSubAreaTypeDraft('Market / Bazar');
    setSubAreaNotesDraft('');
    setSubAreaFormError('');
    setShowSubAreaForm(true);
  };

  const handleOpenSubAreaEdit = (area: TeamSubArea) => {
    if (isReadOnlySuperiorView) return;
    setEditingSubArea(area);
    setSubAreaNameDraft(area.Area_Name);
    setSubAreaTypeDraft(area.Market_Type || 'Market / Bazar');
    setSubAreaNotesDraft(area.Notes || '');
    setSubAreaFormError('');
    setShowSubAreaForm(true);
  };

  const handleSaveSubAreaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubAreaFormError('');
    const trimmed = subAreaNameDraft.trim();
    if (!trimmed) {
      setSubAreaFormError('Enter a Sub-Area / Market name.');
      return;
    }
    setSubAreaSaving(true);
    try {
      const res = await saveSubArea({
        SubArea_ID: editingSubArea?.SubArea_ID,
        Area_Name: trimmed,
        Market_Type: subAreaTypeDraft,
        Notes: subAreaNotesDraft.trim(),
        Created_At: editingSubArea?.Created_At,
      });
      if (!res.ok) {
        setSubAreaFormError(res.error || 'Could not save Sub-Area.');
      } else {
        setShowSubAreaForm(false);
        setEditingSubArea(null);
        setSubAreaNameDraft('');
        setSubAreaNotesDraft('');
      }
    } finally {
      setSubAreaSaving(false);
    }
  };

  const handleDeleteSubArea = async (subAreaId: string) => {
    setDeletingSubAreaId(subAreaId);
    try {
      const res = await deleteSubArea(subAreaId);
      if (!res.ok) {
        pushToast({
          type: 'error',
          title: 'Could not delete Sub-Area',
          message: res.error || 'Please try again.',
        });
      }
    } finally {
      setDeletingSubAreaId(null);
      setConfirmDeleteSubAreaId(null);
    }
  };

  const handleRevokeSuperior = async (superiorUid: string) => {
    setRevokingSuperiorUid(superiorUid);
    try {
      const res = await revokeTeamSuperior(superiorUid);
      if (!res.ok) {
        pushToast({
          type: 'error',
          title: 'Could not revoke Superior access',
          message: res.error || 'Please try again.',
        });
      }
    } finally {
      setRevokingSuperiorUid(null);
      setConfirmRevokeSuperiorUid(null);
    }
  };

  const handleJoinCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinCodeError('');
    if (!joinCodeInput.trim()) {
      setJoinCodeError('Enter a valid Team Join Code (e.g. DI-4829).');
      return;
    }
    setJoinCodeSubmitting(true);
    try {
      const res = await joinTeamWithCode(joinCodeInput.trim());
      if (!res.ok) {
        setJoinCodeError(res.error || 'Could not join team with that code.');
      } else {
        setJoinCodeInput('');
        setShowJoinModal(false);
      }
    } finally {
      setJoinCodeSubmitting(false);
    }
  };

  const handleAcceptInvite = async (invite: TeamInvite) => {
    setInviteActionId(invite.inviteId);
    try {
      const res = await acceptIncomingInvite(invite);
      if (!res.ok) {
        pushToast({
          type: 'error',
          title: 'Could not accept invite',
          message: res.error || 'Please try again when online.',
        });
      }
    } finally {
      setInviteActionId(null);
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    setInviteActionId(inviteId);
    try {
      const res = await declineIncomingInvite(inviteId);
      if (!res.ok) {
        pushToast({
          type: 'error',
          title: 'Could not decline invite',
          message: res.error || 'Please try again.',
        });
      }
    } finally {
      setInviteActionId(null);
    }
  };

  // =========================================================================
  // AUTH INITIALIZING STATE (Only shown briefly before auth state resolves)
  // =========================================================================
  if (!firebaseAuthReady && !currentUser && !teamSession) {
    return (
      <div className="space-y-5">
        <StickyBackBar title="Team Workspace" subtitle="Checking private session..." />
        <div className="max-w-lg mx-auto rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-8 text-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#0E7C7B] border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-[#0D2B45]/75 dark:text-[#EBF4FA]/75">
            Restoring your Firebase Team session...
          </p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // AUTHENTICATED, LOADING AREA PROFILE (NEVER show Sign-In UI once authenticated)
  // =========================================================================
  if (currentUser && isProfileLoading && !teamSession) {
    return (
      <div className="space-y-5">
        <StickyBackBar
          title="Team Workspace"
          subtitle={firebaseUserEmail || currentUser.email || 'Loading area profile...'}
          rightSlot={
            <button
              type="button"
              onClick={logoutTeam}
              className="min-h-[38px] px-3 rounded-xl border border-rose-200 dark:border-rose-500/35 bg-rose-50 dark:bg-rose-950/40 text-xs font-bold text-rose-600 dark:text-rose-300 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          }
        />
        <div className="max-w-lg mx-auto rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-8 text-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#0E7C7B] border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-[#0D2B45]/75 dark:text-[#EBF4FA]/75">
            Unlocking your private Area workspace...
          </p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // PROFILE SETUP STATE (Authenticated currentUser !== null, missing users/{uid} area profile)
  // =========================================================================
  if (currentUser && !teamSession) {
    return (
      <div className="space-y-5">
        <StickyBackBar
          title="Complete Area Setup"
          subtitle={firebaseUserEmail || currentUser.email || 'Private Team Workspace'}
          rightSlot={
            <button
              type="button"
              onClick={logoutTeam}
              className="min-h-[38px] px-3 rounded-xl border border-rose-200 dark:border-rose-500/35 bg-rose-50 dark:bg-rose-950/40 text-xs font-bold text-rose-600 dark:text-rose-300 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          }
        />

        <div className="max-w-lg mx-auto rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-5 sm:p-6 space-y-4 shadow-sm">
          <div>
            <h1 className="font-display font-bold text-lg text-[#0D2B45] dark:text-white">
              Quick Officer Area Registration
            </h1>
            <p className="text-xs text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 mt-1">
              One quick step — enter your territory details to unlock your private Area workspace
              both online and offline.
            </p>
          </div>

          <form onSubmit={handleCompleteProfileSubmit} className="space-y-3.5">
            <div>
              <label
                htmlFor="setup-officer-name"
                className="block text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] mb-1"
              >
                Officer Name *
              </label>
              <input
                id="setup-officer-name"
                type="text"
                required
                value={officerNameInput}
                onChange={(e) => setOfficerNameInput(e.target.value)}
                placeholder="e.g. Md. Rakibul Islam"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="setup-district"
                  className="block text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] mb-1"
                >
                  District (জেলা) *
                </label>
                <input
                  id="setup-district"
                  type="text"
                  list="bd-districts-list"
                  required
                  value={districtInput}
                  onChange={(e) => setDistrictInput(e.target.value)}
                  placeholder="e.g. Dhaka"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                />
              </div>
              <div>
                <label
                  htmlFor="setup-area"
                  className="block text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] mb-1"
                >
                  Upazila / Territory Area Name (উপজেলা/এরিয়া) *
                </label>
                <input
                  id="setup-area"
                  type="text"
                  required
                  value={areaNameInput}
                  onChange={(e) => setAreaNameInput(e.target.value)}
                  placeholder="e.g. Dhanmondi & Shahbagh"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="setup-mobile"
                className="block text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] mb-1"
              >
                Mobile Number (Optional)
              </label>
              <input
                id="setup-mobile"
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="017XXXXXXXX"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
              />
            </div>

            {/* Optional Join Existing Team Code toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowAreaCodeOption((prev) => !prev)}
                className="text-xs font-semibold text-[#0E7C7B] dark:text-[#149A99] hover:underline cursor-pointer"
              >
                {showAreaCodeOption
                  ? 'Hide Team Join Code field'
                  : 'Joining a teammate? Enter Team Join Code (optional)'}
              </button>
              {showAreaCodeOption && (
                <div className="mt-1.5">
                  <input
                    type="text"
                    value={customAreaCode}
                    onChange={(e) => setCustomAreaCode(e.target.value.toUpperCase())}
                    placeholder="e.g. DI-4829"
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-sm font-mono uppercase text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                  />
                </div>
              )}
              <div className="mt-1 text-[11px] text-[#0D2B45]/55 dark:text-[#EBF4FA]/55">
                Private by default — only you can view your Territory until you invite a teammate or Superior.
              </div>
            </div>

            {authError && (
              <p
                role="alert"
                className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-300"
              >
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full min-h-[46px] px-4 rounded-xl bg-gradient-to-r from-[#0D2B45] to-[#0E7C7B] hover:brightness-110 disabled:opacity-50 text-white text-sm font-semibold transition-all active:scale-[0.98] cursor-pointer"
            >
              {authSubmitting ? 'Saving Profile...' : 'Unlock Private Area Workspace'}
            </button>
          </form>
        </div>

        <datalist id="bd-districts-list">
          {BD_DISTRICTS.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
      </div>
    );
  }

  // =========================================================================
  // LOCKED STATE: Firebase Email/Password Sign In & Sign Up (ONLY when unauthenticated;
  // authenticated currentUser !== null cases already returned above)
  // =========================================================================
  if (!teamSession) {
    return (
      <div className="space-y-5">
        <StickyBackBar
          title="Team Workspace"
          subtitle="Private area access · Synced via Firebase"
        />

        <div className="max-w-lg mx-auto pt-1 sm:pt-3 space-y-4">
          <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-5 sm:p-6 space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#0D2B45] to-[#0E7C7B] text-white flex items-center justify-center shrink-0 shadow-sm">
                <Lock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="font-display font-bold text-xl text-[#0D2B45] dark:text-white tracking-tight">
                  Team / Area Workspace
                </h1>
                <p className="text-xs sm:text-sm text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 mt-0.5 leading-relaxed">
                  Sign in with Google or email to manage private Doctors, Hospitals, Sub-Areas, and
                  Team Members. Private by default &amp; stays logged in offline.
                </p>
              </div>
            </div>

            {/* Prominent One-Tap Google Sign-In Button */}
            <button
              type="button"
              onClick={() => void handleGoogleSignIn()}
              disabled={googleSubmitting || authSubmitting}
              className="w-full min-h-[48px] px-4 rounded-xl bg-white dark:bg-[#071522] hover:bg-[#F4F8FC] dark:hover:bg-[#102940] border border-[#0D2B45]/18 dark:border-[#EBF4FA]/20 shadow-sm text-sm font-semibold text-[#0D2B45] dark:text-white inline-flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            >
              <GoogleMark className="w-5 h-5 shrink-0" />
              <span>{googleSubmitting ? 'Connecting to Google...' : 'Continue with Google'}</span>
            </button>

            {/* Visible Auth Error Box (displays exact Firebase error.code & error.message) */}
            {authError && (
              <div
                role="alert"
                className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 px-3.5 py-2.5 flex items-start gap-2 text-xs font-medium text-rose-700 dark:text-rose-300 break-words"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <span className="leading-relaxed">{authError}</span>
              </div>
            )}

            {/* Clean "or" Divider */}
            <div className="relative flex items-center">
              <div className="flex-1 border-t border-[#0D2B45]/12 dark:border-[#EBF4FA]/12" />
              <span className="px-3 text-xs font-medium text-[#0D2B45]/50 dark:text-[#EBF4FA]/50">
                or
              </span>
              <div className="flex-1 border-t border-[#0D2B45]/12 dark:border-[#EBF4FA]/12" />
            </div>

            {/* Auth Mode Switcher: Sign In | Create Account */}
            <div
              role="tablist"
              aria-label="Firebase team authentication"
              className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10"
            >
              <button
                type="button"
                role="tab"
                aria-selected={authMode === 'signin'}
                onClick={() => {
                  setAuthMode('signin');
                  setAuthError('');
                }}
                className={`min-h-[42px] px-3 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  authMode === 'signin'
                    ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white'
                    : 'text-[#0D2B45]/70 dark:text-[#EBF4FA]/70 hover:text-[#0D2B45] dark:hover:text-white'
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authMode === 'signup'}
                onClick={() => {
                  setAuthMode('signup');
                  setAuthError('');
                }}
                className={`min-h-[42px] px-3 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  authMode === 'signup'
                    ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white'
                    : 'text-[#0D2B45]/70 dark:text-[#EBF4FA]/70 hover:text-[#0D2B45] dark:hover:text-white'
                }`}
              >
                <UserPlus className="w-4 h-4 shrink-0" />
                <span>Create Account</span>
              </button>
            </div>

            {authMode === 'signin' ? (
              <form onSubmit={handleSignInSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="team-signin-email"
                    className="block text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] mb-1.5"
                  >
                    Email Address
                  </label>
                  <input
                    id="team-signin-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      if (authError) setAuthError('');
                    }}
                    placeholder="officer@example.com"
                    className="w-full min-h-[46px] px-3.5 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm text-[#0D2B45] dark:text-white placeholder:text-[#0D2B45]/40 dark:placeholder:text-[#EBF4FA]/40 focus:outline-none focus:border-[#0E7C7B]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="team-signin-password"
                    className="block text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] mb-1.5"
                  >
                    Password
                  </label>
                  <input
                    id="team-signin-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (authError) setAuthError('');
                    }}
                    placeholder="Enter your password"
                    className="w-full min-h-[46px] px-3.5 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm text-[#0D2B45] dark:text-white placeholder:text-[#0D2B45]/40 dark:placeholder:text-[#EBF4FA]/40 focus:outline-none focus:border-[#0E7C7B]"
                  />
                </div>

                {authError && (
                  <p
                    role="alert"
                    className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-300"
                  >
                    {authError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-[#0E7C7B] hover:bg-[#095C5B] disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors active:scale-[0.98] cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{authSubmitting ? 'Signing In...' : 'Sign In to Team Workspace'}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignUpSubmit} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="team-signup-name"
                      className="block text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] mb-1"
                    >
                      Full Name *
                    </label>
                    <input
                      id="team-signup-name"
                      type="text"
                      required
                      value={officerNameInput}
                      onChange={(e) => {
                        setOfficerNameInput(e.target.value);
                        if (authError) setAuthError('');
                      }}
                      placeholder="e.g. Md. Rakibul Islam"
                      className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="team-signup-role"
                      className="block text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] mb-1"
                    >
                      Designation
                    </label>
                    <select
                      id="team-signup-role"
                      value={roleInput}
                      onChange={(e) => setRoleInput(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                    >
                      {OFFICER_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="team-signup-district"
                      className="block text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] mb-1"
                    >
                      District *
                    </label>
                    <input
                      id="team-signup-district"
                      type="text"
                      list="bd-districts-list"
                      required
                      value={districtInput}
                      onChange={(e) => {
                        setDistrictInput(e.target.value);
                        if (authError) setAuthError('');
                      }}
                      placeholder="e.g. Dhaka"
                      className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="team-signup-upazila"
                      className="block text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] mb-1"
                    >
                      Upazila / Thana
                    </label>
                    <input
                      id="team-signup-upazila"
                      type="text"
                      value={upazilaInput}
                      onChange={(e) => setUpazilaInput(e.target.value)}
                      placeholder="e.g. Dhanmondi"
                      className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="team-signup-area"
                      className="block text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] mb-1"
                    >
                      Upazila / Area Name *
                    </label>
                    <input
                      id="team-signup-area"
                      type="text"
                      required
                      value={areaNameInput}
                      onChange={(e) => {
                        setAreaNameInput(e.target.value);
                        if (authError) setAuthError('');
                      }}
                      placeholder="e.g. Dhanmondi & Shahbagh"
                      className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="team-signup-phone"
                      className="block text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] mb-1"
                    >
                      Phone (Optional)
                    </label>
                    <input
                      id="team-signup-phone"
                      type="tel"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="017XXXXXXXX"
                      className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                    />
                  </div>
                </div>

                {/* Optional Join Existing Team Code toggle */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAreaCodeOption((prev) => !prev)}
                    className="text-xs font-semibold text-[#0E7C7B] dark:text-[#149A99] hover:underline cursor-pointer"
                  >
                    {showAreaCodeOption
                      ? 'Hide Team Join Code field'
                      : 'Joining a teammate? Enter Team Join Code (optional)'}
                  </button>
                  {showAreaCodeOption && (
                    <div className="mt-1.5 space-y-1">
                      <input
                        type="text"
                        value={customAreaCode}
                        onChange={(e) => setCustomAreaCode(e.target.value.toUpperCase())}
                        placeholder="e.g. DI-4829"
                        className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-sm font-mono uppercase text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                      />
                    </div>
                  )}
                  <div className="mt-1 text-[11px] text-[#0D2B45]/55 dark:text-[#EBF4FA]/55">
                    Private by default — nobody outside your invited Team or approved Superior can view your records.
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label
                      htmlFor="team-signup-email"
                      className="block text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] mb-1"
                    >
                      Email Address *
                    </label>
                    <input
                      id="team-signup-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={emailInput}
                      onChange={(e) => {
                        setEmailInput(e.target.value);
                        if (authError) setAuthError('');
                      }}
                      placeholder="officer@example.com"
                      className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="team-signup-password"
                      className="block text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] mb-1"
                    >
                      Password (min 6 chars) *
                    </label>
                    <input
                      id="team-signup-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={6}
                      value={passwordInput}
                      onChange={(e) => {
                        setPasswordInput(e.target.value);
                        if (authError) setAuthError('');
                      }}
                      placeholder="Create password"
                      className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                    />
                  </div>
                </div>

                {authError && (
                  <p
                    role="alert"
                    className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-300"
                  >
                    {authError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-[#0E7C7B] hover:bg-[#095C5B] disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors active:scale-[0.98] cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{authSubmitting ? 'Creating Account...' : 'Create Team Account'}</span>
                </button>
              </form>
            )}

            <div className="pt-3 border-t border-[#0D2B45]/8 dark:border-[#EBF4FA]/8 flex items-center justify-between gap-2 text-xs text-[#0D2B45]/55 dark:text-[#EBF4FA]/55">
              <span>
                {isOnline
                  ? 'Private Firestore area workspace · Public Dashboard stays open without login'
                  : 'Connect once to sign in — after sign-in, your area data works offline'}
              </span>
              {!isOnline && <WifiOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
            </div>
          </div>
        </div>

        <datalist id="bd-districts-list">
          {BD_DISTRICTS.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
      </div>
    );
  }

  // =========================================================================
  // UNLOCKED STATE: Territory -> Sub-Area Private Firestore Workspace
  // =========================================================================
  const officerDisplayName =
    teamSession.mpoName ||
    firebaseUserName ||
    currentUser?.displayName ||
    'Field Officer';
  const displayedDistrict = teamMeta?.district || teamSession.district || '';
  const displayedUpazila = teamMeta?.upazila || teamSession.upazila || '';
  const activeScopeMeta = [displayedDistrict, displayedUpazila].filter(Boolean).join(' · ');
  const ownTeamId = teamSession.teamId || teamSession.areaId;
  const ownTerritoryName = teamSession.territoryName || teamSession.areaName;
  const memberCount = teamMeta?.members?.length || Math.max(1, scopedTeamMembers.length);
  const superiorCount = teamSuperiors.length;

  return (
    <div className="space-y-3.5">
      {/* Sticky Top Header with ONE clean Logout button */}
      <StickyBackBar
        title="Team Workspace"
        subtitle={[activeTerritoryName, displayedDistrict].filter(Boolean).join(' · ')}
        rightSlot={
          <button
            type="button"
            onClick={logoutTeam}
            className="min-h-[38px] px-3 rounded-xl border border-rose-200 dark:border-rose-500/35 bg-rose-50 dark:bg-rose-950/40 text-xs font-bold text-rose-600 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/60 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors active:scale-[0.97]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        }
      />

      {/* Manager View Switcher (only shown if officer has approved read-only access to subordinate territories) */}
      {superiorAccessibleTeams.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveViewingTeamId(null)}
            className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              !isReadOnlySuperiorView
                ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white'
                : 'bg-[#F4F8FC] dark:bg-[#071522] text-[#0D2B45]/80 dark:text-[#EBF4FA]/80 hover:bg-[#EBF4FA] dark:hover:bg-[#102940]'
            }`}
          >
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>My Territory ({ownTerritoryName})</span>
          </button>

          {superiorAccessibleTeams.map((team) => {
            const active = activeViewingTeamId === team.teamId;
            return (
              <button
                key={team.teamId}
                type="button"
                onClick={() => setActiveViewingTeamId(team.teamId)}
                className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-200 border border-indigo-200/70 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-950/60'
                }`}
              >
                <Eye className="w-3.5 h-3.5 shrink-0" />
                <span>{team.territoryName}</span>
                <span className="text-[10px] opacity-80">(View)</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Read-Only Manager View Banner */}
      {isReadOnlySuperiorView && (
        <div className="rounded-2xl bg-indigo-50 dark:bg-indigo-950/45 border border-indigo-200 dark:border-indigo-500/35 px-3.5 py-2.5 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-300 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-indigo-900 dark:text-indigo-100 truncate">
                Manager View (Read-Only) · {activeTerritoryName}
              </div>
              <div className="text-[11px] text-indigo-700/80 dark:text-indigo-200/80 truncate">
                Viewing team territory records without edit permissions.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveViewingTeamId(null)}
            className="min-h-[34px] px-2.5 rounded-xl bg-white dark:bg-[#0D2235] border border-indigo-200 dark:border-indigo-500/40 text-[11px] font-bold text-indigo-700 dark:text-indigo-200 whitespace-nowrap shrink-0 cursor-pointer"
          >
            My Territory
          </button>
        </div>
      )}

      {/* Editable Territory Strip (Territory Name + District/Upazila + Edit Pencil) */}
      <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 px-3.5 py-3">
        {!editingTerritory ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#E6FBF3] dark:bg-[#0C2E2B] text-[#0E7C7B] dark:text-[#22E3D0] flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-display font-bold text-sm sm:text-base text-[#0D2B45] dark:text-white truncate">
                    {activeTerritoryName}
                  </span>
                  {!isReadOnlySuperiorView && (
                    <button
                      type="button"
                      onClick={handleStartTerritoryEdit}
                      aria-label="Edit Territory Name"
                      title="Edit Territory Name"
                      className="min-h-[28px] min-w-[28px] rounded-lg inline-flex items-center justify-center text-[#0D2B45]/55 hover:text-[#0E7C7B] dark:text-[#EBF4FA]/55 dark:hover:text-[#22E3D0] hover:bg-[#EBF4FA] dark:hover:bg-[#133859]/60 cursor-pointer shrink-0 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#0D2B45]/60 dark:text-[#EBF4FA]/65">
                  {activeScopeMeta && <span>{activeScopeMeta}</span>}
                  <span>
                    {memberCount <= 1 && superiorCount === 0
                      ? 'Private Territory'
                      : `${memberCount} Officer${memberCount === 1 ? '' : 's'}${
                          superiorCount > 0
                            ? ` · ${superiorCount} Superior${superiorCount === 1 ? '' : 's'}`
                            : ''
                        }`}
                  </span>
                </div>
              </div>
            </div>

            <span className="px-2 py-1 rounded-lg bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 text-[10.5px] font-semibold text-[#0E7C7B] dark:text-[#22E3D0] whitespace-nowrap shrink-0">
              {isReadOnlySuperiorView ? 'Read-Only' : isOnline ? 'Private Sync' : 'Offline'}
            </span>
          </div>
        ) : (
          <form onSubmit={handleSaveTerritoryEdit} className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#0D2B45] dark:text-white">
                Edit Territory Name
              </span>
              <button
                type="button"
                onClick={() => setEditingTerritory(false)}
                aria-label="Cancel editing territory"
                className="p-1 rounded-lg text-[#0D2B45]/55 dark:text-[#EBF4FA]/55 hover:bg-[#F4F8FC] dark:hover:bg-[#13304C] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                required
                value={territoryNameDraft}
                onChange={(e) => {
                  setTerritoryNameDraft(e.target.value);
                  if (territoryEditError) setTerritoryEditError('');
                }}
                placeholder="Territory Name (e.g. Eidgaon Territory)"
                aria-label="Territory Name"
                className="w-full min-h-[40px] px-3 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
              />
              <input
                type="text"
                list="bd-districts-list"
                value={territoryDistrictDraft}
                onChange={(e) => setTerritoryDistrictDraft(e.target.value)}
                placeholder="District (optional)"
                aria-label="District"
                className="w-full min-h-[40px] px-3 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
              />
              <input
                type="text"
                value={territoryUpazilaDraft}
                onChange={(e) => setTerritoryUpazilaDraft(e.target.value)}
                placeholder="Upazila / Thana (optional)"
                aria-label="Upazila"
                className="w-full min-h-[40px] px-3 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
              />
            </div>
            {territoryEditError && (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-300">
                {territoryEditError}
              </p>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingTerritory(false)}
                className="min-h-[36px] px-3 rounded-xl border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-xs font-semibold text-[#0D2B45]/75 dark:text-[#EBF4FA]/75 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={territorySaving}
                className="min-h-[36px] px-3.5 rounded-xl bg-[#0E7C7B] hover:bg-[#095C5B] text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{territorySaving ? 'Saving...' : 'Save Territory'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Live Incoming Invites Banner (Member Invites & Superior Manager View Invites) */}
      {pendingInvites.length > 0 && (
        <div className="space-y-2.5" aria-live="polite">
          {pendingInvites.map((invite) => {
            const busy = inviteActionId === invite.inviteId;
            const isSuperiorInvite = invite.inviteType === 'superior';
            const inviteTerritory = invite.territoryName || invite.areaName;
            return (
              <div
                key={invite.inviteId}
                className={`rounded-2xl border shadow-sm p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isSuperiorInvite
                    ? 'bg-indigo-50/90 dark:bg-indigo-950/45 border-indigo-300/70 dark:border-indigo-500/45'
                    : 'bg-gradient-to-r from-[#E6FBF3] via-white to-[#EAF4FB] dark:from-[#0C2E2B] dark:via-[#0D2235] dark:to-[#102944] border-[#0E7C7B]/35 dark:border-[#149A99]/45'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl text-white flex items-center justify-center shrink-0 shadow-sm ${
                      isSuperiorInvite ? 'bg-indigo-600' : 'bg-[#0E7C7B]'
                    }`}
                  >
                    {isSuperiorInvite ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <BellRing className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wide ${
                          isSuperiorInvite
                            ? 'text-indigo-700 dark:text-indigo-300'
                            : 'text-[#0E7C7B] dark:text-[#22E3D0]'
                        }`}
                      >
                        {isSuperiorInvite ? 'Manager View Invite (Read-Only)' : 'Team Invite'}
                      </span>
                      {!isSuperiorInvite && invite.joinCode && (
                        <span className="px-1.5 py-0.5 rounded bg-[#0D2B45]/8 dark:bg-white/10 text-[10.5px] font-mono font-bold text-[#0D2B45] dark:text-white">
                          {invite.joinCode}
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-[#0D2B45] dark:text-white mt-0.5 leading-snug">
                      {isSuperiorInvite ? (
                        <>
                          {invite.fromName} invited you as Superior to view{' '}
                          <span className="text-indigo-700 dark:text-indigo-300">
                            {inviteTerritory}
                            {invite.district ? ` (${invite.district})` : ''}
                          </span>
                        </>
                      ) : (
                        <>
                          {invite.fromName} invited you to join{' '}
                          <span className="text-[#0E7C7B] dark:text-[#22E3D0]">
                            {inviteTerritory}
                            {invite.district ? ` (${invite.district})` : ''}
                          </span>
                        </>
                      )}
                    </p>
                    <p className="text-[11px] text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 mt-0.5">
                      {isSuperiorInvite
                        ? 'Read-only Manager View access — keeps your own private Territory untouched.'
                        : 'Accept to share Doctors, Hospitals, Sub-Areas & Team Members together.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleDeclineInvite(invite.inviteId)}
                    className="min-h-[38px] px-3 rounded-xl border border-[#0D2B45]/15 dark:border-[#EBF4FA]/20 bg-white dark:bg-[#071522] hover:bg-slate-50 dark:hover:bg-[#112A42] text-xs font-semibold text-[#0D2B45]/80 dark:text-[#EBF4FA]/85 disabled:opacity-50 cursor-pointer transition-colors"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleAcceptInvite(invite)}
                    className={`min-h-[38px] px-3.5 rounded-xl text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-colors active:scale-[0.97] ${
                      isSuperiorInvite
                        ? 'bg-indigo-600 hover:bg-indigo-700'
                        : 'bg-[#0E7C7B] hover:bg-[#095C5B]'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>
                      {busy
                        ? 'Saving...'
                        : isSuperiorInvite
                          ? 'Accept View Access'
                          : 'Accept & Join'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Firestore Sync Error Banner */}
      {firebaseSyncError && (
        <div
          role="alert"
          className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700/50 px-4 py-3 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-100"
        >
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">{firebaseSyncError}</p>
        </div>
      )}

      {/* Exact 4 Clean Tabs: Doctors | Hospitals | Areas | Team */}
      <div
        role="tablist"
        aria-label="Team workspace sections"
        className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10"
      >
        {(
          [
            {
              id: 'doctors' as TeamWorkspaceSubTab,
              label: 'Doctors',
              count: scopedDoctorsCount,
              icon: Stethoscope,
            },
            {
              id: 'hospitals' as TeamWorkspaceSubTab,
              label: 'Hospitals',
              count: scopedHospitalsBase.length,
              icon: Building2,
            },
            {
              id: 'areas' as TeamWorkspaceSubTab,
              label: 'Areas',
              count: teamSubAreas.length,
              icon: MapPin,
            },
            {
              id: 'team' as TeamWorkspaceSubTab,
              label: 'Team',
              count: scopedTeamMembers.length,
              icon: Users,
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveSubTab(tab.id)}
              className={`relative min-h-[44px] px-1 sm:px-3 rounded-xl text-[11px] sm:text-sm font-semibold flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white'
                  : 'text-[#0D2B45]/75 dark:text-[#EBF4FA]/75 hover:bg-[#F4F8FC] dark:hover:bg-[#071522]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>
                {tab.label}{' '}
                <span className="font-mono tabular-nums text-[10px] sm:text-[11px] opacity-80">
                  ({tab.count})
                </span>
              </span>
              {tab.id === 'team' && pendingInvites.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/* SUB-TAB 1: TEAM-SCOPED DOCTORS (with Sub-Area Filter & Badges)      */}
      {/* =================================================================== */}
      {activeSubTab === 'doctors' && (
        <DoctorsView areaScopeId={effectiveAreaId} embeddedInTeam />
      )}

      {/* =================================================================== */}
      {/* SUB-TAB 2: TEAM-SCOPED HOSPITALS (with Sub-Area Filter & Badges)    */}
      {/* =================================================================== */}
      {activeSubTab === 'hospitals' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 text-[#0D2B45]/45 dark:text-[#EBF4FA]/45 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={hospitalSearch}
                onChange={(e) => setHospitalSearch(e.target.value)}
                placeholder="Search hospitals, clinics, sub-area, or address..."
                aria-label="Search territory hospitals"
                className="w-full min-h-[44px] pl-10 pr-3 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-base md:text-sm text-[#0D2B45] dark:text-white placeholder:text-[#0D2B45]/45 dark:placeholder:text-[#EBF4FA]/40 focus:outline-none focus:border-[#0E7C7B]"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={hospitalDirectorySubAreaFilter}
                onChange={(e) => setHospitalDirectorySubAreaFilter(e.target.value)}
                aria-label="Filter hospitals by Sub-Area"
                className="flex-1 sm:flex-none sm:min-w-[180px] min-h-[44px] px-3 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-xs sm:text-sm font-medium text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
              >
                <option value="">All Sub-Areas ({scopedHospitalsBase.length})</option>
                {hospitalSubAreaOptions.map((areaName) => (
                  <option key={areaName} value={areaName}>
                    {areaName} ({hospitalCountBySubArea.get(areaName.toLowerCase()) || 0})
                  </option>
                ))}
              </select>

              {!isReadOnlySuperiorView && (
                <button
                  type="button"
                  onClick={() =>
                    openAddModal('Hospitals', {
                      Area_ID: effectiveAreaId,
                      ...(hospitalDirectorySubAreaFilter
                        ? { Sub_Area: hospitalDirectorySubAreaFilter }
                        : {}),
                    })
                  }
                  className="min-h-[44px] px-3.5 sm:px-4 rounded-xl bg-[#0D2B45] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Hospital</span>
                </button>
              )}
            </div>
          </div>

          {hospitalDirectorySubAreaFilter && (
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#E6FBF3] dark:bg-[#0C2E2B] text-[#0E7C7B] dark:text-[#22E3D0] font-semibold">
                <MapPin className="w-3.5 h-3.5" />
                <span>Sub-Area: {hospitalDirectorySubAreaFilter}</span>
              </span>
              <button
                type="button"
                onClick={() => setHospitalDirectorySubAreaFilter('')}
                className="text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 hover:text-[#0E7C7B] underline cursor-pointer"
              >
                Clear filter
              </button>
            </div>
          )}

          {scopedHospitals.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-8 text-center">
              <Building2 className="w-7 h-7 text-[#0E7C7B] dark:text-[#22E3D0] mx-auto mb-2" />
              <p className="font-display font-semibold text-base text-[#0D2B45] dark:text-white">
                {hospitalSearch || hospitalDirectorySubAreaFilter
                  ? 'No matching hospitals found'
                  : `No hospitals added in ${activeTerritoryName} yet`}
              </p>
              <p className="text-xs sm:text-sm text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 mt-1">
                {isReadOnlySuperiorView
                  ? 'This territory has no hospitals matching the current filter.'
                  : 'Add hospitals, clinics, or diagnostic centers linked to your Territory Sub-Areas.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {scopedHospitals.map((hosp, idx) => {
                const subAreaLabel = (hosp.Sub_Area || hosp.areaName || '').trim();
                const docCount = doctorCountByHospital.get(hosp.Hospital_ID) || 0;
                return (
                  <div
                    key={`${hosp.Hospital_ID}-${idx}`}
                    className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-4 sm:p-5 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="font-display font-bold text-base text-[#0D2B45] dark:text-white leading-snug">
                          {hosp.Hospital_Name}
                        </h2>
                        {!isReadOnlySuperiorView && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                openEditModal(
                                  'Hospitals',
                                  hosp as unknown as Record<string, unknown>
                                )
                              }
                              aria-label={`Edit ${hosp.Hospital_Name}`}
                              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[#0D2B45]/60 hover:text-[#0E7C7B] dark:text-[#EBF4FA]/60 dark:hover:text-[#149A99] hover:bg-[#EBF4FA] dark:hover:bg-[#133859]/50 cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                requestDeleteRecord(
                                  'Hospitals',
                                  hosp as unknown as Record<string, unknown>,
                                  hosp.Hospital_Name
                                )
                              }
                              aria-label={`Delete ${hosp.Hospital_Name}`}
                              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[#0D2B45]/55 hover:text-rose-600 dark:text-[#EBF4FA]/55 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-[#0E7C7B] dark:text-[#22E3D0] font-semibold">
                          {hosp.Hospital_Type || 'Hospital / Clinic'}
                        </span>
                        {subAreaLabel && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EBF4FA] dark:bg-[#102E47] text-[11px] font-semibold text-[#0D2B45] dark:text-[#9FD8F5]">
                            <MapPin className="w-3 h-3 text-[#0E7C7B] dark:text-[#22E3D0]" />
                            {subAreaLabel}
                          </span>
                        )}
                      </div>

                      <div className="mt-3 pt-3 border-t border-[#0D2B45]/8 dark:border-[#EBF4FA]/8 space-y-1.5 text-xs text-[#0D2B45]/75 dark:text-[#EBF4FA]/75">
                        {hosp.Address && (
                          <div className="flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#149A99] shrink-0 mt-0.5" />
                            <span>{hosp.Address}</span>
                          </div>
                        )}
                        {hosp.Phone && (
                          <div className="flex items-center gap-1.5 font-mono">
                            <Phone className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#149A99] shrink-0" />
                            <a href={`tel:${hosp.Phone}`} className="hover:underline">
                              {hosp.Phone}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#0D2B45]/8 dark:border-[#EBF4FA]/8 flex items-center justify-between gap-2">
                      <span className="text-xs font-mono tabular-nums text-[#0D2B45]/65 dark:text-[#EBF4FA]/65">
                        {docCount} linked doctor{docCount === 1 ? '' : 's'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setDoctorDirectoryHospitalFilter(hosp.Hospital_ID);
                          setActiveSubTab('doctors');
                        }}
                        className="min-h-[38px] px-3 rounded-xl bg-[#EBF4FA] dark:bg-[#133859] text-xs font-semibold text-[#0E7C7B] dark:text-[#7CE0DF] hover:bg-[#dcecf7] dark:hover:bg-[#1C4A73] transition-colors cursor-pointer"
                      >
                        View Doctors
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-TAB 3: TERRITORY SUB-AREAS / MARKETS MANAGER                    */}
      {/* =================================================================== */}
      {activeSubTab === 'areas' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="relative flex-1 max-w-md">
              <Search
                className="w-4 h-4 text-[#0D2B45]/45 dark:text-[#EBF4FA]/45 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={subAreaSearch}
                onChange={(e) => setSubAreaSearch(e.target.value)}
                placeholder="Search sub-areas, markets, or unions..."
                aria-label="Search sub-areas"
                className="w-full min-h-[44px] pl-10 pr-3 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-base md:text-sm text-[#0D2B45] dark:text-white placeholder:text-[#0D2B45]/45 dark:placeholder:text-[#EBF4FA]/40 focus:outline-none focus:border-[#0E7C7B]"
              />
            </div>

            {!isReadOnlySuperiorView && (
              <button
                type="button"
                onClick={handleOpenSubAreaAdd}
                className="min-h-[44px] px-4 rounded-xl bg-[#0D2B45] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Sub-Area</span>
              </button>
            )}
          </div>

          {/* Inline Add / Edit Sub-Area Form */}
          {showSubAreaForm && !isReadOnlySuperiorView && (
            <form
              onSubmit={handleSaveSubAreaSubmit}
              className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0E7C7B]/35 dark:border-[#149A99]/45 p-4 sm:p-5 space-y-3 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display font-bold text-sm sm:text-base text-[#0D2B45] dark:text-white">
                  {editingSubArea ? 'Edit Sub-Area / Market' : `Add Sub-Area under ${activeTerritoryName}`}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowSubAreaForm(false);
                    setEditingSubArea(null);
                  }}
                  aria-label="Close sub-area form"
                  className="p-1 rounded-lg text-[#0D2B45]/55 dark:text-[#EBF4FA]/55 hover:bg-[#F4F8FC] dark:hover:bg-[#13304C] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="subarea-name-input"
                    className="block text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] mb-1"
                  >
                    Sub-Area / Market Name *
                  </label>
                  <input
                    id="subarea-name-input"
                    type="text"
                    required
                    value={subAreaNameDraft}
                    onChange={(e) => {
                      setSubAreaNameDraft(e.target.value);
                      if (subAreaFormError) setSubAreaFormError('');
                    }}
                    placeholder="e.g. Eidgaon Bazar, Islamabad Union"
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="subarea-type-select"
                    className="block text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] mb-1"
                  >
                    Market Type
                  </label>
                  <select
                    id="subarea-type-select"
                    value={subAreaTypeDraft}
                    onChange={(e) => setSubAreaTypeDraft(e.target.value)}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                  >
                    {SUB_AREA_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="subarea-notes-input"
                  className="block text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] mb-1"
                >
                  Market Notes (Optional)
                </label>
                <input
                  id="subarea-notes-input"
                  type="text"
                  value={subAreaNotesDraft}
                  onChange={(e) => setSubAreaNotesDraft(e.target.value)}
                  placeholder="e.g. Market day: Sun & Wed · High pediatric volume"
                  className="w-full min-h-[42px] px-3 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                />
              </div>

              {subAreaFormError && (
                <p className="text-xs font-medium text-rose-600 dark:text-rose-300">
                  {subAreaFormError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowSubAreaForm(false);
                    setEditingSubArea(null);
                  }}
                  className="min-h-[38px] px-3.5 rounded-xl border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-xs font-semibold text-[#0D2B45]/75 dark:text-[#EBF4FA]/75 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={subAreaSaving}
                  className="min-h-[38px] px-4 rounded-xl bg-[#0E7C7B] hover:bg-[#095C5B] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {subAreaSaving
                      ? 'Saving...'
                      : editingSubArea
                        ? 'Update Sub-Area'
                        : 'Save Sub-Area'}
                  </span>
                </button>
              </div>
            </form>
          )}

          {filteredSubAreas.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-8 text-center">
              <MapPin className="w-7 h-7 text-[#0E7C7B] dark:text-[#22E3D0] mx-auto mb-2" />
              <p className="font-display font-semibold text-base text-[#0D2B45] dark:text-white">
                {subAreaSearch
                  ? 'No matching Sub-Areas found'
                  : `No Sub-Areas / Markets added under ${activeTerritoryName} yet`}
              </p>
              <p className="text-xs sm:text-sm text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 mt-1 max-w-md mx-auto">
                Add your 5–12 markets, unions, or bazar zones here. They automatically populate the
                required Sub-Area dropdown when adding Doctors and Hospitals.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredSubAreas.map((area) => {
                const key = area.Area_Name.trim().toLowerCase();
                const docCount = doctorCountBySubArea.get(key) || 0;
                const hospCount = hospitalCountBySubArea.get(key) || 0;
                const confirmingDelete = confirmDeleteSubAreaId === area.SubArea_ID;
                const deleting = deletingSubAreaId === area.SubArea_ID;

                return (
                  <article
                    key={area.SubArea_ID}
                    className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-4 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h2 className="font-display font-bold text-base text-[#0D2B45] dark:text-white leading-snug">
                            {area.Area_Name}
                          </h2>
                          <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-[#EBF4FA] dark:bg-[#102E47] text-[11px] font-semibold text-[#0E7C7B] dark:text-[#7CE0DF]">
                            {area.Market_Type || 'Market / Bazar'}
                          </span>
                        </div>

                        {!isReadOnlySuperiorView && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenSubAreaEdit(area)}
                              aria-label={`Edit ${area.Area_Name}`}
                              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#0D2B45]/60 hover:text-[#0E7C7B] dark:text-[#EBF4FA]/60 dark:hover:text-[#149A99] hover:bg-[#EBF4FA] dark:hover:bg-[#133859]/50 cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {!confirmingDelete ? (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteSubAreaId(area.SubArea_ID)}
                                aria-label={`Delete ${area.Area_Name}`}
                                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#0D2B45]/55 hover:text-rose-600 dark:text-[#EBF4FA]/55 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={deleting}
                                  onClick={() => void handleDeleteSubArea(area.SubArea_ID)}
                                  className="min-h-[32px] px-2 rounded-lg bg-rose-600 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                                >
                                  {deleting ? '...' : 'Delete'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteSubAreaId(null)}
                                  className="min-h-[32px] px-2 rounded-lg border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-[11px] font-semibold text-[#0D2B45]/70 dark:text-[#EBF4FA]/70 cursor-pointer"
                                >
                                  No
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {area.Notes && (
                        <p className="mt-2.5 text-xs text-[#0D2B45]/70 dark:text-[#EBF4FA]/70 leading-relaxed">
                          {area.Notes}
                        </p>
                      )}
                    </div>

                    <div className="pt-2.5 border-t border-[#0D2B45]/8 dark:border-[#EBF4FA]/8 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDoctorDirectorySubAreaFilter(area.Area_Name);
                          setActiveSubTab('doctors');
                        }}
                        className="flex-1 min-h-[36px] px-2.5 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] hover:bg-[#EBF4FA] dark:hover:bg-[#133859] border border-[#0D2B45]/8 dark:border-[#EBF4FA]/10 text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Stethoscope className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#22E3D0]" />
                        <span>{docCount} Doctors</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHospitalDirectorySubAreaFilter(area.Area_Name);
                          setActiveSubTab('hospitals');
                        }}
                        className="flex-1 min-h-[36px] px-2.5 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] hover:bg-[#EBF4FA] dark:hover:bg-[#133859] border border-[#0D2B45]/8 dark:border-[#EBF4FA]/10 text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Building2 className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#22E3D0]" />
                        <span>{hospCount} Hospitals</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-TAB 4: TEAM MEMBERS + SUPERIOR ACCESS + OFFICER PROFILE         */}
      {/* =================================================================== */}
      {activeSubTab === 'team' && (
        <div className="space-y-4">
          {/* Action Row (hidden in Read-Only Manager View) */}
          {!isReadOnlySuperiorView && (
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenInviteModal('member')}
                className="min-h-[44px] px-3 rounded-xl bg-[#0E7C7B] hover:bg-[#095C5B] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors active:scale-[0.98]"
              >
                <UserPlus className="w-4 h-4 shrink-0" />
                <span>Invite Member</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenInviteModal('superior')}
                className="min-h-[44px] px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors active:scale-[0.98]"
              >
                <Eye className="w-4 h-4 shrink-0" />
                <span>Invite Superior</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setJoinCodeInput('');
                  setJoinCodeError('');
                  setShowJoinModal(true);
                }}
                className="min-h-[42px] px-3 rounded-xl bg-[#0D2B45] hover:bg-[#133859] dark:bg-[#143757] dark:hover:bg-[#1B4972] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors active:scale-[0.98]"
              >
                <KeyRound className="w-4 h-4 shrink-0" />
                <span>Join Team</span>
              </button>

              <button
                type="button"
                onClick={() => openAddModal('MPO_Users', { Area_ID: effectiveAreaId })}
                className="min-h-[42px] px-3 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 hover:border-[#0E7C7B] text-[#0D2B45] dark:text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4 shrink-0 text-[#0E7C7B] dark:text-[#22E3D0]" />
                <span>Add Contact</span>
              </button>
            </div>
          )}

          {/* Search Team Members */}
          <div className="relative">
            <Search
              className="w-4 h-4 text-[#0D2B45]/45 dark:text-[#EBF4FA]/45 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={teamSearch}
              onChange={(e) => setTeamSearch(e.target.value)}
              placeholder="Search team members by name, role, or phone..."
              aria-label="Search territory team directory"
              className="w-full min-h-[44px] pl-10 pr-3 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-base md:text-sm text-[#0D2B45] dark:text-white placeholder:text-[#0D2B45]/45 dark:placeholder:text-[#EBF4FA]/40 focus:outline-none focus:border-[#0E7C7B]"
            />
          </div>

          {/* Team Members List */}
          {scopedTeamMembers.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-7 text-center">
              <Users className="w-7 h-7 text-[#0E7C7B] dark:text-[#22E3D0] mx-auto mb-2" />
              <p className="font-display font-semibold text-base text-[#0D2B45] dark:text-white">
                {teamSearch
                  ? 'No matching team members found'
                  : `No officers listed in ${activeTerritoryName} yet`}
              </p>
              <p className="text-xs sm:text-sm text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 mt-1">
                Tap Invite Member or share your Team Join Code below to collaborate together.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {scopedTeamMembers.map((member, idx) => {
                const phone = member.Phone_Number || member.Phone;
                const isSelf =
                  (currentUser?.uid && member.MPO_ID === currentUser.uid) ||
                  (teamSession.email &&
                    member.Email &&
                    member.Email.toLowerCase() === teamSession.email.toLowerCase());
                return (
                  <div
                    key={`${member.MPO_ID}-${idx}`}
                    className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-4 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h2 className="font-display font-bold text-base text-[#0D2B45] dark:text-white truncate">
                            {member.MPO_Name}
                          </h2>
                          {isSelf && (
                            <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/15 text-[10px] font-bold text-[#0A7D63] dark:text-[#5EEAD4] shrink-0">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-medium text-[#0E7C7B] dark:text-[#22E3D0] mt-0.5">
                          {member.Role || member.Designation || 'MPO'}
                          {member.Employee_ID || member.Employee_Code
                            ? ` · ${member.Employee_ID || member.Employee_Code}`
                            : ''}
                        </div>
                      </div>
                      {!isReadOnlySuperiorView && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              openEditModal(
                                'MPO_Users',
                                member as unknown as Record<string, unknown>
                              )
                            }
                            aria-label={`Edit ${member.MPO_Name}`}
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#0D2B45]/60 hover:text-[#0E7C7B] dark:text-[#EBF4FA]/60 dark:hover:text-[#149A99] hover:bg-[#EBF4FA] dark:hover:bg-[#133859]/50 cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() =>
                                requestDeleteRecord(
                                  'MPO_Users',
                                  member as unknown as Record<string, unknown>,
                                  member.MPO_Name
                                )
                              }
                              aria-label={`Delete ${member.MPO_Name}`}
                              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#0D2B45]/55 hover:text-rose-600 dark:text-[#EBF4FA]/55 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-2.5 border-t border-[#0D2B45]/8 dark:border-[#EBF4FA]/8 space-y-1.5 text-xs text-[#0D2B45]/75 dark:text-[#EBF4FA]/75">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#149A99] shrink-0" />
                        <span className="truncate">
                          {member.Area || activeTerritoryName}
                          {member.Territory ? ` · ${member.Territory}` : ''}
                        </span>
                      </div>
                      {phone && (
                        <div className="flex items-center gap-1.5 font-mono">
                          <Phone className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#149A99] shrink-0" />
                          <a href={`tel:${phone}`} className="hover:underline">
                            {phone}
                          </a>
                        </div>
                      )}
                      {member.Email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#149A99] shrink-0" />
                          <a href={`mailto:${member.Email}`} className="truncate hover:underline">
                            {member.Email}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Superior Access (Optional Read-Only Manager View) Section */}
          <section
            aria-label="Superior Manager View Access"
            className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-4 sm:p-5 space-y-3"
          >
            <div className="flex items-start justify-between gap-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <h3 className="font-display font-bold text-sm sm:text-base text-[#0D2B45] dark:text-white">
                    Superior Access (Manager View)
                  </h3>
                </div>
                <p className="text-[11.5px] text-[#0D2B45]/60 dark:text-[#EBF4FA]/65 mt-0.5">
                  Optional read-only visibility for your Manager/Superior. Private by default &amp; revocable anytime.
                </p>
              </div>
              {!isReadOnlySuperiorView && (
                <button
                  type="button"
                  onClick={() => handleOpenInviteModal('superior')}
                  className="min-h-[34px] px-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-500/35 text-[11px] font-bold text-indigo-700 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-950/75 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  + Invite Superior
                </button>
              )}
            </div>

            {teamSuperiors.length === 0 ? (
              <div className="rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/8 dark:border-[#EBF4FA]/8 px-3.5 py-3 flex items-center gap-2.5 text-xs text-[#0D2B45]/70 dark:text-[#EBF4FA]/70">
                <Lock className="w-4 h-4 text-[#0E7C7B] dark:text-[#22E3D0] shrink-0" />
                <span>
                  No Superior currently has view access. Only members of this Territory can view your Doctors, Hospitals, and Sub-Areas.
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                {teamSuperiors.map((sup) => {
                  const confirming = confirmRevokeSuperiorUid === sup.uid;
                  const revoking = revokingSuperiorUid === sup.uid;
                  return (
                    <div
                      key={sup.uid}
                      className="rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-3 flex items-center justify-between gap-2.5"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-display font-bold text-sm text-[#0D2B45] dark:text-white truncate">
                            {sup.officerName}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-500/20 text-[10px] font-bold text-indigo-700 dark:text-indigo-200 shrink-0">
                            View Only
                          </span>
                        </div>
                        <div className="text-[11px] text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 truncate mt-0.5">
                          {sup.role || 'Superior'}
                          {sup.email ? ` · ${sup.email}` : ''}
                          {sup.phone ? ` · ${sup.phone}` : ''}
                        </div>
                      </div>

                      {!isReadOnlySuperiorView && (
                        <div className="shrink-0">
                          {!confirming ? (
                            <button
                              type="button"
                              onClick={() => setConfirmRevokeSuperiorUid(sup.uid)}
                              className="min-h-[34px] px-2.5 rounded-xl border border-rose-200 dark:border-rose-500/35 bg-rose-50 dark:bg-rose-950/40 text-[11px] font-bold text-rose-600 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/60 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                              <span>Revoke</span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={revoking}
                                onClick={() => void handleRevokeSuperior(sup.uid)}
                                className="min-h-[32px] px-2.5 rounded-lg bg-rose-600 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                              >
                                {revoking ? '...' : 'Confirm Revoke'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmRevokeSuperiorUid(null)}
                                className="min-h-[32px] px-2 rounded-lg border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-[11px] font-semibold text-[#0D2B45]/75 dark:text-[#EBF4FA]/75 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Signed-in Officer Profile & Shareable Team Join Code Card — Cleanly at BOTTOM of Team Tab */}
          {!isReadOnlySuperiorView && (
            <section
              aria-label="Your Officer Profile and Team Join Code"
              className="rounded-2xl bg-gradient-to-br from-[#F7FBFD] to-[#EDF6FA] dark:from-[#0C2136] dark:to-[#0A1A2B] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 p-4 sm:p-5 space-y-3.5 mt-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#0D2B45] to-[#0E7C7B] text-white font-display font-bold text-base flex items-center justify-center shrink-0 shadow-sm">
                    {officerDisplayName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="font-display font-bold text-base text-[#0D2B45] dark:text-white truncate">
                        {officerDisplayName}
                      </h3>
                      {teamSession.role && (
                        <span className="px-2 py-0.5 rounded-md bg-[#0D2B45]/8 dark:bg-[#14385B] text-[10.5px] font-bold text-[#0D2B45]/80 dark:text-[#7CE0DF]">
                          {teamSession.role}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs">
                      <span className="inline-flex items-center gap-1 font-semibold text-[#0E7C7B] dark:text-[#22E3D0]">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {activeTerritoryName}
                          {activeScopeMeta ? ` · ${activeScopeMeta}` : ''}
                        </span>
                      </span>
                    </div>
                    {(teamSession.email || firebaseUserEmail || teamSession.phone) && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11.5px] text-[#0D2B45]/65 dark:text-[#EBF4FA]/65">
                        {(teamSession.email || firebaseUserEmail) && (
                          <span className="truncate">
                            {teamSession.email || firebaseUserEmail}
                          </span>
                        )}
                        {teamSession.phone && (
                          <span className="font-mono">{teamSession.phone}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <span className="px-2 py-1 rounded-lg bg-white dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 text-[10.5px] font-semibold text-[#0E7C7B] dark:text-[#22E3D0] whitespace-nowrap shrink-0">
                  {isOnline ? 'Synced' : 'Offline'}
                </span>
              </div>

              {/* Shareable Team Join Code Row */}
              <div className="pt-3 border-t border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#0D2B45]/55 dark:text-[#EBF4FA]/55">
                    Team Join Code
                  </div>
                  <p className="text-xs text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 mt-0.5">
                    Share this secret code with teammates in your Territory so they can collaborate with you.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#071522] border border-[#0E7C7B]/30 font-mono font-extrabold text-sm sm:text-base tracking-wider text-[#0D2B45] dark:text-[#5EEAD4]">
                    {activeJoinCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyJoinCode}
                    className="min-h-[40px] px-3.5 rounded-xl bg-[#0E7C7B] hover:bg-[#095C5B] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors active:scale-[0.97]"
                  >
                    {copiedJoinCode ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* INVITE MODAL (Member Collaboration OR Superior Manager View)      */}
      {/* ================================================================= */}
      {showInviteModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-member-title"
          className="fixed inset-0 z-50 bg-black/65 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 shadow-2xl p-5 space-y-4 max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="invite-member-title"
                  className="font-display font-bold text-lg text-[#0D2B45] dark:text-white"
                >
                  {inviteModalMode === 'superior'
                    ? 'Invite Superior (Manager View)'
                    : 'Invite Team Member'}
                </h2>
                <p className="text-xs text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 mt-0.5 leading-relaxed">
                  {inviteModalMode === 'superior' ? (
                    <>
                      Search your Manager/Superior by Email or Phone to grant optional{' '}
                      <strong className="text-indigo-700 dark:text-indigo-300">read-only</strong>{' '}
                      view access to{' '}
                      <span className="font-semibold text-[#0E7C7B] dark:text-[#22E3D0]">
                        {activeTerritoryName}
                      </span>
                      . You can revoke access anytime.
                    </>
                  ) : (
                    <>
                      Search registered officers by Email or Phone Number to collaborate inside{' '}
                      <span className="font-semibold text-[#0E7C7B] dark:text-[#22E3D0]">
                        {activeTerritoryName}
                      </span>
                      .
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                aria-label="Close invite modal"
                className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 hover:bg-[#F4F8FC] dark:hover:bg-[#13304C] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSearchOfficersSubmit} className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#0D2B45]/45 dark:text-[#EBF4FA]/45 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={inviteSearchInput}
                  onChange={(e) => {
                    setInviteSearchInput(e.target.value);
                    if (inviteSearchError) setInviteSearchError('');
                  }}
                  placeholder="Email or phone (e.g. 017...)"
                  aria-label="Search registered officer by email or phone"
                  className="w-full min-h-[44px] pl-9 pr-3 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                />
              </div>
              <button
                type="submit"
                disabled={inviteSearchLoading}
                className="min-h-[44px] px-4 rounded-xl bg-[#0D2B45] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] text-white text-xs sm:text-sm font-semibold whitespace-nowrap disabled:opacity-50 cursor-pointer"
              >
                {inviteSearchLoading ? 'Searching...' : 'Find'}
              </button>
            </form>

            {inviteSearchError && (
              <div
                role="alert"
                className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-300"
              >
                {inviteSearchError}
              </div>
            )}

            {inviteSearchDone && inviteSearchResults.length === 0 && !inviteSearchError && (
              <div className="rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-4 text-center space-y-1">
                <p className="text-xs font-semibold text-[#0D2B45] dark:text-white">
                  No registered officer found
                </p>
                <p className="text-[11px] text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                  {inviteModalMode === 'superior'
                    ? 'Ask your Superior/Manager to sign in to Field Pro – DI once first, then search their email or phone.'
                    : `Ask your teammate to sign in once first, or share your Join Code ${activeJoinCode}.`}
                </p>
              </div>
            )}

            {inviteSearchResults.length > 0 && (
              <div className="space-y-2">
                {inviteSearchResults.map((officer) => {
                  const alreadyInTeam =
                    (teamMeta?.members?.includes(officer.uid) ?? false) ||
                    (officer.teamId || officer.areaId) === ownTeamId;
                  const alreadySuperior =
                    (teamMeta?.superiorUids?.includes(officer.uid) ?? false) ||
                    teamSuperiors.some((s) => s.uid === officer.uid);
                  const alreadyGranted =
                    inviteModalMode === 'superior' ? alreadySuperior || alreadyInTeam : alreadyInTeam;
                  const sent = Boolean(sentInviteKeys[`${inviteModalMode}:${officer.uid}`]);
                  const sending = sendingInviteUid === officer.uid;
                  return (
                    <div
                      key={officer.uid}
                      className="rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-3 flex items-center justify-between gap-2.5"
                    >
                      <div className="min-w-0">
                        <div className="font-display font-bold text-sm text-[#0D2B45] dark:text-white truncate">
                          {officer.officerName}
                        </div>
                        <div className="text-[11px] text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 truncate">
                          {officer.email}
                          {officer.phone ? ` · ${officer.phone}` : ''}
                        </div>
                        {(officer.territoryName || officer.areaName) && (
                          <div className="text-[11px] text-[#0E7C7B] dark:text-[#22E3D0] truncate mt-0.5">
                            Territory: {officer.territoryName || officer.areaName}
                            {officer.district ? ` (${officer.district})` : ''}
                          </div>
                        )}
                      </div>

                      {alreadyGranted ? (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                          {alreadySuperior ? 'Has View' : 'In Team'}
                        </span>
                      ) : sent ? (
                        <span className="px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-500/15 text-[11px] font-bold text-[#0E7C7B] dark:text-[#22E3D0] inline-flex items-center gap-1 shrink-0">
                          <Check className="w-3.5 h-3.5" />
                          <span>Sent</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={sending}
                          onClick={() => void handleSendInvite(officer)}
                          className={`min-h-[36px] px-3 rounded-xl text-white text-xs font-bold inline-flex items-center gap-1 shrink-0 disabled:opacity-50 cursor-pointer ${
                            inviteModalMode === 'superior'
                              ? 'bg-indigo-600 hover:bg-indigo-700'
                              : 'bg-[#0E7C7B] hover:bg-[#095C5B]'
                          }`}
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>
                            {sending
                              ? 'Sending...'
                              : inviteModalMode === 'superior'
                                ? 'Send View Invite'
                                : 'Invite'}
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {inviteModalMode === 'member' && (
              <div className="pt-2 border-t border-[#0D2B45]/8 dark:border-[#EBF4FA]/8 flex items-center justify-between gap-2 text-xs">
                <span className="text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                  Or share Join Code:{' '}
                  <strong className="font-mono text-[#0D2B45] dark:text-white">
                    {activeJoinCode}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={handleCopyJoinCode}
                  className="text-xs font-bold text-[#0E7C7B] dark:text-[#22E3D0] hover:underline cursor-pointer"
                >
                  {copiedJoinCode ? 'Copied ✓' : 'Copy Code'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* JOIN TEAM BY CODE MODAL (Enter e.g. DI-4829)                      */}
      {/* ================================================================= */}
      {showJoinModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="join-team-title"
          className="fixed inset-0 z-50 bg-black/65 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowJoinModal(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="join-team-title"
                  className="font-display font-bold text-lg text-[#0D2B45] dark:text-white"
                >
                  Join Team by Code
                </h2>
                <p className="text-xs text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 mt-0.5">
                  Enter a teammate&apos;s Team Join Code (e.g.{' '}
                  <span className="font-mono font-semibold">DI-4829</span>) to immediately share
                  Doctors, Hospitals, Sub-Areas, and Team Members.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                aria-label="Close join team modal"
                className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 hover:bg-[#F4F8FC] dark:hover:bg-[#13304C] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleJoinCodeSubmit} className="space-y-3.5">
              <div>
                <label
                  htmlFor="team-join-code-input"
                  className="block text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] mb-1.5"
                >
                  Team Join Code
                </label>
                <input
                  id="team-join-code-input"
                  type="text"
                  autoCapitalize="characters"
                  value={joinCodeInput}
                  onChange={(e) => {
                    setJoinCodeInput(e.target.value.toUpperCase());
                    if (joinCodeError) setJoinCodeError('');
                  }}
                  placeholder="DI-4829"
                  className="w-full min-h-[46px] px-3.5 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base font-mono font-bold tracking-wider uppercase text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                />
              </div>

              {joinCodeError && (
                <div
                  role="alert"
                  className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-300"
                >
                  {joinCodeError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="min-h-[42px] px-4 rounded-xl border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-xs font-semibold text-[#0D2B45]/80 dark:text-[#EBF4FA]/80 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joinCodeSubmitting}
                  className="min-h-[42px] px-4 rounded-xl bg-[#0E7C7B] hover:bg-[#095C5B] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-colors"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{joinCodeSubmitting ? 'Joining...' : 'Join Team'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <datalist id="bd-districts-list">
        {BD_DISTRICTS.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>
    </div>
  );
};
