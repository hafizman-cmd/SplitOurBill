'use client';

import { useEffect } from 'react';
import { AlertCircle, Clock, PlusCircle, Sparkles } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  onEnterManually: () => void;
};

export default function DailyScanLimitModal({
  open,
  onClose,
  onEnterManually,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-scan-limit-title"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 px-5 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/15 bg-[#111217]/90 p-6 shadow-2xl shadow-black/70 backdrop-blur-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-300/25 bg-[#007AFF]/20 text-blue-200 shadow-lg shadow-blue-500/15">
            <Sparkles size={23} />
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300">
            <Clock size={14} className="text-blue-300" />
            Resets at midnight
          </div>
        </div>

        <h2 id="daily-scan-limit-title" className="mt-5 text-2xl font-bold tracking-tight text-white">
          Daily AI Scans Used
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          You&apos;ve used your 2 free AI receipt scans for today. Scans reset at midnight, or you can enter bill items manually for free.
        </p>

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-blue-300/15 bg-blue-500/10 px-3 py-2.5 text-xs font-medium leading-5 text-blue-100">
          <AlertCircle size={16} className="shrink-0 text-[#007AFF]" />
          Manual entries remain available at any time.
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onEnterManually}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#007AFF] px-3 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-500 active:scale-[0.98]"
          >
            <PlusCircle size={17} />
            Enter Manually
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 active:scale-[0.98]"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
