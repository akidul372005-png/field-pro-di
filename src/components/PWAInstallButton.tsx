import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        title="Install Field Pro – DI on your device"
        className="min-h-[44px] px-3 sm:px-3.5 rounded-xl bg-[#0B2239] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer active:scale-[0.98]"
      >
        <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline">Install App</span>
        <span className="sm:hidden">Install</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          title="Install Field Pro – DI on iPhone or iPad"
          className="min-h-[44px] px-3 sm:px-3.5 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 hover:border-[#0E7C7B] text-[#0D2B45] dark:text-[#EBF4FA] text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99] shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">Install App</span>
          <span className="sm:hidden">Install</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#071522]/70 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 p-5 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3
                    id="ios-install-title"
                    className="text-base font-display font-bold text-[#0D2B45] dark:text-white"
                  >
                    Install Field Pro – DI on iOS
                  </h3>
                  <p className="text-xs text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 mt-0.5">
                    Add to your home screen for full-screen offline access
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close install guide"
                  className="p-1.5 rounded-lg text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 hover:bg-[#EBF4FA] dark:hover:bg-[#133859] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <ol className="space-y-2.5 text-sm text-[#0D2B45]/85 dark:text-[#EBF4FA]/85">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#0E7C7B]/15 text-[#0E7C7B] dark:text-[#7CE0DF] text-xs font-bold inline-flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Tap the{' '}
                    <strong className="inline-flex items-center gap-1 text-[#0D2B45] dark:text-white">
                      <Share className="w-3.5 h-3.5" aria-hidden="true" />
                      Share
                    </strong>{' '}
                    button in Safari’s toolbar.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#0E7C7B]/15 text-[#0E7C7B] dark:text-[#7CE0DF] text-xs font-bold inline-flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Scroll down and tap{' '}
                    <strong className="text-[#0D2B45] dark:text-white">Add to Home Screen</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#0E7C7B]/15 text-[#0E7C7B] dark:text-[#7CE0DF] text-xs font-bold inline-flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Tap <strong className="text-[#0D2B45] dark:text-white">Add</strong> to launch
                    Field Pro like a native app.
                  </span>
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full min-h-[42px] rounded-xl bg-[#0B2239] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
