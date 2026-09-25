'use client';

import { QrCode } from 'lucide-react';
import type { SplitResult } from '../types';
import { formatRM } from '../lib/utils';

type Props = {
  people: string[];
  calc: SplitResult;
  paymentQrCode: string;
  onShowQr: () => void;
};

export default function SummarySection({
  people,
  calc,
  paymentQrCode,
  onShowQr,
}: Props) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
        Summary
      </h2>

      <div className="space-y-1.5 rounded-2xl bg-slate-50 p-4 text-sm ring-1 ring-slate-200/70">
        <div className="flex justify-between text-slate-500">
          <span>Subtotal</span>
          <span>{formatRM(calc.subtotal)}</span>
        </div>
        <div className="flex justify-between text-slate-500">
          <span>Service Charge ({calc.serviceCharge}%)</span>
          <span>{formatRM(calc.serviceAmt)}</span>
        </div>
        <div className="flex justify-between text-slate-500">
          <span>Tax ({calc.tax}%)</span>
          <span>{formatRM(calc.taxAmt)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-800">
          <span>Grand Total</span>
          <span>{formatRM(calc.grandTotal)}</span>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {people.length > 0 ? (
          people.map((p) => {
            const entry = calc.perPerson[p];
            const initial = p.charAt(0).toUpperCase();
            return (
              <div
                key={p}
                className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {p}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {entry.items.length > 0
                        ? `${entry.items.length} item(s) - ${formatRM(entry.raw)} before extras`
                        : 'No items assigned'}
                    </p>
                  </div>
                </div>
                <p className="shrink-0 text-lg font-bold text-indigo-600">
                  {formatRM(entry.final)}
                </p>
              </div>
            );
          })
        ) : (
          <p className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-400">
            Add people to see each person&apos;s final payable amount (their
            item shares are proportionally scaled up by service charge and
            tax).
          </p>
        )}
      </div>

      {paymentQrCode && (
        <button
          onClick={onShowQr}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 py-3 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100 active:scale-[0.98]"
        >
          <QrCode size={16} />
          Show Payment QR Code
        </button>
      )}
    </section>
  );
}
