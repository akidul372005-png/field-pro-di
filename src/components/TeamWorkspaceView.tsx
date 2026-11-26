import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Check,
  Copy,
  FileText,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Pin,
  Plus,
  Search,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserPlus,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StickyBackBar } from './StickyBackBar';
import { DoctorsView } from './DoctorsView';
import { AreaNote } from '../types';
import { buildAreaIdSlug } from '../services/firebaseTeam';

type AuthMode = 'signin' | 'signup';
type TeamSubTab = 'doctors' | 'hospitals' | 'notes' | 'team';

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

const NOTE_CATEGORIES = ['General', 'Chamber Schedule', 'Field Update', 'Reminder', 'Hospital'];

export const TeamWorkspaceView: React.FC = () => {
  const {
    dataset,
    teamSession,
    firebaseAuthReady,
    firebaseUserEmail,
    firebaseUserName,
    needsFirebaseAreaSetup,
    firebaseSyncError,
    areaNotes,
    loginTeamWithGoogle,
    loginTeamWithFirebase,
    registerTeamWithFirebase,
    completeFirebaseAreaProfile,
    saveTeamAreaNote,
    deleteTeamAreaNote,
    logoutTeam,
    isOnline,
    areaMap,
    openAddModal,
    openEditModal,
    requestDeleteRecord,
    setDoctorDirectoryHospitalFilter,
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
    if (needsFirebaseAreaSetup && firebaseUserName && !officerNameInput.trim()) {
      setOfficerNameInput(firebaseUserName);
    }
  }, [needsFirebaseAreaSetup, firebaseUserName, officerNameInput]);

  // Unlocked workspace state
  const [activeSubTab, setActiveSubTab] = useState<TeamSubTab>('doctors');
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [noteSearch, setNoteSearch] = useState('');
  const [copiedAreaId, setCopiedAreaId] = useState(false);

  // Area Note editor modal state
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | undefined>(undefined);
  const [editingNoteCreatedAt, setEditingNoteCreatedAt] = useState<string | undefined>(undefined);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteCategory, setNoteCategory] = useState('General');
  const [noteContent, setNoteContent] = useState('');
  const [notePinned, setNotePinned] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);

  const effectiveAreaId = teamSession?.areaId || '';

  const previewAreaSlug = useMemo(() => {
    if (!districtInput.trim() && !upazilaInput.trim() && !areaNameInput.trim() && !customAreaCode.trim()) {
      return '';
    }
    return buildAreaIdSlug(districtInput, upazilaInput, areaNameInput, customAreaCode);
  }, [districtInput, upazilaInput, areaNameInput, customAreaCode]);

  const scopedHospitals = useMemo(() => {
    const q = hospitalSearch.trim().toLowerCase();
    return dataset.Hospitals.filter((h) => {
      if (effectiveAreaId && h.Area_ID && h.Area_ID !== effectiveAreaId) return false;
      if (!q) return true;
      return (
        String(h.Hospital_Name ?? '').toLowerCase().includes(q) ||
        String(h.Hospital_Type ?? '').toLowerCase().includes(q) ||
        String(h.Address ?? '').toLowerCase().includes(q) ||
        String(h.Phone ?? '').toLowerCase().includes(q)
      );
    });
  }, [dataset.Hospitals, effectiveAreaId, hospitalSearch]);

  const doctorCountByHospital = useMemo(() => {
    const counts = new Map<string, number>();
    dataset.Doctors.forEach((d) => {
      if (effectiveAreaId && d.Area_ID && d.Area_ID !== effectiveAreaId) return;
      counts.set(d.Primary_Hospital_ID, (counts.get(d.Primary_Hospital_ID) || 0) + 1);
    });
    return counts;
  }, [dataset.Doctors, effectiveAreaId]);

  const scopedDoctorsCount = useMemo(() => {
    if (!teamSession) return 0;
    return dataset.Doctors.filter((d) => !effectiveAreaId || !d.Area_ID || d.Area_ID === effectiveAreaId)
      .length;
  }, [dataset.Doctors, teamSession, effectiveAreaId]);

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

  const filteredNotes = useMemo(() => {
    const q = noteSearch.trim().toLowerCase();
    if (!q) return areaNotes;
    return areaNotes.filter(
      (n) =>
        n.Title.toLowerCase().includes(q) ||
        n.Content.toLowerCase().includes(q) ||
        String(n.Category ?? '').toLowerCase().includes(q) ||
        String(n.Author_Name ?? '').toLowerCase().includes(q)
    );
  }, [areaNotes, noteSearch]);

  const handleGoogleSignIn = async () => {
    setAuthError('');
    setGoogleSubmitting(true);
    try {
      const res = await loginTeamWithGoogle();
      if (!res.ok) {
        setAuthError(res.error || 'Could not complete Google Sign-In.');
      } else if (!res.redirected) {
        setActiveSubTab('doctors');
      }
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

  const openNewNoteModal = () => {
    setEditingNoteId(undefined);
    setEditingNoteCreatedAt(undefined);
    setNoteTitle('');
    setNoteCategory('General');
    setNoteContent('');
    setNotePinned(false);
    setNoteEditorOpen(true);
  };

  const openEditNoteModal = (note: AreaNote) => {
    setEditingNoteId(note.Note_ID);
    setEditingNoteCreatedAt(note.Created_At);
    setNoteTitle(note.Title);
    setNoteCategory(note.Category || 'General');
    setNoteContent(note.Content);
    setNotePinned(Boolean(note.Pinned));
    setNoteEditorOpen(true);
  };

  const handleSaveNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim()) return;
    setNoteSaving(true);
    try {
      const ok = await saveTeamAreaNote({
        Note_ID: editingNoteId,
        Title: noteTitle.trim(),
        Content: noteContent.trim(),
        Category: noteCategory,
        Pinned: notePinned,
        Created_At: editingNoteCreatedAt,
      });
      if (ok) {
        setNoteEditorOpen(false);
      }
    } finally {
      setNoteSaving(false);
    }
  };

  const handleTogglePinNote = async (note: AreaNote) => {
    await saveTeamAreaNote({
      Note_ID: note.Note_ID,
      Title: note.Title,
      Content: note.Content,
      Category: note.Category,
      Pinned: !note.Pinned,
      Created_At: note.Created_At,
    });
  };

  const handleCopyAreaId = () => {
    if (!effectiveAreaId) return;
    void navigator.clipboard?.writeText(effectiveAreaId).then(() => {
      setCopiedAreaId(true);
      pushToast({
        type: 'success',
        title: 'Area ID copied',
        message: 'Teammates can use this Area ID when signing up to join your shared area workspace.',
      });
      window.setTimeout(() => setCopiedAreaId(false), 2000);
    });
  };

  // =========================================================================
  // AUTH INITIALIZING STATE (Only shown briefly before auth state resolves)
  // =========================================================================
  if (!firebaseAuthReady && !teamSession) {
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
  // PROFILE SETUP STATE (Signed in to Firebase Auth, missing users/{uid} doc)
  // =========================================================================
  if (needsFirebaseAreaSetup && !teamSession) {
    return (
      <div className="space-y-5">
        <StickyBackBar
          title="Complete Area Setup"
          subtitle={firebaseUserEmail || 'Private Team Workspace'}
          rightSlot={
            <button
              type="button"
              onClick={logoutTeam}
              className="min-h-[38px] px-3 rounded-xl border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-xs font-semibold text-rose-600 dark:text-rose-400 cursor-pointer"
            >
              Sign Out
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

            {/* Optional Join Existing Area ID toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowAreaCodeOption((prev) => !prev)}
                className="text-xs font-semibold text-[#0E7C7B] dark:text-[#149A99] hover:underline cursor-pointer"
              >
                {showAreaCodeOption
                  ? 'Hide shared Area ID field'
                  : 'Joining a teammate? Enter shared Area ID (optional)'}
              </button>
              {showAreaCodeOption && (
                <div className="mt-1.5">
                  <input
                    type="text"
                    value={customAreaCode}
                    onChange={(e) => setCustomAreaCode(e.target.value)}
                    placeholder="e.g. dhaka-dhanmondi"
                    className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-sm font-mono text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                  />
                </div>
              )}
              {previewAreaSlug && (
                <div className="mt-1 text-[11px] text-[#0D2B45]/55 dark:text-[#EBF4FA]/55 font-mono truncate">
                  Workspace ID: {previewAreaSlug}
                </div>
              )}
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
  // LOCKED STATE: Firebase Email/Password Sign In & Sign Up
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
                  Sign in with Google or email to manage private Doctors, Chambers, Hospitals, and
                  Area Notes. Stays logged in offline automatically.
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

                {/* Optional Join Existing Area ID toggle */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAreaCodeOption((prev) => !prev)}
                    className="text-xs font-semibold text-[#0E7C7B] dark:text-[#149A99] hover:underline cursor-pointer"
                  >
                    {showAreaCodeOption
                      ? 'Hide existing Area ID field'
                      : 'Joining a teammate? Enter shared Area ID (optional)'}
                  </button>
                  {showAreaCodeOption && (
                    <div className="mt-1.5 space-y-1">
                      <input
                        type="text"
                        value={customAreaCode}
                        onChange={(e) => setCustomAreaCode(e.target.value)}
                        placeholder="e.g. dhaka-dhanmondi-shahbagh"
                        className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-sm font-mono text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                      />
                    </div>
                  )}
                  {previewAreaSlug && (
                    <div className="mt-1 text-[11px] text-[#0D2B45]/55 dark:text-[#EBF4FA]/55 font-mono truncate">
                      Workspace ID: {previewAreaSlug}
                    </div>
                  )}
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
  // UNLOCKED STATE: Area-Scoped Private Firestore Workspace
  // =========================================================================
  const activeScopeMeta = [teamSession.district, teamSession.upazila]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-4 sm:space-y-5">
      <StickyBackBar
        title={teamSession.areaName}
        subtitle={
          teamSession.mpoName
            ? `${teamSession.mpoName}${teamSession.role ? ` · ${teamSession.role}` : ''}`
            : activeScopeMeta || 'Private Area Workspace'
        }
        rightSlot={
          <button
            type="button"
            onClick={logoutTeam}
            className="min-h-[40px] px-3 rounded-xl border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 bg-white dark:bg-[#0D2235] text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        }
      />

      {/* Area Context Header */}
      <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-[#0E7C7B] dark:text-[#149A99]">
            Private Area Workspace · {isOnline ? 'Live Cloud Sync' : 'Offline Cached'}
          </div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-[#0D2B45] dark:text-white tracking-tight mt-0.5 truncate">
            {teamSession.areaName}
          </h1>
          <p className="text-xs sm:text-sm text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 mt-0.5">
            {activeScopeMeta || 'Assigned Territory'}
            {teamSession.mpoName ? ` · ${teamSession.mpoName}` : ''}
          </p>
        </div>

        <button
          type="button"
          onClick={handleCopyAreaId}
          title="Copy Area ID to share with teammates in the same area"
          className="min-h-[38px] px-3 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 hover:border-[#0E7C7B] text-xs font-mono text-[#0D2B45]/80 dark:text-[#EBF4FA]/85 inline-flex items-center gap-1.5 self-start sm:self-center shrink-0 cursor-pointer transition-colors"
        >
          <span className="truncate max-w-[180px]">ID: {effectiveAreaId}</span>
          {copiedAreaId ? (
            <Check className="w-3.5 h-3.5 text-[#0E7C7B]" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-[#0D2B45]/50 dark:text-[#EBF4FA]/50" />
          )}
        </button>
      </div>

      {/* Firestore Sync Error Banner (shown only if Firestore security rules block access) */}
      {firebaseSyncError && (
        <div
          role="alert"
          className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700/50 px-4 py-3 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-100"
        >
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">{firebaseSyncError}</p>
        </div>
      )}

      {/* 4 Clean Workspace Sub-Tabs: Doctors | Hospitals | Notes | Team */}
      <div
        role="tablist"
        aria-label="Team workspace sections"
        className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10"
      >
        {(
          [
            {
              id: 'doctors' as TeamSubTab,
              label: 'Doctors',
              count: scopedDoctorsCount,
              icon: Stethoscope,
            },
            {
              id: 'hospitals' as TeamSubTab,
              label: 'Hospitals',
              count: scopedHospitals.length,
              icon: Building2,
            },
            {
              id: 'notes' as TeamSubTab,
              label: 'Notes',
              count: areaNotes.length,
              icon: FileText,
            },
            {
              id: 'team' as TeamSubTab,
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
              className={`min-h-[44px] px-1.5 sm:px-3 rounded-xl text-[11px] sm:text-sm font-semibold flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
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
            </button>
          );
        })}
      </div>

      {/* SUB-TAB 1: AREA-SCOPED DOCTORS & CHAMBERS */}
      {activeSubTab === 'doctors' && (
        <DoctorsView areaScopeId={effectiveAreaId} embeddedInTeam />
      )}

      {/* SUB-TAB 2: AREA-SCOPED HOSPITALS */}
      {activeSubTab === 'hospitals' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search
                className="w-4 h-4 text-[#0D2B45]/45 dark:text-[#EBF4FA]/45 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={hospitalSearch}
                onChange={(e) => setHospitalSearch(e.target.value)}
                placeholder="Search hospitals, clinics, or address..."
                aria-label="Search area hospitals"
                className="w-full min-h-[44px] pl-10 pr-3 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-base md:text-sm text-[#0D2B45] dark:text-white placeholder:text-[#0D2B45]/45 dark:placeholder:text-[#EBF4FA]/40 focus:outline-none focus:border-[#0E7C7B]"
              />
            </div>

            <button
              type="button"
              onClick={() => openAddModal('Hospitals', { Area_ID: effectiveAreaId })}
              className="min-h-[44px] px-4 rounded-xl bg-[#0D2B45] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Hospital</span>
            </button>
          </div>

          {scopedHospitals.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-8 text-center">
              <p className="font-display font-semibold text-base text-[#0D2B45] dark:text-white">
                No hospitals added in {teamSession.areaName} yet
              </p>
              <p className="text-xs sm:text-sm text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 mt-1">
                Add hospitals, clinics, or diagnostic centers for your private territory.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {scopedHospitals.map((hosp, idx) => {
                const area = areaMap.get(hosp.Area_ID);
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
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              openEditModal('Hospitals', hosp as unknown as Record<string, unknown>)
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
                      </div>

                      <div className="mt-1 text-xs text-[#0E7C7B] dark:text-[#149A99] font-medium">
                        {hosp.Hospital_Type || 'Hospital / Clinic'}
                      </div>

                      <div className="mt-3 pt-3 border-t border-[#0D2B45]/8 dark:border-[#EBF4FA]/8 space-y-1.5 text-xs text-[#0D2B45]/75 dark:text-[#EBF4FA]/75">
                        {hosp.Address && (
                          <div className="flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#149A99] shrink-0 mt-0.5" />
                            <span>{hosp.Address}</span>
                          </div>
                        )}
                        {area && (
                          <div className="text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                            Area: {area.Area_Name}
                            {area.District ? ` · ${area.District}` : ''}
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
                        className="min-h-[40px] px-3 rounded-xl bg-[#EBF4FA] dark:bg-[#133859] text-xs font-semibold text-[#0E7C7B] dark:text-[#7CE0DF] hover:bg-[#dcecf7] dark:hover:bg-[#1C4A73] transition-colors cursor-pointer"
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

      {/* SUB-TAB 3: PRIVATE AREA NOTES */}
      {activeSubTab === 'notes' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search
                className="w-4 h-4 text-[#0D2B45]/45 dark:text-[#EBF4FA]/45 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={noteSearch}
                onChange={(e) => setNoteSearch(e.target.value)}
                placeholder="Search private area notes..."
                aria-label="Search area notes"
                className="w-full min-h-[44px] pl-10 pr-3 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-base md:text-sm text-[#0D2B45] dark:text-white placeholder:text-[#0D2B45]/45 dark:placeholder:text-[#EBF4FA]/40 focus:outline-none focus:border-[#0E7C7B]"
              />
            </div>

            <button
              type="button"
              onClick={openNewNoteModal}
              className="min-h-[44px] px-4 rounded-xl bg-[#0D2B45] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Area Note</span>
            </button>
          </div>

          {filteredNotes.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-8 text-center">
              <FileText className="w-7 h-7 text-[#0E7C7B] dark:text-[#149A99] mx-auto mb-2" />
              <p className="font-display font-semibold text-base text-[#0D2B45] dark:text-white">
                {noteSearch ? 'No matching area notes' : `No area notes in ${teamSession.areaName} yet`}
              </p>
              <p className="text-xs sm:text-sm text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 mt-1">
                Save chamber updates, doctor availability reminders, or territory coordination notes.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredNotes.map((note) => (
                <article
                  key={note.Note_ID}
                  className={`rounded-2xl bg-white dark:bg-[#0D2235] border p-4 sm:p-5 flex flex-col justify-between gap-3 ${
                    note.Pinned
                      ? 'border-[#0E7C7B]/50 dark:border-[#149A99]/50'
                      : 'border-[#0D2B45]/10 dark:border-[#EBF4FA]/10'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {note.Pinned && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#0E7C7B] dark:text-[#7CE0DF]">
                              Pinned ·
                            </span>
                          )}
                          <span className="text-[11px] font-semibold text-[#0E7C7B] dark:text-[#149A99]">
                            {note.Category || 'General'}
                          </span>
                        </div>
                        <h2 className="font-display font-bold text-base text-[#0D2B45] dark:text-white leading-snug mt-0.5">
                          {note.Title}
                        </h2>
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleTogglePinNote(note)}
                          aria-label={note.Pinned ? 'Unpin note' : 'Pin note'}
                          title={note.Pinned ? 'Unpin' : 'Pin to top'}
                          className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg cursor-pointer transition-colors ${
                            note.Pinned
                              ? 'text-[#0E7C7B] dark:text-[#7CE0DF] bg-[#EBF4FA] dark:bg-[#133859]'
                              : 'text-[#0D2B45]/50 hover:text-[#0E7C7B] dark:text-[#EBF4FA]/50 hover:bg-[#EBF4FA] dark:hover:bg-[#133859]/50'
                          }`}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditNoteModal(note)}
                          aria-label={`Edit ${note.Title}`}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#0D2B45]/60 hover:text-[#0E7C7B] dark:text-[#EBF4FA]/60 dark:hover:text-[#149A99] hover:bg-[#EBF4FA] dark:hover:bg-[#133859]/50 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteTeamAreaNote(note.Note_ID)}
                          aria-label={`Delete ${note.Title}`}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#0D2B45]/55 hover:text-rose-600 dark:text-[#EBF4FA]/55 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-[#0D2B45]/80 dark:text-[#EBF4FA]/85 whitespace-pre-wrap leading-relaxed">
                      {note.Content}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-[#0D2B45]/8 dark:border-[#EBF4FA]/8 flex items-center justify-between gap-2 text-[11px] text-[#0D2B45]/55 dark:text-[#EBF4FA]/55">
                    <span className="truncate">{note.Author_Name || 'Area Officer'}</span>
                    <span className="font-mono tabular-nums shrink-0">
                      {new Date(note.Updated_At).toLocaleDateString()}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 4: AREA TEAM DIRECTORY */}
      {activeSubTab === 'team' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search
                className="w-4 h-4 text-[#0D2B45]/45 dark:text-[#EBF4FA]/45 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                placeholder="Search officers by name, role, or phone..."
                aria-label="Search area team directory"
                className="w-full min-h-[44px] pl-10 pr-3 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-base md:text-sm text-[#0D2B45] dark:text-white placeholder:text-[#0D2B45]/45 dark:placeholder:text-[#EBF4FA]/40 focus:outline-none focus:border-[#0E7C7B]"
              />
            </div>

            <button
              type="button"
              onClick={() => openAddModal('MPO_Users', { Area_ID: effectiveAreaId })}
              className="min-h-[44px] px-4 rounded-xl bg-[#0D2B45] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Team Member</span>
            </button>
          </div>

          {scopedTeamMembers.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-8 text-center">
              <p className="font-display font-semibold text-base text-[#0D2B45] dark:text-white">
                No officers listed in {teamSession.areaName} yet
              </p>
              <p className="text-xs sm:text-sm text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 mt-1">
                Officers who join this Area ID appear here automatically, or add teammates manually.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {scopedTeamMembers.map((member, idx) => {
                const phone = member.Phone_Number || member.Phone;
                return (
                  <div
                    key={`${member.MPO_ID}-${idx}`}
                    className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-4 sm:p-5 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="font-display font-bold text-base text-[#0D2B45] dark:text-white truncate">
                          {member.MPO_Name}
                        </h2>
                        <div className="text-xs font-medium text-[#0E7C7B] dark:text-[#149A99] mt-0.5">
                          {member.Role || member.Designation || 'MPO'}
                          {member.Employee_ID || member.Employee_Code
                            ? ` · ${member.Employee_ID || member.Employee_Code}`
                            : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          openEditModal('MPO_Users', member as unknown as Record<string, unknown>)
                        }
                        aria-label={`Edit ${member.MPO_Name}`}
                        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[#0D2B45]/60 hover:text-[#0E7C7B] dark:text-[#EBF4FA]/60 dark:hover:text-[#149A99] hover:bg-[#EBF4FA] dark:hover:bg-[#133859]/50 cursor-pointer shrink-0"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="pt-3 border-t border-[#0D2B45]/8 dark:border-[#EBF4FA]/8 space-y-1.5 text-xs text-[#0D2B45]/75 dark:text-[#EBF4FA]/75">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#149A99] shrink-0" />
                        <span className="truncate">
                          {member.Area || teamSession.areaName}
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
        </div>
      )}

      {/* AREA NOTE EDITOR MODAL */}
      {noteEditorOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#071522]/60 backdrop-blur-xs p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={editingNoteId ? 'Edit Area Note' : 'New Area Note'}
        >
          <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display font-bold text-lg text-[#0D2B45] dark:text-white">
                {editingNoteId ? 'Edit Area Note' : 'New Area Note'}
              </h2>
              <button
                type="button"
                onClick={() => setNoteEditorOpen(false)}
                aria-label="Close note editor"
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 hover:bg-[#F4F8FC] dark:hover:bg-[#133859] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNoteSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  maxLength={140}
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="e.g. Friday evening chamber update"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] mb-1">
                    Category
                  </label>
                  <select
                    value={noteCategory}
                    onChange={(e) => setNoteCategory(e.target.value)}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                  >
                    {NOTE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="pt-5 inline-flex items-center gap-2 text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={notePinned}
                    onChange={(e) => setNotePinned(e.target.checked)}
                    className="w-4 h-4 accent-[#0E7C7B] rounded"
                  />
                  <span>Pin note</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] mb-1">
                  Note Details *
                </label>
                <textarea
                  required
                  rows={5}
                  maxLength={3000}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Write territory notes, doctor availability updates, or reminders..."
                  className="w-full p-3.5 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B] resize-y"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setNoteEditorOpen(false)}
                  className="min-h-[44px] px-4 rounded-xl border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-xs sm:text-sm font-semibold text-[#0D2B45]/75 dark:text-[#EBF4FA]/75 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={noteSaving || !noteTitle.trim() || !noteContent.trim()}
                  className="min-h-[44px] px-5 rounded-xl bg-[#0E7C7B] hover:bg-[#095C5B] disabled:opacity-50 text-white text-xs sm:text-sm font-semibold cursor-pointer transition-colors"
                >
                  {noteSaving ? 'Saving...' : editingNoteId ? 'Update Note' : 'Save Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
