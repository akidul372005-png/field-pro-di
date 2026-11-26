import React from 'react';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Calculator,
  GraduationCap,
  Lock,
  Pill,
  Settings,
  Stethoscope,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { GlobalSearchBar } from './GlobalSearchBar';
import { MEDMENTOR_YOUTUBE_URL, YouTubePlayIcon } from './MedMentorBrand';

export const DashboardView: React.FC = () => {
  const {
    isApiConfigured,
    isSuperAdmin,
    teamSession,
    setActiveTab,
    setSelectedSpecialistId,
    startDetailingFlow,
  } = useApp();

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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const primaryTiles = [
    {
      id: 'products',
      label: 'Products',
      icon: Pill,
      iconGradient: 'bg-gradient-to-br from-teal-500 to-emerald-600 shadow-teal-600/25',
      hoverBorder: 'hover:border-teal-500/50 dark:hover:border-teal-400/50',
      onClick: () => navigateTo('products'),
    },
    {
      id: 'detailing',
      label: 'Detailing',
      icon: BookOpen,
      iconGradient: 'bg-gradient-to-br from-sky-500 to-blue-600 shadow-blue-600/25',
      hoverBorder: 'hover:border-sky-500/50 dark:hover:border-sky-400/50',
      onClick: () => {
        startDetailingFlow({ subTab: 'detailing' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    },
    {
      id: 'indications',
      label: 'Indications',
      icon: Activity,
      iconGradient: 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-600/25',
      hoverBorder: 'hover:border-indigo-500/50 dark:hover:border-indigo-400/50',
      onClick: () => navigateTo('indications'),
    },
    {
      id: 'specialists',
      label: 'Specialists',
      icon: Stethoscope,
      iconGradient: 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-600/25',
      hoverBorder: 'hover:border-emerald-500/50 dark:hover:border-emerald-400/50',
      onClick: () => navigateTo('specialists'),
    },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto space-y-2.5 sm:space-y-3.5">
      {/* Compact Search Bar (+ optional Setup Sync shortcut for Super Admin only) */}
      <div className="space-y-1.5">
        {!isApiConfigured && isSuperAdmin && (
          <div className="flex items-center justify-end px-0.5">
            <button
              type="button"
              onClick={() => navigateTo('settings')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0E7C7B] dark:text-[#149A99] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Setup Sync</span>
            </button>
          </div>
        )}
        <GlobalSearchBar compact />
      </div>

      {/* Modern Zero-Scroll Mobile App Launcher */}
      <section aria-label="Core modules" className="space-y-2.5 sm:space-y-3">
        {/* Rows 1 & 2: 2x2 Tactile Action Tiles */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {primaryTiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <button
                key={tile.id}
                type="button"
                onClick={tile.onClick}
                className={`group rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/8 dark:border-[#EBF4FA]/10 ${tile.hoverBorder} shadow-sm shadow-[#0D2B45]/[0.06] dark:shadow-black/25 hover:shadow-md px-3 py-2.5 sm:py-4 flex flex-col items-center justify-center gap-1.5 sm:gap-2 text-center transition-all duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-[#0E7C7B] cursor-pointer min-h-[78px] sm:min-h-[104px]`}
              >
                <div
                  className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl text-white flex items-center justify-center shrink-0 shadow-sm transition-transform duration-150 group-hover:scale-105 ${tile.iconGradient}`}
                >
                  <Icon className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                </div>
                <span className="font-display font-bold text-[13.5px] sm:text-[15px] text-[#0D2B45] dark:text-white tracking-tight leading-none whitespace-nowrap">
                  {tile.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Row 3: Deep-Navy-to-Teal Gradient Dose Calculator Banner */}
        <button
          type="button"
          onClick={() => navigateTo('dose-calculator')}
          className="group w-full min-h-[50px] sm:min-h-[58px] rounded-2xl bg-gradient-to-r from-[#071D33] via-[#0D2B45] to-[#0E7C7B] hover:brightness-110 text-white shadow-sm shadow-[#0D2B45]/20 px-3.5 sm:px-4 py-2.5 flex items-center justify-between gap-3 transition-all duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E7C7B] cursor-pointer"
        >
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/15 border border-white/15 text-white flex items-center justify-center shrink-0">
              <Calculator className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
            </div>
            <span className="font-display font-bold text-[14.5px] sm:text-base text-white tracking-tight truncate">
              Dose Calculator
            </span>
          </div>
          <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-white/90 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
        </button>

        {/* Row 4: Emerald-Tinted Knowledge Hub Card */}
        <button
          type="button"
          onClick={() => navigateTo('knowledge')}
          className="group w-full min-h-[52px] sm:min-h-[60px] rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50/70 to-white dark:from-emerald-950/45 dark:via-[#0D2235] dark:to-[#0D2235] border border-emerald-600/20 dark:border-emerald-400/25 hover:border-emerald-500/50 dark:hover:border-emerald-400/55 shadow-sm shadow-emerald-950/[0.04] dark:shadow-black/25 px-3.5 sm:px-4 py-2.5 flex items-center justify-between gap-3 text-left transition-all duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-[#0E7C7B] cursor-pointer"
        >
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-600/20 flex items-center justify-center shrink-0">
              <GraduationCap className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-[14.5px] sm:text-base text-[#0D2B45] dark:text-white tracking-tight leading-tight truncate">
                Knowledge Hub
              </div>
              <div className="text-[11px] sm:text-xs font-medium text-emerald-900/65 dark:text-emerald-200/70 truncate">
                MPO Desk · Medical Knowledge
              </div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-700 dark:text-emerald-400 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
        </button>

        {/* Row 5: Slim Team / Area Workspace Row */}
        <button
          type="button"
          onClick={() => navigateTo('team')}
          className="group w-full min-h-[44px] sm:min-h-[50px] rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 hover:border-[#0E7C7B]/55 dark:hover:border-[#149A99]/55 shadow-sm shadow-[#0D2B45]/[0.04] px-3.5 sm:px-4 py-2 flex items-center justify-between gap-2.5 text-left transition-all duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-[#0E7C7B] cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${
                teamSession
                  ? 'bg-[#0E7C7B] text-white'
                  : 'bg-[#F4F8FC] dark:bg-[#071522] text-[#0D2B45]/75 dark:text-[#EBF4FA]/80 border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10'
              }`}
            >
              {teamSession ? <Users className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            </div>
            <span className="font-display font-semibold text-[13.5px] sm:text-sm text-[#0D2B45] dark:text-white truncate">
              Team / Area Workspace
            </span>
          </div>

          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0E7C7B] dark:text-[#149A99] whitespace-nowrap shrink-0">
            <span className="max-w-[120px] truncate">
              {teamSession ? teamSession.areaName : 'Sign In'}
            </span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
          </span>
        </button>

        {/* Row 6: Sleek Single-Row MedMentor BD YouTube Bar */}
        <a
          href={MEDMENTOR_YOUTUBE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="MedMentor BD — মেডিকেল ও ফার্মাকোলজি ভিডিও — YouTube-এ যুক্ত থাকুন"
          className="group w-full min-h-[44px] sm:min-h-[48px] rounded-2xl bg-gradient-to-r from-rose-50/90 via-white to-white dark:from-rose-950/35 dark:via-[#0D2235] dark:to-[#0D2235] border border-rose-500/20 dark:border-rose-400/20 hover:border-rose-500/45 shadow-sm shadow-rose-950/[0.04] px-3.5 sm:px-4 py-2 flex items-center justify-between gap-2 transition-all duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-rose-600"
        >
          <div className="flex items-center gap-2 min-w-0">
            <YouTubePlayIcon className="w-5 h-5 shrink-0" />
            <span className="text-[12px] sm:text-xs font-medium text-[#0D2B45] dark:text-[#EBF4FA] truncate">
              <strong className="font-display font-bold text-[#0D2B45] dark:text-white">
                MedMentor BD
              </strong>{' '}
              <span aria-hidden="true" className="text-[#0D2B45]/40 dark:text-[#EBF4FA]/40">
                ·
              </span>{' '}
              <span className="text-[#0D2B45]/75 dark:text-[#EBF4FA]/75">
                মেডিকেল ও ফার্মাকোলজি ভিডিও
              </span>
            </span>
          </div>

          <span className="inline-flex items-center gap-0.5 text-[11.5px] sm:text-xs font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap shrink-0">
            <span>যুক্ত থাকুন</span>
            <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </a>
      </section>
    </div>
  );
};
