import React from 'react';
import { useApp } from '../context/AppContext';
import { getValidVideoUrl } from '../services/api';
import { YouTubePlayIcon } from './MedMentorBrand';

interface WatchNowButtonProps {
  videoUrl?: string | null;
  fallbackUrl?: string | null;
  label?: string;
  size?: 'compact' | 'card' | 'full';
  className?: string;
}

export const WatchNowButton: React.FC<WatchNowButtonProps> = ({
  videoUrl,
  fallbackUrl,
  label = 'Watch Now',
  size = 'compact',
  className = '',
}) => {
  const { pushToast } = useApp();
  const validUrl = getValidVideoUrl(videoUrl) || getValidVideoUrl(fallbackUrl);

  const sizeClasses =
    size === 'full'
      ? 'w-full min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs gap-1.5 justify-center'
      : size === 'card'
      ? 'min-h-[36px] px-2.5 py-1 rounded-xl text-xs gap-1.5 justify-center'
      : 'min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] sm:text-xs gap-1.5 justify-center';

  const baseClasses = `inline-flex items-center font-semibold whitespace-nowrap shrink-0 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 dark:bg-red-950/45 dark:text-red-300 dark:border-red-800/60 dark:hover:bg-red-900/50 transition-colors active:scale-[0.98] cursor-pointer ${sizeClasses} ${className}`;

  if (validUrl) {
    return (
      <a
        href={validUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        aria-label={`${label} on YouTube`}
        className={baseClasses}
      >
        <YouTubePlayIcon className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        pushToast({
          type: 'info',
          title: 'ভিডিও শীঘ্রই যুক্ত হচ্ছে — MedMentor BD',
        });
      }}
      aria-label={`${label} — video coming soon`}
      className={baseClasses}
    >
      <YouTubePlayIcon className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </button>
  );
};
