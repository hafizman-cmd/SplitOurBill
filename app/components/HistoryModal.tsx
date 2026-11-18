'use client';

import Modal from './Modal';

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
  loadingDisabled?: boolean;
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
  loadingDisabled = false,
}: Props) {
  if (!open) return null;

  const sorted = [...entries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const entryCurrency = (code?: CurrencyCode): CurrencyCode => code ?? 'MYR';

  return (
    <Modal onClose={onClose}
      className="sheet-overlay"
      onClick={onClose}
      aria-label="Receipt history"
    >
      <div
        className="glass-card sheet-panel flex w-full max-w-md flex-col p-6 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div aria-hidden="true" className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/30 sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Receipt History</h3>
          <button
            onClick={onClose}
            aria-label="Close history"
            className="flex h-11 w-11 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-slate-300">Saved on this browser only. Keeps your latest 20 bills. Loading a bill replaces the one on screen after confirmation.</p>
        {loadingDisabled && <p role="status" className="mb-3 text-sm text-amber-200">Wait for the receipt scan to finish before loading a bill.</p>}
        {sorted.length > 0 ? (
          <ul className="-mr-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-2">
            {sorted.map((entry) => {
              const code = entryCurrency(entry.receiptData.currency);
              const rate = entry.receiptData.myrRate ?? 1;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    disabled={loadingDisabled}
                    onClick={() => onSelectEntry(entry)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-blue-500/30 hover:bg-blue-600/10 active:scale-[0.98] disabled:opacity-50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-blue-400">
                        <Receipt size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="break-words text-base font-semibold text-slate-100">
                          {entry.restaurantName}
                        </p>
                        <p className="text-sm text-slate-300">
                          {formatDate(entry.date)} - {entry.itemsCount} item(s)
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end leading-tight">
                      <p className="text-sm font-bold text-blue-400">
                        {formatMoney(entry.grandTotal, code)}
                      </p>
                      {formatMyrEquivalent(entry.grandTotal, code, rate) && (
                        <span className="text-sm font-medium text-slate-300">
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
          <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            No saved bills yet. Use Save to History for a manual bill. Reviewed scans are added automatically. Your current draft also saves automatically as you edit.
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
    </Modal>
  );
}
