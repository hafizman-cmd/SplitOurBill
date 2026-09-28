'use client';

import { ChevronDown, DollarSign, Globe, RefreshCw } from 'lucide-react';
import {
  CURRENCIES,
  CURRENCY_OPTIONS,
  type CurrencyCode,
} from '../lib/currency';

type Props = {
  serviceChargeInput: string;
  taxInput: string;
  onServiceChargeChange: (value: string) => void;
  onTaxChange: (value: string) => void;
  currency: CurrencyCode;
  onCurrencyChange: (value: CurrencyCode) => void;
  rateInput: string;
  onRateChange: (value: string) => void;
  onFetchRate: () => void;
  fetchingRate: boolean;
};

export default function ChargesSection({
  serviceChargeInput,
  taxInput,
  onServiceChargeChange,
  onTaxChange,
  currency,
  onCurrencyChange,
  rateInput,
  onRateChange,
  onFetchRate,
  fetchingRate,
}: Props) {
  const isForeign = currency !== 'MYR';

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
        Charges
      </h2>

      <div className="relative mb-3">
        <Globe
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-600"
        />
        <select
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value as CurrencyCode)}
          aria-label="Bill currency"
          className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10 text-sm font-semibold text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
        >
          {CURRENCY_OPTIONS.map((code) => (
            <option key={code} value={code}>
              {code} ({CURRENCIES[code].symbol}) - {CURRENCIES[code].name}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">
            Service Charge %
          </label>
          <input
            value={serviceChargeInput}
            onChange={(e) => onServiceChargeChange(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">
            Tax %
          </label>
          <input
            value={taxInput}
            onChange={(e) => onTaxChange(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </div>

      {isForeign && (
        <div className="mt-3">
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">
            Exchange Rate - 1 {CURRENCIES[currency].symbol} equals (RM)
          </label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <DollarSign
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-600"
              />
              <input
                value={rateInput}
                onChange={(e) => onRateChange(e.target.value)}
                inputMode="decimal"
                placeholder={String(CURRENCIES[currency].defaultRate)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <button
              type="button"
              onClick={onFetchRate}
              disabled={fetchingRate}
              aria-label="Fetch latest exchange rate"
              className="flex shrink-0 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 text-indigo-600 transition hover:bg-indigo-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={16} className={fetchingRate ? 'animate-spin' : ''} />
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            Amounts show both {CURRENCIES[currency].symbol} and the RM
            equivalent, so you know how much Ringgit to transfer.
          </p>
        </div>
      )}
    </section>
  );
}
