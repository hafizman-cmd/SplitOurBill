'use client';

import { useEffect } from 'react';
import { Receipt, Trash2, X } from 'lucide-react';
import type { HistoryEntry } from '../types';
import {
  formatMoney,
  formatMyrEquivalent,
  type CurrencyCode,
} from '../lib/currency';

type Props = {
  open: boolean;
  entries: HistoryEntry[];
  onClose: () => void;
  onSelectEntry: (entry: HistoryEntry) => void;
  onClear: () => void;
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export default function HistoryModal({
  open,
  entries,
  onClose,
  onSelectEntry,
  onClear,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const sorted = [...entries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const entryCurrency = (code?: CurrencyCode): CurrencyCode => code ?? 'MYR';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Receipt history"
    >
      <div
        className="glass-card flex max-h-[80vh] w-full max-w-md flex-col p-6 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Receipt History</h3>
          <button
            onClick={onClose}
            aria-label="Close history"
            className="rounded-full p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {sorted.length > 0 ? (
          <ul className="-mr-2 flex-1 space-y-2 overflow-y-auto pr-2">
            {sorted.map((entry) => {
              const code = entryCurrency(entry.receiptData.currency);
              const rate = entry.receiptData.myrRate ?? 1;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => onSelectEntry(entry)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-blue-500/30 hover:bg-blue-600/10 active:scale-[0.98]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-blue-400">
                        <Receipt size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100">
                          {entry.restaurantName}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {formatDate(entry.date)} - {entry.itemsCount} item(s)
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end leading-tight">
                      <p className="text-sm font-bold text-blue-400">
                        {formatMoney(entry.grandTotal, code)}
                      </p>
                      {formatMyrEquivalent(entry.grandTotal, code, rate) && (
                        <span className="text-[10px] font-medium text-slate-400">
                          {formatMyrEquivalent(entry.grandTotal, code, rate)}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300">
            No saved receipts yet. Successfully scanned receipts will appear here
            automatically.
          </p>
        )}

        {sorted.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-300/25 bg-rose-400/10 py-2.5 text-sm font-semibold text-rose-200 transition hover:bg-rose-400/20 active:scale-[0.98]"
          >
            <Trash2 size={14} />
            Clear History
          </button>
        )}
      </div>
    </div>
  );
}
