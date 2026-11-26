import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface StickyBackBarProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  rightSlot?: React.ReactNode;
}

export const StickyBackBar: React.FC<StickyBackBarProps> = ({
  title,
  subtitle,
  onBack,
  backLabel = 'Back',
  rightSlot,
}) => {
  const { setActiveTab } = useApp();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      setActiveTab('dashboard');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="sticky top-[54px] md:top-16 z-20 -mx-3.5 sm:-mx-6 px-3.5 sm:px-6 py-2 bg-[#F4F8FC] dark:bg-[#071522] border-b border-[#0D2B45]/10 dark:border-[#EBF4FA]/10">
      <div className="flex items-center justify-between gap-2 min-h-[44px]">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={handleBack}
            aria-label={`Return to ${backLabel}`}
            className="min-h-[44px] -ml-1.5 px-2.5 rounded-xl text-[#0E7C7B] dark:text-[#149A99] hover:bg-[#EBF4FA] dark:hover:bg-[#0D2235] text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors active:scale-[0.97]"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>{backLabel}</span>
          </button>

          <span
            aria-hidden="true"
            className="h-4 w-px bg-[#0D2B45]/15 dark:bg-[#EBF4FA]/15 shrink-0"
          />

          <div className="min-w-0">
            <div className="font-display font-bold text-sm sm:text-base text-[#0D2B45] dark:text-white truncate leading-tight">
              {title}
            </div>
            {subtitle && (
              <div className="text-[11px] text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 truncate leading-tight">
                {subtitle}
              </div>
            )}
          </div>
        </div>

        {rightSlot && <div className="shrink-0 flex items-center gap-2">{rightSlot}</div>}
      </div>
    </div>
  );
};
