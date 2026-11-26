import React from 'react';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  CloudOff,
  GraduationCap,
  Home,
  Info,
  Lock,
  Moon,
  Pill,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { NavTab } from '../types';
import { ProductBriefModal } from './ProductBriefModal';
import { QuickAddModal } from './QuickAddModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { MedMentorFooter, MedMentorHeaderBadge } from './MedMentorBrand';
import { PWAInstallButton } from './PWAInstallButton';

const DESKTOP_NAV_ITEMS: { id: NavTab; label: string }[] = [
  { id: 'products', label: 'Products' },
  { id: 'detailing', label: 'Detailing' },
  { id: 'indications', label: 'Indications' },
  { id: 'dose-calculator', label: 'Dose Calc' },
  { id: 'knowledge', label: 'Knowledge' },
];

const MOBILE_BOTTOM_TABS: {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  matchTabs?: NavTab[];
}[] = [
  { id: 'dashboard', label: 'Home', icon: Home },
  { id: 'products', label: 'Products', icon: Pill, matchTabs: ['products', 'detailing'] },
  { id: 'dose-calculator', label: 'Dose', icon: Calculator },
  { id: 'knowledge', label: 'Knowledge', icon: GraduationCap },
  { id: 'team', label: 'Team', icon: Users },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    activeTab,
    setActiveTab,
    navigateHome,
    teamSession,
    isSuperAdmin,
    theme,
    toggleTheme,
    isOnline,
    isSyncing,
    isLoadingData,
    syncQueue,
    isApiConfigured,
    refreshFromServer,
    syncPendingQueue,
    toasts,
    dismissToast,
    recordModal,
    closeRecordModal,
  } = useApp();

  const handleSyncClick = async () => {
    if (syncQueue.length > 0 && isApiConfigured && isOnline) {
      await syncPendingQueue(false);
    } else {
      await refreshFromServer(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col overflow-x-clip bg-[#F4F8FC] dark:bg-[#071522] text-[#0D2B45] dark:text-[#EBF4FA] transition-colors">
      {/* Top Bar: Deep-navy-to-teal gradient header */}
      <header className="sticky top-0 z-30 h-[50px] md:h-16 bg-gradient-to-r from-[#071D33] via-[#0D2B45] to-[#0E7C7B] text-white border-b border-white/10 shadow-sm pt-safe">
        <div className="max-w-7xl mx-auto h-full px-3.5 sm:px-6 flex items-center justify-between gap-2.5 md:gap-6">
          {/* Zone 1: Brand Title — tapping ALWAYS navigates back to Home/Dashboard */}
          <div className="flex items-center gap-2.5 min-w-0 shrink-0">
            <button
              type="button"
              onClick={navigateHome}
              aria-label="Go to Field Pro – DI Home Dashboard"
              className="font-display font-bold text-[17px] md:text-lg tracking-tight text-white whitespace-nowrap shrink-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#149A99] rounded min-h-[44px] flex items-center cursor-pointer hover:text-[#EBF4FA] transition-colors"
            >
              Field Pro – DI
            </button>
            <div className="hidden lg:inline-flex">
              <MedMentorHeaderBadge />
            </div>
          </div>

          {/* Zone 2 (Desktop): 5 clean public navigation links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-4 lg:gap-6 text-sm font-medium"
          >
            {DESKTOP_NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`py-1.5 whitespace-nowrap shrink-0 transition-colors border-b-2 cursor-pointer ${
                    isActive
                      ? 'text-white border-[#149A99]'
                      : 'text-[#EBF4FA]/75 border-transparent hover:text-white hover:border-white/30'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Mobile Sync + Settings | Desktop Team CTA + Utility Icons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <PWAInstallButton />

            {/* Super Admin Mode indicator — visible ONLY when Super Admin is signed in */}
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('settings');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                title="Super Admin Mode active — click to manage or log out"
                className="min-h-[36px] md:min-h-[38px] px-2.5 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-200 hover:bg-amber-500/30 text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Super Admin</span>
                <span className="sm:hidden">Admin</span>
              </button>
            )}

            {/* Compact Sync Status Button (Mobile & Desktop) */}
            <button
              type="button"
              onClick={handleSyncClick}
              disabled={isSyncing || isLoadingData}
              aria-label={
                !isOnline
                  ? 'Offline — using cached data'
                  : syncQueue.length > 0
                  ? `Sync ${syncQueue.length} pending changes`
                  : 'Sync Google Sheet data'
              }
              title={
                !isOnline
                  ? 'Offline — cached data active'
                  : syncQueue.length > 0
                  ? `Sync ${syncQueue.length} pending changes`
                  : 'Sync data from Google Sheets'
              }
              className={`min-h-[38px] md:min-h-[40px] px-2.5 md:px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors active:scale-[0.97] cursor-pointer ${
                !isOnline
                  ? 'bg-amber-500/20 border-amber-400/40 text-amber-200'
                  : syncQueue.length > 0
                  ? 'bg-[#0E7C7B] border-[#149A99]/60 text-white'
                  : 'bg-white/10 border-white/15 text-[#EBF4FA] hover:bg-white/15'
              }`}
            >
              {!isOnline ? (
                <CloudOff className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <RefreshCw
                  className={`w-3.5 h-3.5 shrink-0 ${isSyncing || isLoadingData ? 'animate-spin' : ''}`}
                />
              )}
              <span className="tabular-nums">
                {!isOnline
                  ? syncQueue.length > 0
                    ? `Offline (${syncQueue.length})`
                    : 'Offline'
                  : isSyncing || isLoadingData
                  ? 'Syncing'
                  : syncQueue.length > 0
                  ? `Sync (${syncQueue.length})`
                  : 'Synced'}
              </span>
            </button>

            {/* Desktop Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              className="hidden md:flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-[#EBF4FA]/85 hover:bg-white/10 transition-colors cursor-pointer"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-300" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {/* Settings Icon (Mobile & Desktop) */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('settings');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              aria-label="Open Settings and Offline Sync"
              title="Settings & Offline Sync"
              className={`min-h-[44px] min-w-[44px] md:min-h-[40px] md:min-w-[40px] flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-[#0E7C7B] text-white'
                  : 'text-[#EBF4FA]/90 hover:bg-white/10'
              }`}
            >
              <Settings className="w-5 h-5 md:w-4 md:h-4" />
            </button>

            {/* Desktop Primary CTA: Team / Area Workspace */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('team');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`hidden md:inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl text-sm font-semibold whitespace-nowrap shrink-0 transition-colors active:scale-[0.98] cursor-pointer ${
                activeTab === 'team'
                  ? 'bg-[#149A99] text-white'
                  : 'bg-[#0E7C7B] hover:bg-[#149A99] text-white'
              }`}
            >
              {teamSession ? (
                <Users className="w-4 h-4 shrink-0" />
              ) : (
                <Lock className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="max-w-[130px] truncate">
                {teamSession ? teamSession.areaName : 'Team Login'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Viewport (tight zero-scroll fit on mobile Home, generous spacing elsewhere) */}
      <main
        className={`flex-1 w-full max-w-7xl mx-auto px-3.5 sm:px-6 ${
          activeTab === 'dashboard'
            ? 'pt-2.5 pb-[72px] sm:pt-5 md:pb-10'
            : 'pt-3 sm:pt-5 pb-12 md:pb-10'
        }`}
      >
        {children}
      </main>

      {/* Minimal Global Brand Footer (hidden on mobile Home since Home includes the compact MedMentor BD bar) */}
      <div className={activeTab === 'dashboard' ? 'hidden md:block' : 'pb-20 md:pb-0'}>
        <MedMentorFooter />
      </div>

      {/* Global Product Brief, Add/Edit & Delete Modals */}
      <ProductBriefModal />
      <QuickAddModal
        sheet={recordModal?.sheet || null}
        mode={recordModal?.mode || 'add'}
        initialRecord={recordModal?.initialRecord}
        onClose={closeRecordModal}
      />
      <DeleteConfirmModal />

      {/* Toast Notification Stack */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed z-50 bottom-20 md:bottom-6 right-3.5 left-3.5 sm:left-auto sm:w-96 flex flex-col gap-2 pointer-events-none"
        >
          {toasts.map((toast) => {
            const toneStyles =
              toast.type === 'success'
                ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white border-[#0E7C7B]/40'
                : toast.type === 'warning'
                ? 'bg-amber-950 text-amber-50 border-amber-700/60'
                : toast.type === 'error'
                ? 'bg-rose-950 text-rose-50 border-rose-700/60'
                : 'bg-[#0D2B45] text-white border-white/15';

            const Icon =
              toast.type === 'success'
                ? CheckCircle2
                : toast.type === 'warning' || toast.type === 'error'
                ? AlertTriangle
                : Info;

            return (
              <div
                key={toast.id}
                className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg ${toneStyles}`}
              >
                <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold leading-snug">{toast.title}</div>
                  {toast.message && (
                    <div className="text-xs opacity-85 mt-0.5 leading-relaxed">{toast.message}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  aria-label="Dismiss notification"
                  className="p-1 rounded hover:bg-white/10 shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Fixed 5-Tab Mobile Bottom Navigation Bar — Solid Opaque Surface (zero translucency) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-safe shadow-[0_-4px_16px_rgba(7,21,34,0.12)]"
      >
        <div className="grid grid-cols-5 h-[62px] items-center px-1">
          {MOBILE_BOTTOM_TABS.map((tab) => {
            const Icon = tab.id === 'team' && !teamSession ? Lock : tab.icon;
            const isActive = tab.matchTabs
              ? tab.matchTabs.includes(activeTab)
              : activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (tab.id === 'dashboard') {
                    navigateHome();
                  } else {
                    setActiveTab(tab.id);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                aria-current={isActive ? 'page' : undefined}
                className={`min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl transition-colors active:scale-[0.96] ${
                  isActive
                    ? 'text-[#0E7C7B] dark:text-[#149A99] font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
              >
                <Icon className="w-[21px] h-[21px]" />
                <span className="text-[11px] leading-none tracking-tight whitespace-nowrap">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
