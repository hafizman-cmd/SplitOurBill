'use client';

import { CheckCircle2, Circle, Layers, QrCode, RefreshCw } from 'lucide-react';
import type { SplitResult } from '../types';
import {
  formatMoney,
  formatMyrEquivalent,
  type CurrencyCode,
} from '../lib/currency';

type Props = {
  people: string[];
  calc: SplitResult;
  paidStatus: Record<string, boolean>;
  onTogglePaid: (person: string) => void;
  onResetPaid: () => void;
  paymentQrCode: string;
  onShowQr: () => void;
  currency: CurrencyCode;
  myrRate: number;
};

export default function SummarySection({
  people,
  calc,
  paidStatus,
  onTogglePaid,
  onResetPaid,
  paymentQrCode,
  onShowQr,
  currency,
  myrRate,
}: Props) {
  const money = (n: number) => formatMoney(n, currency);
  const eq = (n: number) => formatMyrEquivalent(n, currency, myrRate);
  const signedMoney = (n: number) =>
    `${n > 0 ? '+' : n < 0 ? '-' : ''}${money(Math.abs(n))}`;

  return (
    <section className="glass-card p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-slate-300">
        <Layers className="h-4 w-4 text-blue-400" />
        <span>Summary</span>
      </h2>

      {people.length > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2 text-xs text-slate-300 backdrop-blur-md">
          <span>
            Collected: {money(people.reduce((total, person) =>
              paidStatus[person] ? total + (calc.perPerson[person]?.final ?? 0) : total,
            0))} / {money(calc.grandTotal)}
          </span>
          <button
            type="button"
            onClick={onResetPaid}
            disabled={!people.some((person) => paidStatus[person])}
            aria-label="Reset payment statuses"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      )}

      <div className="space-y-1.5 rounded-2xl border border-white/10 bg-slate-950/30 p-4 text-sm">
        <div className="flex justify-between text-slate-300">
          <span>Subtotal</span>
          <span className="flex flex-col items-end leading-tight">
            <span>{money(calc.subtotal)}</span>
            {eq(calc.subtotal) && (
              <span className="text-[10px] font-normal text-slate-400">
                {eq(calc.subtotal)}
              </span>
            )}
          </span>
        </div>
        <div className="flex justify-between text-slate-300">
          <span>Service Charge ({calc.serviceCharge}%)</span>
          <span className="flex flex-col items-end leading-tight">
            <span>{money(calc.serviceAmt)}</span>
            {eq(calc.serviceAmt) && (
              <span className="text-[10px] font-normal text-slate-400">
                {eq(calc.serviceAmt)}
              </span>
            )}
          </span>
        </div>
        <div className="flex justify-between text-slate-300">
          <span>Tax ({calc.tax}%)</span>
          <span className="flex flex-col items-end leading-tight">
            <span>{money(calc.taxAmt)}</span>
            {eq(calc.taxAmt) && (
              <span className="text-[10px] font-normal text-slate-400">
                {eq(calc.taxAmt)}
              </span>
            )}
          </span>
        </div>
        {calc.roundingAdjustment !== 0 && (
          <div className="flex justify-between text-slate-300">
            <span>Rounding Adjustment</span>
            <span>{signedMoney(calc.roundingAdjustment)}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between border-t border-white/10 pt-2 font-bold text-white">
          <span>Grand Total</span>
          <span className="flex flex-col items-end leading-tight">
            <span>{money(calc.grandTotal)}</span>
            {eq(calc.grandTotal) && (
              <span className="text-[10px] font-normal text-slate-400">
                {eq(calc.grandTotal)}
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {people.length > 0 ? (
          people.map((p) => {
            const entry = calc.perPerson[p];
            const paid = paidStatus[p] ?? false;
            const initial = p.charAt(0).toUpperCase();
            return (
              <div
                key={p}
                className={`flex items-center justify-between rounded-2xl p-4 ring-1 transition ${
                  paid
                  ? 'bg-emerald-400/10 text-slate-400 ring-emerald-200/20 opacity-75'
                    : 'border border-white/10 bg-slate-950/30 ring-0'
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-sm font-bold text-blue-300">
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-semibold ${paid ? 'text-slate-400 line-through' : 'text-white'}`}>
                      {p}
                    </p>
                    <p className={`text-[11px] ${paid ? 'text-slate-400/80' : 'text-slate-400'}`}>
                      {entry.items.length > 0
                        ? `${entry.items.length} item(s) - ${formatMoney(
                            entry.raw,
                            currency,
                          )} before extras`
                        : 'No items assigned'}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 leading-tight">
                  <p className={`text-lg font-bold ${paid ? 'text-emerald-200/70 line-through' : 'text-blue-400'}`}>
                    {money(entry.final)}
                  </p>
                  {eq(entry.final) && (
                    <p className="text-[10px] font-medium text-slate-400">
                      {eq(entry.final)} for DuitNow
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => onTogglePaid(p)}
                    aria-label={paid ? `Mark ${p} as unpaid` : `Mark ${p} as paid`}
                    className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition active:scale-95 ${
                      paid
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 backdrop-blur-md hover:bg-emerald-500/20'
                        : 'border-white/15 bg-white/5 text-slate-200 shadow-sm hover:border-white/25 hover:bg-white/10 active:bg-white/15'
                    }`}
                  >
                    {paid ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    {paid ? 'Paid' : 'Mark Paid'}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="rounded-2xl border border-white/10 bg-slate-950/30 p-4 text-xs text-slate-400">
            Add people to see each person&apos;s final payable amount (their
            item shares are proportionally scaled up by service charge and
            tax).
          </p>
        )}
      </div>

      {paymentQrCode && (
        <button
          onClick={onShowQr}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-600/10 py-3 text-sm font-bold text-blue-300 transition hover:bg-blue-600/20 active:scale-[0.98]"
        >
          <QrCode size={16} />
          Show Payment QR Code
        </button>
      )}
    </section>
  );
}
