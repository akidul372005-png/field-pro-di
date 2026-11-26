import React from 'react';
import { ArrowUpRight } from 'lucide-react';

export const MEDMENTOR_YOUTUBE_URL =
  'https://www.youtube.com/@MedMentor_BD?sub_confirmation=1';

export const YouTubePlayIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    className={className}
  >
    <rect x="1.5" y="4.5" width="21" height="15" rx="4.2" fill="#FF0000" />
    <path d="M10 8.8L15.8 12L10 15.2V8.8Z" fill="#FFFFFF" />
  </svg>
);

export const MedMentorHeaderBadge: React.FC = () => (
  <a
    href={MEDMENTOR_YOUTUBE_URL}
    target="_blank"
    rel="noopener noreferrer"
    title="আমাদের সাথে যুক্ত থাকতে YouTube চ্যানেল সাবস্ক্রাইব করুন"
    aria-label="MedMentor BD · যুক্ত থাকুন — YouTube চ্যানেল সাবস্ক্রাইব করুন"
    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/18 border border-white/15 hover:border-[#149A99]/60 text-[11px] font-semibold tracking-tight text-[#EBF4FA] hover:text-white whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#149A99]"
  >
    <YouTubePlayIcon className="w-3.5 h-3.5 shrink-0" />
    <span>MedMentor BD · যুক্ত থাকুন</span>
  </a>
);

export const MedMentorBrandCard: React.FC = () => (
  <section
    aria-label="আমাদের সাথে যুক্ত থাকুন — MedMentor BD"
    className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0D2B45] via-[#103656] to-[#0B4F5C] text-white border border-[#0E7C7B]/40 shadow-sm p-4 sm:p-5"
  >
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -right-12 -top-12 w-44 h-44 rounded-full bg-[#149A99]/15 blur-2xl"
    />
    <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
        <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 shadow-xs">
          <YouTubePlayIcon className="w-7 h-7" />
        </div>
        <div className="min-w-0">
          <h2 className="font-display font-bold text-base sm:text-lg text-white tracking-tight leading-snug">
            আমাদের সাথে যুক্ত থাকুন — MedMentor BD
          </h2>
          <p className="text-xs sm:text-[13px] text-[#EBF4FA]/85 mt-1 leading-relaxed">
            সহজ ও বিজ্ঞানসম্মত বাংলায় মেডিকেল ও ফার্মাকোলজি শিক্ষা পেতে আমাদের অফিশিয়াল YouTube
            চ্যানেল সাবস্ক্রাইব করে সাথেই থাকুন{' '}
            <span className="text-[#7CE0DF] font-medium">· Where Medicine Meets Clarity</span>
          </p>
        </div>
      </div>

      <a
        href={MEDMENTOR_YOUTUBE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="min-h-[44px] px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#CC0000] to-[#B00020] hover:from-[#E00000] hover:to-[#C60024] border border-white/20 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 shadow-sm transition-all active:scale-[0.98]"
      >
        <span aria-hidden="true" className="text-[11px] leading-none">
          ▶
        </span>
        <span>YouTube-এ যুক্ত হোন (Subscribe)</span>
        <ArrowUpRight className="w-4 h-4 shrink-0 opacity-90" />
      </a>
    </div>
  </section>
);

export const MedMentorFooter: React.FC = () => (
  <footer className="w-full border-t border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 bg-white dark:bg-[#0D2235] pb-20 md:pb-0">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
      <p className="text-[#0D2B45]/75 dark:text-[#EBF4FA]/75 text-center sm:text-left leading-relaxed">
        <span className="font-semibold text-[#0D2B45] dark:text-white">Field Pro – DI</span>{' '}
        <span aria-hidden="true">·</span> আমাদের সাথে যুক্ত থাকতে ভিজিট করুন আমাদের অফিশিয়াল YouTube
        চ্যানেল —{' '}
        <span className="font-semibold text-[#0D2B45] dark:text-white">MedMentor BD</span>{' '}
        <span className="text-[#0E7C7B] dark:text-[#149A99] font-medium">
          (Where Medicine Meets Clarity)
        </span>
      </p>

      <a
        href={MEDMENTOR_YOUTUBE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D2B45] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] text-white font-semibold whitespace-nowrap shrink-0 transition-colors"
      >
        <span aria-hidden="true" className="text-[10px] text-[#FF4D4D] leading-none">
          ▶
        </span>
        <span>চ্যানেল ভিজিট করুন ↗</span>
      </a>
    </div>
  </footer>
);
