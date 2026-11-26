import React from 'react';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Building2,
  Calculator,
  Check,
  ChevronRight,
  CloudOff,
  GraduationCap,
  Lock,
  LogOut,
  MapPin,
  Pill,
  RefreshCw,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react';
import { useApp, TeamWorkspaceSubTab } from '../context/AppContext';
import { GlobalSearchBar } from './GlobalSearchBar';
import { MEDMENTOR_YOUTUBE_URL, YouTubePlayIcon } from './MedMentorBrand';

/** Decorative glossy capsules + dot-matrix SVG for Dose Calculator banner */
const DoseCapsulesArtwork: React.FC = () => (
  <svg
    viewBox="0 0 132 72"
    fill="none"
    aria-hidden="true"
    className="w-[106px] sm:w-[126px] h-[58px] sm:h-[66px] shrink-0 pointer-events-none select-none"
  >
    {/* Soft dot-matrix backdrop */}
    <g fill="#60D5FF" opacity="0.28">
      {[8, 18, 28, 38, 48, 58, 68].map((cx) =>
        [12, 24, 36, 48, 60].map((cy) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.4" />
        ))
      )}
    </g>

    <defs>
      <linearGradient id="capBlueTop" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#66C4FF" />
        <stop offset="55%" stopColor="#1B7DF5" />
        <stop offset="100%" stopColor="#0D47A1" />
      </linearGradient>
      <linearGradient id="capWhite" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="100%" stopColor="#D3E4F5" />
      </linearGradient>
      <linearGradient id="capTeal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#48E5FF" />
        <stop offset="100%" stopColor="#0F65D9" />
      </linearGradient>
    </defs>

    {/* Upper tilted blue/white capsule */}
    <g transform="translate(52 10) rotate(-32)">
      <rect x="0" y="0" width="46" height="17" rx="8.5" fill="url(#capWhite)" />
      <path d="M23 0H37.5A8.5 8.5 0 0 1 37.5 17H23V0Z" fill="url(#capBlueTop)" />
      <rect x="6" y="3" width="32" height="3.2" rx="1.6" fill="#FFFFFF" opacity="0.45" />
    </g>

    {/* Mid-left blue capsule */}
    <g transform="translate(50 42) rotate(-18)">
      <rect x="0" y="0" width="40" height="15" rx="7.5" fill="url(#capTeal)" />
      <rect x="5" y="2.8" width="24" height="2.8" rx="1.4" fill="#FFFFFF" opacity="0.45" />
    </g>

    {/* Bottom-right white/silver capsule */}
    <g transform="translate(76 47) rotate(-28)">
      <rect x="0" y="0" width="42" height="16" rx="8" fill="url(#capWhite)" />
      <path d="M0 8A8 8 0 0 1 8 0H21V16H8A8 8 0 0 1 0 8Z" fill="#EDF5FC" />
      <rect x="6" y="2.8" width="28" height="2.6" rx="1.3" fill="#FFFFFF" opacity="0.8" />
    </g>
  </svg>
);

/** Decorative fanned open-book SVG for Knowledge Hub banner */
const OpenBookArtwork: React.FC = () => (
  <svg
    viewBox="0 0 116 68"
    fill="none"
    aria-hidden="true"
    className="w-[86px] sm:w-[104px] h-[52px] sm:h-[60px] shrink-0 pointer-events-none select-none"
  >
    <defs>
      <linearGradient id="bookCover" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#14B8A6" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
      <linearGradient id="pageLight" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="100%" stopColor="#D1FAE5" />
      </linearGradient>
    </defs>

    {/* Base emerald cover */}
    <path
      d="M12 56C28 50 45 50 58 58C71 50 88 50 104 56L108 61C90 56 72 56 58 63C44 56 26 56 8 61L12 56Z"
      fill="url(#bookCover)"
    />
    {/* Left fanned pages */}
    <path d="M58 57C44 46 26 42 12 48L20 26C34 28 48 37 58 53V57Z" fill="url(#pageLight)" opacity="0.92" />
    <path d="M58 54C46 39 33 27 24 18L36 11C45 22 53 36 58 51V54Z" fill="#FFFFFF" opacity="0.95" />
    <path d="M58 52C52 34 45 19 42 7L51 6C55 20 57 35 58 50V52Z" fill="#ECFEFF" opacity="0.9" />
    {/* Right fanned pages */}
    <path d="M58 57C72 46 90 42 104 48L96 26C82 28 68 37 58 53V57Z" fill="url(#pageLight)" opacity="0.92" />
    <path d="M58 54C70 39 83 27 92 18L80 11C71 22 63 36 58 51V54Z" fill="#FFFFFF" opacity="0.95" />
    <path d="M58 52C64 34 71 19 74 7L65 6C61 20 59 35 58 50V52Z" fill="#ECFEFF" opacity="0.9" />
    {/* Spine highlight */}
    <circle cx="58" cy="58" r="3" fill="#065F46" />
  </svg>
);

/** Subtle team silhouette SVG for Team / Area Workspace row */
const TeamSilhouetteArtwork: React.FC = () => (
  <svg
    viewBox="0 0 88 44"
    fill="none"
    aria-hidden="true"
    className="w-[72px] sm:w-[84px] h-[38px] shrink-0 pointer-events-none select-none opacity-85 dark:opacity-50"
  >
    {/* Left silhouette */}
    <circle cx="18" cy="16" r="5.5" fill="#C7DDF6" />
    <path d="M8 42C8 32 12.5 26 18 26C23.5 26 28 32 28 42H8Z" fill="#D5E7FA" />
    {/* Center silhouette */}
    <circle cx="40" cy="14" r="6.5" fill="#B6D5F6" />
    <path d="M27 42C27 30 32.5 24 40 24C47.5 24 53 30 53 42H27Z" fill="#C2DDF9" />
    {/* Right silhouette */}
    <circle cx="64" cy="12" r="7.5" fill="#9BC4F2" />
    <path d="M49 42C49 28.5 55.5 22 64 22C72.5 22 79 28.5 79 42H49Z" fill="#A9CEF6" />
  </svg>
);

/** Curved teal stethoscope + motto footer above bottom navigation */
const StethoscopeMottoFooter: React.FC = () => (
  <div className="relative mt-2 pt-3 pb-3 px-4 overflow-hidden select-none">
    {/* Curved teal ambient ribbon at base */}
    <svg
      viewBox="0 0 400 72"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 w-full h-[64px] sm:h-[72px]"
    >
      <defs>
        <linearGradient id="footerWaveGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.92" />
          <stop offset="50%" stopColor="#0E9F9B" stopOpacity="0.88" />
          <stop offset="100%" stopColor="#0A3A6E" stopOpacity="0.96" />
        </linearGradient>
      </defs>
      <path
        d="M0 24C72 56 178 68 286 42C338 29 374 16 400 6V72H0V24Z"
        fill="url(#footerWaveGrad)"
      />
      <path
        d="M0 36C82 64 195 72 308 46C348 37 378 26 400 18V72H0V36Z"
        fill="#0A2D54"
        fillOpacity="0.35"
      />
    </svg>

    <div className="relative z-10 flex items-center justify-between gap-2 max-w-2xl mx-auto">
      {/* Realistic metallic-styled Stethoscope SVG on left */}
      <svg
        viewBox="0 0 185 88"
        fill="none"
        aria-hidden="true"
        className="w-[148px] sm:w-[175px] h-[70px] sm:h-[80px] -ml-2 shrink-0 drop-shadow-[0_4px_8px_rgba(6,29,62,0.22)]"
      >
        <defs>
          <linearGradient id="tubeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1E3A5F" />
            <stop offset="55%" stopColor="#0A1E3A" />
            <stop offset="100%" stopColor="#12385B" />
          </linearGradient>
          <linearGradient id="metalRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="45%" stopColor="#C9D8E6" />
            <stop offset="100%" stopColor="#627D98" />
          </linearGradient>
          <radialGradient id="diaphragmGrad" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="60%" stopColor="#DCE8F3" />
            <stop offset="100%" stopColor="#7C96B0" />
          </radialGradient>
        </defs>

        {/* Earpieces / Binaural tubing */}
        <path
          d="M6 26C26 24 44 38 66 56C88 73 114 78 138 66"
          stroke="url(#tubeGrad)"
          strokeWidth="6.5"
          strokeLinecap="round"
        />
        <path
          d="M22 14C46 10 82 22 92 40C102 58 84 68 62 58C44 50 38 30 56 18C74 6 112 16 126 42"
          stroke="url(#tubeGrad)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Subtle specular tubing highlight */}
        <path
          d="M24 14C48 11 80 22 90 39"
          stroke="#79B4E2"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.55"
        />
        {/* Metallic connector */}
        <rect
          x="120"
          y="48"
          width="14"
          height="6"
          rx="3"
          transform="rotate(24 120 48)"
          fill="url(#metalRing)"
        />
        {/* Stethoscope chestpiece / diaphragm */}
        <ellipse cx="144" cy="61" rx="22" ry="14" fill="#0B2239" opacity="0.24" />
        <ellipse cx="142" cy="57" rx="21" ry="13.5" fill="url(#metalRing)" />
        <ellipse cx="142" cy="54" rx="17" ry="10.5" fill="url(#diaphragmGrad)" />
        <ellipse cx="142" cy="52" rx="9" ry="5.5" fill="#0D2B45" opacity="0.88" />
        <ellipse cx="140.5" cy="50.5" rx="4" ry="2.2" fill="#8CC5F0" opacity="0.65" />
      </svg>

      {/* Handwritten Script Motto on right */}
      <div className="text-right pr-1 -mt-4">
        <p className="font-script font-bold text-[24px] sm:text-[28px] leading-[1.05] text-[#0A2D54] dark:text-[#EBF4FA] drop-shadow-[0_1px_1px_rgba(255,255,255,0.75)] dark:drop-shadow-none">
          Better Knowledge
          <br />
          Better Healthcare
        </p>
      </div>
    </div>
  </div>
);

export const DashboardView: React.FC = () => {
  const {
    isApiConfigured,
    isSuperAdmin,
    currentUser,
    teamSession,
    firebaseUserName,
    isOnline,
    isSyncing,
    isLoadingData,
    syncQueue,
    setActiveTab,
    openTeamSection,
    logoutTeam,
    setSelectedSpecialistId,
    startDetailingFlow,
    refreshFromServer,
    syncPendingQueue,
  } = useApp();

  const isTeamAuthenticated = Boolean(currentUser || teamSession);
  const officerHomeName =
    teamSession?.mpoName ||
    firebaseUserName ||
    currentUser?.displayName ||
    currentUser?.email?.split('@')[0] ||
    'Field Officer';
  const officerHomeArea = teamSession
    ? [teamSession.district, teamSession.areaName].filter(Boolean).join(' · ') ||
      teamSession.areaName
    : 'Complete Area Setup';

  const navigateTo = (
    tab:
      | 'products'
      | 'indications'
      | 'specialists'
      | 'dose-calculator'
      | 'knowledge'
      | 'team'
      | 'settings'
  ) => {
    if (tab === 'specialists') {
      setSelectedSpecialistId(null);
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const handleOpenTeamQuickTab = (subTab: TeamWorkspaceSubTab) => {
    openTeamSection(subTab);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const handleSyncClick = async () => {
    if (syncQueue.length > 0 && isApiConfigured && isOnline) {
      await syncPendingQueue(false);
    } else {
      await refreshFromServer(false);
    }
  };

  const primaryTiles = [
    {
      id: 'products',
      label: 'Products',
      icon: Pill,
      iconGradient: 'bg-gradient-to-br from-[#14DC9E] to-[#069368] shadow-emerald-600/30',
      curveStart: '#14D99A',
      curveEnd: '#5EEAD4',
      hoverBorder: 'hover:border-emerald-400/60 dark:hover:border-emerald-400/50',
      onClick: () => navigateTo('products'),
    },
    {
      id: 'detailing',
      label: 'Detailing',
      icon: BookOpen,
      iconGradient: 'bg-gradient-to-br from-[#3FA8FF] to-[#1364EC] shadow-blue-600/30',
      curveStart: '#2E9BFF',
      curveEnd: '#7CC4FF',
      hoverBorder: 'hover:border-sky-400/60 dark:hover:border-sky-400/50',
      onClick: () => {
        startDetailingFlow({ subTab: 'detailing' });
        window.scrollTo({ top: 0, behavior: 'auto' });
      },
    },
    {
      id: 'indications',
      label: 'Indications',
      icon: Activity,
      iconGradient: 'bg-gradient-to-br from-[#B56BFF] to-[#6B22E2] shadow-purple-600/30',
      curveStart: '#A855F7',
      curveEnd: '#D8B4FE',
      hoverBorder: 'hover:border-purple-400/60 dark:hover:border-purple-400/50',
      onClick: () => navigateTo('indications'),
    },
    {
      id: 'specialists',
      label: 'Specialists',
      icon: Stethoscope,
      iconGradient: 'bg-gradient-to-br from-[#20D7A6] to-[#089476] shadow-teal-600/30',
      curveStart: '#14B8A6',
      curveEnd: '#5EEAD4',
      hoverBorder: 'hover:border-teal-400/60 dark:hover:border-teal-400/50',
      onClick: () => navigateTo('specialists'),
    },
  ];

  const isBusySyncing = isSyncing || isLoadingData;

  return (
    <div className="w-full md:max-w-3xl mx-auto flex flex-col">
      {/* ================================================================= */}
      {/* CURVED WAVE HEADER (Mobile & Desktop Hero Banner)                 */}
      {/* Uses real Android safe-area top padding — zero fake status bar    */}
      {/* ================================================================= */}
      <section
        aria-label="Field Pro header"
        className="relative overflow-hidden bg-gradient-to-br from-[#061C3D] via-[#0B3363] to-[#07718C] text-white md:rounded-3xl pt-safe shadow-md"
      >
        {/* Subtle ambient radial highlight */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 -right-10 w-44 h-44 rounded-full bg-[#1ED9C6]/20 blur-2xl"
        />

        {/* Header Row: Brand + Subtitle (left) | Synced Pill + Divider + Gear (right) */}
        <div className="relative z-10 px-4 sm:px-6 pt-3.5 pb-11 sm:pt-5 sm:pb-12 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="font-display font-extrabold text-[23px] sm:text-[26px] tracking-tight leading-none whitespace-nowrap">
              <span className="text-white">Field Pro</span>{' '}
              <span className="text-[#1FE3D0]">– DI</span>
            </h1>
            <p className="text-[12px] sm:text-[13px] italic font-medium text-[#D6EEFA]/95 tracking-wide mt-1 whitespace-nowrap">
              Learn <span aria-hidden="true">•</span> Access <span aria-hidden="true">•</span> Excel
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => navigateTo('settings')}
                aria-label="Super Admin Mode active"
                title="Super Admin Mode active"
                className="min-h-[36px] min-w-[36px] px-2 rounded-full bg-amber-500/25 border border-amber-300/50 text-amber-200 inline-flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
              >
                <ShieldCheck className="w-4 h-4" />
              </button>
            )}

            {/* Green Synced ✓ Pill */}
            <button
              type="button"
              onClick={() => void handleSyncClick()}
              disabled={isBusySyncing}
              aria-label={
                !isOnline
                  ? 'Offline — cached data active'
                  : isBusySyncing
                  ? 'Syncing data'
                  : 'Synced — tap to refresh from Google Sheets'
              }
              className={`min-h-[38px] px-3 sm:px-3.5 rounded-full text-xs sm:text-[13px] font-bold inline-flex items-center gap-1.5 whitespace-nowrap shadow-sm transition-all active:scale-[0.96] cursor-pointer ${
                !isOnline
                  ? 'bg-amber-500/90 text-white border border-amber-300/40'
                  : 'bg-gradient-to-r from-[#14A466] to-[#12B778] hover:brightness-110 text-white border border-emerald-300/30 shadow-emerald-950/25'
              }`}
            >
              {!isOnline ? (
                <CloudOff className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <RefreshCw
                  className={`w-3.5 h-3.5 shrink-0 ${isBusySyncing ? 'animate-spin' : ''}`}
                />
              )}
              <span>
                {!isOnline
                  ? 'Offline'
                  : isBusySyncing
                  ? 'Syncing'
                  : syncQueue.length > 0
                  ? `Sync (${syncQueue.length})`
                  : 'Synced'}
              </span>
              {isOnline && !isBusySyncing && syncQueue.length === 0 && (
                <span className="w-4 h-4 rounded-full bg-white text-[#109D64] inline-flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 stroke-[3.2]" />
                </span>
              )}
            </button>

            {/* Hairline vertical divider + Settings gear */}
            <span aria-hidden="true" className="h-6 w-px bg-white/25 mx-0.5" />

            <button
              type="button"
              onClick={() => navigateTo('settings')}
              aria-label="Open Settings"
              title="Settings"
              className="min-h-[42px] min-w-[42px] -mr-1.5 rounded-full text-white/95 hover:bg-white/10 inline-flex items-center justify-center transition-colors active:scale-95 cursor-pointer"
            >
              <Settings className="w-[22px] h-[22px]" />
            </button>
          </div>
        </div>

        {/* Smooth Curved Wave Bottom Edge SVG */}
        <svg
          viewBox="0 0 400 44"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 w-full h-[34px] sm:h-[40px]"
        >
          <defs>
            <linearGradient id="waveRibbon" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#12A7B5" />
              <stop offset="55%" stopColor="#1AE0C7" />
              <stop offset="100%" stopColor="#14B8A6" />
            </linearGradient>
          </defs>
          {/* Bright teal accent wave ribbon */}
          <path
            d="M0 10C95 36 225 38 335 16C364 10 385 4 400 0V44H0V10Z"
            fill="url(#waveRibbon)"
          />
          {/* Foreground canvas cutout matching light/dark background */}
          <path
            d="M0 18C105 42 238 40 348 20C372 15 389 10 400 6V44H0V18Z"
            className="fill-[#EAF4FB] dark:fill-[#071522]"
          />
        </svg>
      </section>

      {/* ================================================================= */}
      {/* FLOATING WHITE PILL SEARCH BAR (Overlapping Curved Header Edge)   */}
      {/* ================================================================= */}
      <div className="relative z-20 -mt-5 sm:-mt-6 px-3.5 sm:px-2">
        <GlobalSearchBar variant="pill" />
      </div>

      {/* ================================================================= */}
      {/* CORE LAUNCHER BODY                                                */}
      {/* ================================================================= */}
      <section
        aria-label="Core modules"
        className="px-3.5 sm:px-2 pt-3 sm:pt-4 space-y-2.5 sm:space-y-3"
      >
        {/* Optional Setup Sync prompt for Super Admin only when unconfigured */}
        {!isApiConfigured && isSuperAdmin && (
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => navigateTo('settings')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0E7C7B] dark:text-[#149A99] hover:underline cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Setup Apps Script Sync</span>
            </button>
          </div>
        )}

        {/* 2x2 Tactile Action Grid */}
        <div className="grid grid-cols-2 gap-3">
          {primaryTiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <button
                key={tile.id}
                type="button"
                onClick={tile.onClick}
                className={`group relative overflow-hidden rounded-2xl bg-white dark:bg-[#0D2235] border border-white/90 dark:border-[#EBF4FA]/10 ${tile.hoverBorder} shadow-[0_6px_18px_rgba(10,40,75,0.08)] dark:shadow-black/30 hover:shadow-[0_10px_24px_rgba(10,40,75,0.12)] px-3.5 py-3 sm:py-4 flex flex-col items-center justify-center gap-2 text-center transition-all duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-[#0E7C7B] cursor-pointer min-h-[96px] sm:min-h-[112px]`}
              >
                {/* Subtle colored bottom-left curve accent matching mockup */}
                <svg
                  viewBox="0 0 180 34"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 w-full h-[26px] opacity-90 dark:opacity-55"
                >
                  <defs>
                    <linearGradient id={`tile-curve-${tile.id}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={tile.curveStart} stopOpacity="0.95" />
                      <stop offset="55%" stopColor={tile.curveEnd} stopOpacity="0.35" />
                      <stop offset="100%" stopColor={tile.curveEnd} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 0C10 24 44 31 126 32L180 34H0V0Z"
                    fill={`url(#tile-curve-${tile.id})`}
                  />
                </svg>

                {/* Circular Gradient Icon */}
                <div
                  className={`relative z-10 w-11 h-11 sm:w-12 sm:h-12 rounded-full text-white flex items-center justify-center shrink-0 shadow-md transition-transform duration-150 group-hover:scale-105 ${tile.iconGradient}`}
                >
                  <Icon className="w-[22px] h-[22px] sm:w-6 sm:h-6" />
                </div>

                {/* Bold Label + Subtle Right Chevron */}
                <div className="relative z-10 w-full flex items-center justify-center px-1">
                  <span className="font-display font-bold text-[15px] sm:text-base text-[#0D2B45] dark:text-white tracking-tight leading-none whitespace-nowrap">
                    {tile.label}
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#0D2B45]/60 dark:text-[#EBF4FA]/65 absolute right-0 transition-transform duration-150 group-hover:translate-x-0.5" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Stacked Banner 1: Dose Calculator (Deep Navy Gradient + Capsules SVG) */}
        <button
          type="button"
          onClick={() => navigateTo('dose-calculator')}
          className="group relative overflow-hidden w-full min-h-[64px] sm:min-h-[72px] rounded-2xl bg-gradient-to-r from-[#072047] via-[#0B3969] to-[#0B6D88] hover:brightness-105 text-white shadow-[0_8px_20px_rgba(7,32,71,0.22)] px-3.5 sm:px-4 py-2.5 flex items-center justify-between gap-2 text-left transition-all duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E7C7B] cursor-pointer"
        >
          <div className="relative z-10 flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-[#2CD4E8] to-[#0F83B8] text-white shadow-md shadow-cyan-950/30 flex items-center justify-center shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
            <span aria-hidden="true" className="h-8 w-px bg-white/20 shrink-0" />
            <div className="min-w-0">
              <div className="font-display font-bold text-[16px] sm:text-[17px] text-white tracking-tight leading-tight truncate">
                Dose Calculator
              </div>
              <div className="text-[11.5px] sm:text-xs font-medium text-[#CBE7F6] truncate mt-0.5">
                Calculate with Confidence
              </div>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-0.5 shrink-0 -my-2 -mr-1">
            <DoseCapsulesArtwork />
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-white/95 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
          </div>
        </button>

        {/* Stacked Banner 2: Knowledge Hub (Soft Mint-Emerald + Open-Book SVG) */}
        <button
          type="button"
          onClick={() => navigateTo('knowledge')}
          className="group relative overflow-hidden w-full min-h-[64px] sm:min-h-[72px] rounded-2xl bg-gradient-to-r from-[#E6FBF3] via-[#ECFDF7] to-[#D6F7EC] dark:from-[#0C2E2B] dark:via-[#0D2235] dark:to-[#0C3532] border border-emerald-500/20 dark:border-emerald-400/25 hover:border-emerald-500/45 shadow-[0_6px_18px_rgba(10,60,55,0.08)] dark:shadow-black/30 px-3.5 sm:px-4 py-2.5 flex items-center justify-between gap-2 text-left transition-all duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-[#0E7C7B] cursor-pointer"
        >
          <div className="relative z-10 flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-[#1CE09A] to-[#06996A] text-white shadow-md shadow-emerald-600/25 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <span
              aria-hidden="true"
              className="h-8 w-px bg-emerald-800/15 dark:bg-emerald-300/20 shrink-0"
            />
            <div className="min-w-0">
              <div className="font-display font-bold text-[16px] sm:text-[17px] text-[#0A2D54] dark:text-white tracking-tight leading-tight truncate">
                Knowledge Hub
              </div>
              <div className="text-[11.5px] sm:text-xs font-medium text-[#0B7C6B] dark:text-emerald-300 truncate mt-0.5">
                MPO Desk • Medical Knowledge
              </div>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-0.5 shrink-0 -my-2 -mr-0.5">
            <OpenBookArtwork />
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-[#0A2D54]/80 dark:text-emerald-300 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
          </div>
        </button>

        {/* Stacked Row 3: Team / Area Workspace — Compact Sign-In Card when signed out; Expanded Officer + Quick-Access Card when authenticated */}
        {isTeamAuthenticated ? (
          <div className="w-full rounded-2xl bg-white dark:bg-[#0D2235] border border-emerald-500/25 dark:border-[#149A99]/30 shadow-[0_6px_18px_rgba(10,40,75,0.08)] dark:shadow-black/30 p-3 sm:p-3.5 space-y-2.5">
            {/* Officer Name + District/Area Badge + Sign Out */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleOpenTeamQuickTab('doctors')}
                className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#14B8A6] to-[#0E7C7B] text-white shadow-sm flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display font-bold text-[14px] sm:text-[15px] text-[#0D2B45] dark:text-white leading-tight truncate group-hover:text-[#0E7C7B] dark:group-hover:text-[#22E3D0] transition-colors">
                    {officerHomeName}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 min-w-0">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-[#0A7D63] dark:text-[#5EEAD4] text-[10.5px] font-semibold truncate max-w-full">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{officerHomeArea}</span>
                    </span>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={logoutTeam}
                aria-label="Sign out of Team Workspace"
                className="min-h-[34px] px-2.5 py-1 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50/80 dark:bg-rose-950/35 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-300 text-[11.5px] font-bold inline-flex items-center gap-1 shrink-0 transition-colors active:scale-[0.96] cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>

            {/* 4-Pill Quick-Access Row: Doctors · Chambers · Hospitals · Team */}
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  { id: 'doctors' as TeamWorkspaceSubTab, label: 'Doctors', icon: Stethoscope },
                  { id: 'chambers' as TeamWorkspaceSubTab, label: 'Chambers', icon: MapPin },
                  { id: 'hospitals' as TeamWorkspaceSubTab, label: 'Hospitals', icon: Building2 },
                  { id: 'team' as TeamWorkspaceSubTab, label: 'Team', icon: Users },
                ] as const
              ).map((item) => {
                const QuickIcon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleOpenTeamQuickTab(item.id)}
                    className="min-h-[36px] px-1.5 py-1.5 rounded-xl bg-[#F2F8FC] dark:bg-[#112B44] hover:bg-[#E2F2F4] dark:hover:bg-[#163B5B] border border-[#0D2B45]/8 dark:border-white/10 text-[#0D2B45] dark:text-[#EBF4FA] text-[11px] sm:text-xs font-semibold inline-flex items-center justify-center gap-1 transition-colors active:scale-[0.96] cursor-pointer whitespace-nowrap"
                  >
                    <QuickIcon className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#22E3D0] shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => navigateTo('team')}
            className="group relative overflow-hidden w-full min-h-[52px] sm:min-h-[56px] rounded-2xl bg-white dark:bg-[#0D2235] border border-white/90 dark:border-[#EBF4FA]/10 hover:border-[#0E7C7B]/45 shadow-[0_5px_16px_rgba(10,40,75,0.07)] dark:shadow-black/25 px-3.5 sm:px-4 py-2 flex items-center justify-between gap-2 text-left transition-all duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-[#0E7C7B] cursor-pointer"
          >
            <div className="relative z-10 flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 bg-[#EBF3FB] dark:bg-[#13304C] text-[#0D2B45] dark:text-[#7CE0DF]">
                <Lock className="w-4 h-4" />
              </div>
              <span className="font-display font-bold text-[14.5px] sm:text-[15px] text-[#0D2B45] dark:text-white truncate">
                Team / Area Workspace
              </span>
            </div>

            <div className="relative z-10 flex items-center gap-1.5 shrink-0">
              <div className="hidden xs:block sm:block -my-2 -mr-2">
                <TeamSilhouetteArtwork />
              </div>
              <span className="inline-flex items-center gap-1 text-xs sm:text-[13px] font-bold whitespace-nowrap text-[#0B8F78] dark:text-[#22E3D0]">
                <span>Sign In</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
              </span>
            </div>
          </button>
        )}

        {/* MedMentor BD YouTube Bar with generous mt-3 spacing */}
        <div className="pt-1">
          <a
            href={MEDMENTOR_YOUTUBE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="MedMentor BD — মেডিকেল ও ফার্মাকোলজি ভিডিও — YouTube-এ যুক্ত থাকুন"
            className="group w-full min-h-[48px] sm:min-h-[52px] rounded-2xl bg-gradient-to-r from-[#FFF5F5] via-white to-[#FFF0F3] dark:from-rose-950/40 dark:via-[#0D2235] dark:to-[#1F1222] border border-rose-200/90 dark:border-rose-500/25 hover:border-rose-400/70 shadow-[0_5px_16px_rgba(190,18,60,0.08)] dark:shadow-black/25 px-3.5 sm:px-4 py-2 flex items-center justify-between gap-2 transition-all duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-rose-600"
          >
            <div className="flex items-center gap-2 min-w-0">
              <YouTubePlayIcon className="w-6 h-6 shrink-0" />
              <span className="font-display font-bold text-[13px] sm:text-sm text-[#0D2B45] dark:text-white whitespace-nowrap shrink-0">
                MedMentor BD
              </span>
              <span aria-hidden="true" className="h-4 w-px bg-[#0D2B45]/15 dark:bg-white/15 shrink-0" />
              <span className="text-[12px] sm:text-[13px] font-medium text-[#374B61] dark:text-[#C5D8E8] truncate">
                মেডিকেল ও ফার্মাকোলজি ভিডিও
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span aria-hidden="true" className="h-4 w-px bg-rose-300/60 dark:bg-rose-500/30" />
              <span className="inline-flex items-center gap-0.5 text-[12px] sm:text-[13px] font-bold text-[#D91E41] dark:text-rose-400 whitespace-nowrap">
                <span>যুক্ত থাকুন</span>
                <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </div>
          </a>
        </div>
      </section>

      {/* Curved Teal Stethoscope SVG Footer ("Better Knowledge, Better Healthcare") */}
      <StethoscopeMottoFooter />
    </div>
  );
};
