import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CloudOff,
  Code2,
  Copy,
  Database,
  KeyRound,
  Link2,
  Lock,
  LogOut,
  Moon,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sun,
  Trash2,
  Users,
  Wifi,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  BATCH_UPDATE_CODE_GS_SNIPPET,
  DEFAULT_API_URL,
  isConfiguredApiUrl,
} from '../services/api';
import { StickyBackBar } from './StickyBackBar';
import { MedMentorBrandCard } from './MedMentorBrand';

export const SettingsView: React.FC = () => {
  const {
    dataset,
    apiUrl,
    isApiConfigured,
    isOnline,
    isSyncing,
    isLoadingData,
    lastSyncedAt,
    syncQueue,
    teamSession,
    teamPinConfigured,
    updateTeamPin,
    logoutTeam,
    isSuperAdmin,
    superAdminSource,
    refreshSuperAdminStatus,
    setupSuperAdmin,
    loginSuperAdmin,
    changeSuperAdminPasscode,
    logoutSuperAdmin,
    setActiveTab,
    pushToast,
    theme,
    toggleTheme,
    updateApiUrl,
    refreshFromServer,
    syncPendingQueue,
    removeQueuedItem,
    clearSyncQueue,
    resetLocalStarterData,
  } = useApp();

  const [urlInput, setUrlInput] = useState(apiUrl);
  const [showSchemaGuide, setShowSchemaGuide] = useState(false);
  const [newTeamPin, setNewTeamPin] = useState('');

  // Super Admin form state
  const [adminPasscodeInput, setAdminPasscodeInput] = useState('');
  const [adminConfirmInput, setAdminConfirmInput] = useState('');
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
  const [adminSubmitting, setAdminSubmitting] = useState(false);

  // Super Admin change passcode state (only when claimed locally on server)
  const [showChangePasscode, setShowChangePasscode] = useState(false);
  const [currentAdminPasscode, setCurrentAdminPasscode] = useState('');
  const [nextAdminPasscode, setNextAdminPasscode] = useState('');
  const [nextAdminConfirm, setNextAdminConfirm] = useState('');

  useEffect(() => {
    setUrlInput(apiUrl);
  }, [apiUrl]);

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    updateApiUrl(urlInput);
  };

  const handleSaveAndTest = async () => {
    updateApiUrl(urlInput);
    if (isConfiguredApiUrl(urlInput)) {
      await refreshFromServer(false);
    }
  };

  const handleSaveTeamPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (updateTeamPin(newTeamPin)) {
      setNewTeamPin('');
    }
  };

  const handleSuperAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthError(null);

    if (superAdminSource === 'unconfigured') {
      if (adminPasscodeInput.trim().length < 6) {
        setAdminAuthError('Passcode must be at least 6 characters.');
        return;
      }
      if (adminPasscodeInput.trim() !== adminConfirmInput.trim()) {
        setAdminAuthError('Passcodes do not match.');
        return;
      }
      setAdminSubmitting(true);
      try {
        const res = await setupSuperAdmin(adminPasscodeInput.trim());
        if (!res.ok) {
          setAdminAuthError(res.error || 'Could not configure Super Admin passcode.');
        } else {
          setAdminPasscodeInput('');
          setAdminConfirmInput('');
        }
      } finally {
        setAdminSubmitting(false);
      }
      return;
    }

    if (!adminPasscodeInput.trim()) {
      setAdminAuthError('Enter the Super Admin passcode.');
      return;
    }

    setAdminSubmitting(true);
    try {
      const res = await loginSuperAdmin(adminPasscodeInput.trim());
      if (!res.ok) {
        setAdminAuthError(res.error || 'Invalid Super Admin passcode.');
      } else {
        setAdminPasscodeInput('');
      }
    } finally {
      setAdminSubmitting(false);
    }
  };

  const handleChangeSuperAdminPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthError(null);
    if (nextAdminPasscode.trim().length < 6) {
      setAdminAuthError('New passcode must be at least 6 characters.');
      return;
    }
    if (nextAdminPasscode.trim() !== nextAdminConfirm.trim()) {
      setAdminAuthError('New passcodes do not match.');
      return;
    }
    setAdminSubmitting(true);
    try {
      const res = await changeSuperAdminPasscode(
        currentAdminPasscode.trim(),
        nextAdminPasscode.trim()
      );
      if (!res.ok) {
        setAdminAuthError(res.error || 'Could not update passcode.');
      } else {
        setCurrentAdminPasscode('');
        setNextAdminPasscode('');
        setNextAdminConfirm('');
        setShowChangePasscode(false);
      }
    } finally {
      setAdminSubmitting(false);
    }
  };

  const knowledgeTotal =
    (dataset.MPO_Desk?.length || 0) + (dataset.Medical_Knowledge?.length || 0);

  return (
    <div className="space-y-4 sm:space-y-5 max-w-3xl mx-auto">
      {/* Sticky Top Back Bar — always visible when scrolling Settings */}
      <StickyBackBar
        title="Settings"
        subtitle={
          isSuperAdmin
            ? 'Theme, data updates, team session & Super Admin tools'
            : 'Display theme, data updates & team sign in'
        }
      />

      {/* ================================================================= */}
      {/* PUBLIC SETTINGS (Clean & Minimal for Public / MPO / Team Users)   */}
      {/* ================================================================= */}

      {/* 1. Display Theme & Team Workspace */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-5 flex flex-col justify-between gap-3">
          <div>
            <h2 className="font-display font-semibold text-base text-[#0D2B45] dark:text-white flex items-center gap-2">
              {theme === 'dark' ? (
                <Moon className="w-4 h-4 text-[#149A99]" />
              ) : (
                <Sun className="w-4 h-4 text-[#0E7C7B]" />
              )}
              <span>Display Theme</span>
            </h2>
            <p className="text-xs text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 mt-1">
              Switch between light mode and low-glare dark mode for evening chambers.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="min-h-[44px] w-full px-4 py-2 rounded-xl bg-[#EBF4FA] dark:bg-[#133859] text-[#0D2B45] dark:text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#dcecf7] dark:hover:bg-[#1C4A73] transition-colors cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>Switch to {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </section>

        <section className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-5 flex flex-col justify-between gap-3">
          <div>
            <h2 className="font-display font-semibold text-base text-[#0D2B45] dark:text-white flex items-center gap-2">
              {teamSession ? (
                <Users className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99]" />
              ) : (
                <Lock className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99]" />
              )}
              <span>Team Workspace</span>
            </h2>
            <p className="text-xs text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 mt-1">
              {teamSession
                ? `Signed in to ${teamSession.areaName}${
                    teamSession.mpoName ? ` (${teamSession.mpoName})` : ''
                  } · Available offline.`
                : 'Sign in with your Team email & password for private area doctors, chambers, hospitals & notes.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('team')}
              className="min-h-[44px] flex-1 px-4 rounded-xl bg-[#0D2B45] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span>{teamSession ? 'Open Team' : 'Team Sign In'}</span>
            </button>
            {teamSession && (
              <button
                type="button"
                onClick={logoutTeam}
                className="min-h-[44px] px-3.5 rounded-xl border border-rose-300 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-sm font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </section>
      </div>

      {/* 2. Check for Updates / Sync Now + Last Synced Time */}
      <section className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-display font-semibold text-base text-[#0D2B45] dark:text-white flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99]" />
            <span>App Data &amp; Updates</span>
          </h2>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#0D2B45]/65 dark:text-[#EBF4FA]/65">
            <span className="inline-flex items-center gap-1 font-medium">
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#149A99]" />
                  Online
                </>
              ) : (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Offline Ready
                </>
              )}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Last synced:{' '}
              {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : 'Cached on device'}
            </span>
          </div>
          <p className="text-xs text-[#0D2B45]/55 dark:text-[#EBF4FA]/55">
            Products, Detailing, Indications, Specialists, and Knowledge Hub update automatically when online and remain available offline.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refreshFromServer(false)}
          disabled={isLoadingData || !isOnline}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0E7C7B] hover:bg-[#095C5B] disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`} />
          <span>{isLoadingData ? 'Updating...' : 'Check for Updates'}</span>
        </button>
      </section>

      {/* ================================================================= */}
      {/* SUPER ADMIN TECHNICAL CONTROLS (Visible ONLY when Super Admin)    */}
      {/* ================================================================= */}
      {isSuperAdmin && (
        <div className="space-y-4 pt-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Super Admin Technical Controls
            </span>
          </div>

          {/* Admin 1: Google Apps Script Web App URL (Auto-publishes to all public users) */}
          <section className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display font-semibold text-base text-[#0D2B45] dark:text-white flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99]" />
                  <span>Google Apps Script Web App URL</span>
                </h2>
                <p className="text-xs text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 mt-1">
                  Saving here publishes this endpoint as the built-in default so all public and team users sync automatically with zero setup.
                </p>
              </div>
              <span className="text-xs font-medium text-[#0D2B45]/70 dark:text-[#EBF4FA]/70 whitespace-nowrap">
                {isApiConfigured ? 'Configured' : 'Not set'}
              </span>
            </div>

            <form onSubmit={handleSaveUrl} className="space-y-3">
              <div>
                <label
                  htmlFor="webapp-url"
                  className="block text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] mb-1.5"
                >
                  Web App Endpoint URL
                </label>
                <input
                  id="webapp-url"
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm font-mono text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="submit"
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0D2B45] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save &amp; Publish URL</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveAndTest}
                  disabled={isLoadingData || !isConfiguredApiUrl(urlInput)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#EBF4FA] dark:bg-[#133859] text-[#0D2B45] dark:text-white hover:bg-[#dcecf7] dark:hover:bg-[#1C4A73] disabled:opacity-50 text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`} />
                  <span>Test &amp; Fetch Data</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUrlInput(DEFAULT_API_URL);
                    updateApiUrl(DEFAULT_API_URL);
                  }}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-xs font-medium text-[#0D2B45]/75 dark:text-[#EBF4FA]/75 hover:border-[#0E7C7B] transition-colors cursor-pointer"
                >
                  Reset Default
                </button>
              </div>
            </form>
          </section>

          {/* Admin 2: Device Team PIN Override */}
          <section className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display font-semibold text-base text-[#0D2B45] dark:text-white flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99]" />
                  <span>Device Team PIN (Optional Offline Override)</span>
                </h2>
                <p className="text-xs text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 mt-1">
                  If your <span className="font-mono">Areas</span> sheet does not have a{' '}
                  <span className="font-mono">Team_PIN</span> column yet, set a local device PIN here for Area login.
                </p>
              </div>
              <span className="text-xs font-medium text-[#0E7C7B] dark:text-[#149A99] whitespace-nowrap">
                {teamPinConfigured ? 'Custom PIN set' : 'Using Sheet PIN / Area ID'}
              </span>
            </div>

            <form onSubmit={handleSaveTeamPin} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="password"
                inputMode="numeric"
                maxLength={16}
                value={newTeamPin}
                onChange={(e) => setNewTeamPin(e.target.value)}
                placeholder="Enter new local Team PIN (min 4 characters)"
                aria-label="New local Team PIN"
                className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm font-mono tracking-widest text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={newTeamPin.trim().length < 4}
                  className="min-h-[44px] px-4 rounded-xl bg-[#0E7C7B] hover:bg-[#095C5B] disabled:opacity-50 text-white text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer"
                >
                  Save PIN
                </button>
                {teamPinConfigured && (
                  <button
                    type="button"
                    onClick={() => updateTeamPin('')}
                    className="min-h-[44px] px-3.5 rounded-xl border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-xs font-semibold text-[#0D2B45]/75 dark:text-[#EBF4FA]/75 hover:border-rose-400 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </form>
          </section>

          {/* Admin 3: Offline Cache, Entity Counts & Sync Queue */}
          <section className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#0D2B45]/8 dark:border-[#EBF4FA]/8">
              <div>
                <h2 className="font-display font-semibold text-base text-[#0D2B45] dark:text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99]" />
                  <span>Offline Cache &amp; Sync Queue</span>
                </h2>
                <p className="text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 mt-1">
                  Inspect synced module counts, flush pending edits, or reset local starter data.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void syncPendingQueue(false)}
                  disabled={isSyncing || syncQueue.length === 0 || !isOnline || !isApiConfigured}
                  className="min-h-[44px] px-3.5 rounded-xl bg-[#0E7C7B] hover:bg-[#095C5B] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Sync Queue ({syncQueue.length})</span>
                </button>

                <button
                  type="button"
                  onClick={resetLocalStarterData}
                  className="min-h-[44px] px-3.5 rounded-xl border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-xs font-medium text-[#0D2B45]/75 dark:text-[#EBF4FA]/75 hover:border-[#0E7C7B] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Starter Data</span>
                </button>
              </div>
            </div>

            {/* Clean Cached Entity Counts (No Competitors) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
              {[
                ['Products', dataset.Products.length],
                ['Detailing', dataset.Doctor_Product_Detailing.length],
                ['Indications', dataset.Indications.length],
                ['Specialists', dataset.Departments.length],
                ['Knowledge', knowledgeTotal],
                ['Doctors', dataset.Doctors.length],
              ].map(([label, count]) => (
                <div
                  key={String(label)}
                  className="rounded-xl bg-[#F4F8FC] dark:bg-[#071522] px-3 py-2.5 border border-[#0D2B45]/8 dark:border-[#EBF4FA]/8"
                >
                  <div className="text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">{label}</div>
                  <div className="font-mono tabular-nums font-bold text-base text-[#0D2B45] dark:text-white mt-0.5">
                    {count}
                  </div>
                </div>
              ))}
            </div>

            {/* Queued Offline Entries */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA]">
                  Queued Offline Entries ({syncQueue.length})
                </h3>
                {syncQueue.length > 0 && (
                  <button
                    type="button"
                    onClick={clearSyncQueue}
                    className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                  >
                    Clear Queue
                  </button>
                )}
              </div>

              {syncQueue.length === 0 ? (
                <p className="text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 py-1.5">
                  No pending offline entries. Changes made offline automatically queue here and sync once internet returns.
                </p>
              ) : (
                <div className="divide-y divide-[#0D2B45]/8 dark:divide-[#EBF4FA]/8 border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 rounded-xl overflow-hidden">
                  {syncQueue.map((item) => (
                    <div
                      key={item.queueId}
                      className="px-3.5 py-3 flex items-start justify-between gap-3 bg-[#F4F8FC]/60 dark:bg-[#071522]/60"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#0D2B45] dark:text-white font-mono">
                          {item.action.toUpperCase()} · {item.sheet}
                        </div>
                        <div className="text-[11px] text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 font-mono truncate mt-0.5">
                          {JSON.stringify(item.data)}
                        </div>
                        {item.lastError && (
                          <div className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                            Note: {item.lastError}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeQueuedItem(item.queueId)}
                        aria-label="Remove queued item"
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#0D2B45]/50 hover:text-rose-600 dark:text-[#EBF4FA]/50 dark:hover:text-rose-400 shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Admin 4: Google Apps Script API Contract Reference */}
          <section className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-5">
            <button
              type="button"
              onClick={() => setShowSchemaGuide((prev) => !prev)}
              className="w-full min-h-[40px] flex items-center justify-between text-left cursor-pointer"
            >
              <span className="font-display font-semibold text-sm text-[#0D2B45] dark:text-white flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99]" />
                <span>Google Apps Script API Contract Reference</span>
              </span>
              <span className="text-xs font-semibold text-[#0E7C7B] dark:text-[#149A99]">
                {showSchemaGuide ? 'Hide' : 'View'}
              </span>
            </button>

            {showSchemaGuide && (
              <div className="mt-4 pt-4 border-t border-[#0D2B45]/8 dark:border-[#EBF4FA]/8 space-y-3 text-xs">
                <div>
                  <div className="font-semibold text-[#0D2B45] dark:text-white mb-1">
                    Code.gs Sheet List &amp; Columns
                  </div>
                  <pre className="p-3 rounded-xl bg-[#071522] text-[#EBF4FA] font-mono overflow-x-auto leading-relaxed">
{`const SHEET_NAMES = [
  'Hospitals',
  'Doctors',
  'Chambers',
  'Departments',
  'Indications',
  'Products',
  'Doctor_Product_Detailing',
  'MPO_Users',
  'Areas',
  'MPO_Desk',
  'Medical_Knowledge'
];

// Optional Team Login PIN columns:
// Areas sheet:     Area_ID | Area_Name | Zone | District | Assigned_MPO_ID | Team_PIN | Status
// MPO_Users sheet: MPO_ID | MPO_Name | Role | Employee_ID | Area_ID | Phone_Number | Email | PIN | Status

// Optional Video_URL / YouTube_URL column supported on:
// Products, Indications, MPO_Desk, Medical_Knowledge`}
                  </pre>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-[#0D2B45] dark:text-white">
                      Fast Batch Save Snippet (Code.gs)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(BATCH_UPDATE_CODE_GS_SNIPPET).then(() => {
                          pushToast({
                            type: 'success',
                            title: 'Code.gs batch snippet copied',
                            message: 'Paste inside doPost(e) and deploy a new Web App version.',
                          });
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#0E7C7B] hover:bg-[#095C5B] text-white text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy Snippet</span>
                    </button>
                  </div>
                  <pre className="max-h-72 p-3 rounded-xl bg-[#071522] text-[#EBF4FA] font-mono overflow-auto leading-relaxed">
                    {BATCH_UPDATE_CODE_GS_SNIPPET}
                  </pre>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ================================================================= */}
      {/* COMPACT SUPER ADMIN ACCESS (Bottom of Settings)                   */}
      {/* ================================================================= */}
      <section className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-sm text-[#0D2B45] dark:text-white flex items-center gap-2">
              <ShieldCheck
                className={`w-4 h-4 shrink-0 ${
                  isSuperAdmin
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-[#0E7C7B] dark:text-[#149A99]'
                }`}
              />
              <span>Super Admin Access</span>
            </h2>
            <p className="text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 mt-0.5">
              {isSuperAdmin
                ? 'Master data editing & sync configuration unlocked for this session.'
                : 'For authorized administrators to edit master records or configure sync.'}
            </p>
          </div>

          <span
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              isSuperAdmin
                ? 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200 border border-amber-300 dark:border-amber-500/40'
                : 'bg-[#EBF4FA] text-[#0D2B45]/75 dark:bg-[#133859] dark:text-[#EBF4FA]/80'
            }`}
          >
            {isSuperAdmin ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Super Admin Mode</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Read-Only</span>
              </>
            )}
          </span>
        </div>

        {isSuperAdmin ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-amber-50/80 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-700/40 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="text-xs text-amber-950 dark:text-amber-100">
                <span className="font-semibold">Admin session active.</span>{' '}
                {superAdminSource === 'env'
                  ? 'Passcode managed via server Secrets.'
                  : 'Sign out when finished to lock editing controls.'}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {superAdminSource === 'claimed' && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowChangePasscode((prev) => !prev);
                      setAdminAuthError(null);
                    }}
                    className="min-h-[38px] px-3 rounded-xl bg-white dark:bg-[#0D2235] border border-amber-300 dark:border-amber-600/50 text-xs font-semibold text-[#0D2B45] dark:text-white hover:border-[#0E7C7B] transition-colors cursor-pointer"
                  >
                    {showChangePasscode ? 'Cancel' : 'Change Passcode'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void logoutSuperAdmin()}
                  className="min-h-[38px] px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout Admin</span>
                </button>
              </div>
            </div>

            {showChangePasscode && superAdminSource === 'claimed' && (
              <form
                onSubmit={handleChangeSuperAdminPasscode}
                className="rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-3.5 space-y-2.5"
              >
                <div className="text-xs font-semibold text-[#0D2B45] dark:text-white">
                  Update Super Admin Passcode
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="password"
                    value={currentAdminPasscode}
                    onChange={(e) => setCurrentAdminPasscode(e.target.value)}
                    placeholder="Current passcode"
                    required
                    className="min-h-[42px] px-3 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                  />
                  <input
                    type="password"
                    value={nextAdminPasscode}
                    onChange={(e) => setNextAdminPasscode(e.target.value)}
                    placeholder="New passcode (min 6 chars)"
                    required
                    minLength={6}
                    className="min-h-[42px] px-3 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                  />
                  <input
                    type="password"
                    value={nextAdminConfirm}
                    onChange={(e) => setNextAdminConfirm(e.target.value)}
                    placeholder="Confirm new passcode"
                    required
                    minLength={6}
                    className="min-h-[42px] px-3 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                  />
                </div>
                {adminAuthError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{adminAuthError}</span>
                  </p>
                )}
                <button
                  type="submit"
                  disabled={adminSubmitting}
                  className="min-h-[40px] px-4 rounded-xl bg-[#0D2B45] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  {adminSubmitting ? 'Updating...' : 'Save New Passcode'}
                </button>
              </form>
            )}
          </div>
        ) : (
          <form onSubmit={handleSuperAdminSubmit} className="space-y-2.5">
            {superAdminSource === 'unconfigured' && (
              <div className="rounded-xl bg-[#EBF4FA]/75 dark:bg-[#0A1C2D] border border-[#0E7C7B]/20 px-3 py-2 text-xs text-[#0D2B45]/80 dark:text-[#EBF4FA]/80">
                <strong className="text-[#0D2B45] dark:text-white font-semibold">
                  First-time setup:
                </strong>{' '}
                Create a Super Admin passcode (minimum 6 characters).
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                value={adminPasscodeInput}
                onChange={(e) => {
                  setAdminPasscodeInput(e.target.value);
                  setAdminAuthError(null);
                }}
                placeholder={
                  superAdminSource === 'unconfigured'
                    ? 'Create Admin passcode (min 6 chars)'
                    : 'Enter Super Admin passcode'
                }
                aria-label="Super Admin passcode"
                required
                minLength={superAdminSource === 'unconfigured' ? 6 : 1}
                className="flex-1 min-h-[42px] px-3.5 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
              />

              {superAdminSource === 'unconfigured' && (
                <input
                  type="password"
                  value={adminConfirmInput}
                  onChange={(e) => {
                    setAdminConfirmInput(e.target.value);
                    setAdminAuthError(null);
                  }}
                  placeholder="Confirm passcode"
                  aria-label="Confirm Super Admin passcode"
                  required
                  minLength={6}
                  className="flex-1 min-h-[42px] px-3.5 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                />
              )}

              <button
                type="submit"
                disabled={adminSubmitting || superAdminSource === 'loading'}
                className="min-h-[42px] px-4 rounded-xl bg-[#0D2B45] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] disabled:opacity-50 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {adminSubmitting
                    ? 'Verifying...'
                    : superAdminSource === 'unconfigured'
                    ? 'Set Passcode'
                    : 'Unlock'}
                </span>
              </button>
            </div>

            {adminAuthError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{adminAuthError}</span>
              </p>
            )}
          </form>
        )}
      </section>

      <MedMentorBrandCard />
    </div>
  );
};
