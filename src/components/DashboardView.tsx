import React from 'react';
import {
  Activity,
  ArrowRight,
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

export const DashboardView: React.FC = () => {
  const {
    isApiConfigured,
    isSuperAdmin,
    teamSession,
    setActiveTab,
    setSelectedSpecialistId,
    startDetailingFlow,
  } = useApp();

  const navigateTo = (tab: 'products' | 'indications' | 'specialists' | 'dose-calculator' | 'knowledge' | 'team' | 'settings') => {
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
      iconTone:
        'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
      hoverBorder: 'hover:border-teal-500/45 dark:hover:border-teal-400/45',
      onClick: () => navigateTo('products'),
    },
    {
      id: 'detailing',
      label: 'Detailing',
      icon: BookOpen,
      iconTone:
        'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
      hoverBorder: 'hover:border-sky-500/45 dark:hover:border-sky-400/45',
      onClick: () => {
        startDetailingFlow({ subTab: 'detailing' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    },
    {
      id: 'indications',
      label: 'Indications',
      icon: Activity,
      iconTone:
        'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
      hoverBorder: 'hover:border-indigo-500/45 dark:hover:border-indigo-400/45',
      onClick: () => navigateTo('indications'),
    },
    {
      id: 'specialists',
      label: 'Specialists',
      icon: Stethoscope,
      iconTone:
        'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
      hoverBorder: 'hover:border-emerald-500/45 dark:hover:border-emerald-400/45',
      onClick: () => navigateTo('specialists'),
    },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto space-y-3 sm:space-y-4">
      {/* Compact Top Section: Sleek Heading + Single-Line Search Bar */}
      <div className="space-y-2.5">
        <div className="flex items-baseline justify-between gap-2 px-0.5">
          <h1 className="font-display font-bold text-lg sm:text-xl text-[#0D2B45] dark:text-white tracking-tight leading-tight">
            Field Pro – DI
          </h1>
          {!isApiConfigured && isSuperAdmin ? (
            <button
              type="button"
              onClick={() => navigateTo('settings')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0E7C7B] dark:text-[#149A99] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Setup Sync</span>
            </button>
          ) : (
            <span className="text-xs font-medium text-[#0D2B45]/55 dark:text-[#EBF4FA]/55 whitespace-nowrap">
              Drug International Ltd.
            </span>
          )}
        </div>

        <GlobalSearchBar />
      </div>

      {/* Native-Style App Launcher Grid */}
      <section aria-label="Core modules" className="space-y-3">
        {/* Rows 1 & 2: 2x2 Compact App Tiles (Products, Detailing, Indications, Specialists) */}
        <div className="grid grid-cols-2 gap-3">
          {primaryTiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <button
                key={tile.id}
                type="button"
                onClick={tile.onClick}
                className={`group rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/8 dark:border-[#EBF4FA]/10 ${tile.hoverBorder} shadow-sm shadow-[#0D2B45]/[0.04] dark:shadow-black/20 px-3.5 py-4 sm:py-5 flex flex-col items-center justify-center gap-2.5 text-center transition-all active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[#0E7C7B] cursor-pointer min-h-[94px] sm:min-h-[112px]`}
              >
                <div
                  className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-[1.04] ${tile.iconTone}`}
                >
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <span className="font-display font-bold text-[14px] sm:text-[15px] text-[#0D2B45] dark:text-white tracking-tight leading-none whitespace-nowrap">
                  {tile.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Row 3: Full-Width Sleek Dark Navy Dose Calculator Banner */}
        <button
          type="button"
          onClick={() => navigateTo('dose-calculator')}
          className="group w-full min-h-[58px] sm:min-h-[62px] rounded-2xl bg-[#0D2B45] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] text-white shadow-sm shadow-[#0D2B45]/15 px-4 py-3 flex items-center justify-between gap-3 transition-all active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E7C7B] cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/15 text-white flex items-center justify-center shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
            <span className="font-display font-bold text-[15px] sm:text-base text-white tracking-tight truncate">
              Dose Calculator
            </span>
          </div>
          <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-white/90 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </button>

        {/* Row 4: Full-Width Clean Teal-Tinted Knowledge Hub Banner */}
        <button
          type="button"
          onClick={() => navigateTo('knowledge')}
          className="group w-full min-h-[62px] sm:min-h-[66px] rounded-2xl bg-gradient-to-r from-teal-50/85 via-white to-white dark:from-[#0E7C7B]/20 dark:via-[#0D2235] dark:to-[#0D2235] border border-teal-700/15 dark:border-[#149A99]/25 hover:border-[#0E7C7B]/50 dark:hover:border-[#149A99]/60 shadow-sm shadow-[#0D2B45]/[0.04] dark:shadow-black/20 px-4 py-3 flex items-center justify-between gap-3 text-left transition-all active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[#0E7C7B] cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-teal-600/12 dark:bg-teal-400/15 text-[#0E7C7B] dark:text-[#7CE0DF] flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-[15px] sm:text-base text-[#0D2B45] dark:text-white tracking-tight leading-tight truncate">
                Knowledge Hub
              </div>
              <div className="text-[11px] sm:text-xs font-medium text-[#0D2B45]/60 dark:text-[#EBF4FA]/65 truncate mt-0.5">
                MPO Desk · Medical Knowledge
              </div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-[#0E7C7B] dark:text-[#149A99] shrink-0 transition-transform group-hover:translate-x-0.5" />
        </button>

        {/* Row 5: Slim Compact Team / Area Workspace Bar */}
        <button
          type="button"
          onClick={() => navigateTo('team')}
          className="group w-full min-h-[52px] rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 hover:border-[#0E7C7B]/55 dark:hover:border-[#149A99]/55 shadow-sm shadow-[#0D2B45]/[0.03] px-4 py-2.5 flex items-center justify-between gap-3 text-left transition-all active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[#0E7C7B] cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                teamSession
                  ? 'bg-[#0E7C7B] text-white'
                  : 'bg-[#F4F8FC] dark:bg-[#071522] text-[#0D2B45]/75 dark:text-[#EBF4FA]/80 border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10'
              }`}
            >
              {teamSession ? <Users className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </div>
            <span className="font-display font-semibold text-sm text-[#0D2B45] dark:text-white truncate">
              Team / Area Workspace
            </span>
          </div>

          <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-[#0E7C7B] dark:text-[#149A99] whitespace-nowrap shrink-0">
            <span className="max-w-[130px] truncate">
              {teamSession ? teamSession.areaName : 'Sign In'}
            </span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </button>
      </section>
    </div>
  );
};
