import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SHEET_PRIMARY_KEY } from '../services/api';

export const DeleteConfirmModal: React.FC = () => {
  const { deleteTarget, isDeleting, closeDeleteConfirm, confirmDeleteRecord } = useApp();

  useEffect(() => {
    if (!deleteTarget) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        closeDeleteConfirm();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteTarget, isDeleting, closeDeleteConfirm]);

  if (!deleteTarget) return null;

  const pkCol = SHEET_PRIMARY_KEY[deleteTarget.sheet];
  const recordId = String(deleteTarget.record[pkCol] ?? '').trim();

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 backdrop-blur-xs p-4"
      onClick={closeDeleteConfirm}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        aria-describedby="delete-confirm-desc"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 shadow-2xl overflow-hidden"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <button
              type="button"
              onClick={closeDeleteConfirm}
              disabled={isDeleting}
              aria-label="Cancel delete"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#0D2B45]/50 hover:text-[#0D2B45] dark:text-[#EBF4FA]/50 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <h2
            id="delete-confirm-title"
            className="mt-4 text-lg font-display font-bold text-[#0D2B45] dark:text-white"
          >
            Are you sure you want to delete this record?
          </h2>

          <p
            id="delete-confirm-desc"
            className="mt-1.5 text-sm text-[#0D2B45]/70 dark:text-[#EBF4FA]/70 leading-relaxed"
          >
            This will remove{' '}
            <span className="font-semibold text-[#0D2B45] dark:text-white">
              {deleteTarget.displayLabel || recordId}
            </span>{' '}
            from <span className="font-mono text-xs">{deleteTarget.sheet}</span> ({pkCol}:{' '}
            <span className="font-mono text-xs">{recordId}</span>) and sync the deletion to Google
            Sheets.
          </p>

          <div className="mt-6 flex flex-row items-center justify-end gap-3">
            <button
              type="button"
              onClick={closeDeleteConfirm}
              disabled={isDeleting}
              className="min-h-[44px] px-4 py-2 rounded-lg border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-sm font-medium text-[#0D2B45] dark:text-[#EBF4FA] hover:bg-[#F4F8FC] dark:hover:bg-[#133859]/40 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirmDeleteRecord()}
              disabled={isDeleting}
              style={{
                backgroundColor: '#dc2626',
                color: '#ffffff',
                padding: '10px 20px',
                borderRadius: '8px',
                fontWeight: '600',
                border: 'none',
                cursor: 'pointer',
              }}
              className="min-h-[44px] text-sm inline-flex items-center justify-center gap-2 shrink-0"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
