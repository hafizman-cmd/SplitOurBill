'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRightLeft, Check, ChevronDown, CreditCard, Globe, Info, RefreshCw } from 'lucide-react';
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
  const [currencyMenuOpen, setCurrencyMenuOpen] = useState(false);
  const currencyMenuRef = useRef<HTMLDivElement>(null);
  const isForeign = currency !== 'MYR';
  const formatRate = (rate: number) =>
    rate >= 0.01 ? rate.toFixed(2) : String(rate);
  const parsedRate = Number(rateInput);
  const displayRate =
    Number.isFinite(parsedRate) && parsedRate > 0
      ? formatRate(parsedRate)
      : formatRate(CURRENCIES[currency].defaultRate);

  useEffect(() => {
    if (!currencyMenuOpen) return;
    const closeMenu = (event: PointerEvent) => {
      if (!currencyMenuRef.current?.contains(event.target as Node)) {
        setCurrencyMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCurrencyMenuOpen(false);
    };
    window.addEventListener('pointerdown', closeMenu);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeMenu);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [currencyMenuOpen]);

  return (
    <section className="glass-card p-5">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <CreditCard className="h-4 w-4 text-blue-400" />
        Charges
      </h2>

      <div className="mb-3">
        <label className="mb-1.5 block text-xs font-semibold text-slate-300">
          Receipt Currency
        </label>
        <div ref={currencyMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setCurrencyMenuOpen((open) => !open)}
            aria-haspopup="listbox"
            aria-expanded={currencyMenuOpen}
            aria-label="Receipt currency"
            className="glass-input flex w-full items-center gap-2 text-left text-sm font-semibold"
          >
            <Globe className="h-4 w-4 shrink-0 text-blue-400" />
            <span className="min-w-0 flex-1 truncate">
              {currency} ({CURRENCIES[currency].symbol}) - {CURRENCIES[currency].name}
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${currencyMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {currencyMenuOpen && (
            <div
              role="listbox"
              aria-label="Receipt currency options"
              className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-white/15 bg-slate-950/95 p-1 shadow-2xl shadow-black/40 backdrop-blur-xl"
            >
              {CURRENCY_OPTIONS.map((code) => {
                const selected = code === currency;
                return (
                  <button
                    key={code}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onCurrencyChange(code);
                      setCurrencyMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${selected ? 'bg-blue-600/20 text-blue-300' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
                  >
                    <span className="flex min-w-8 justify-center text-xs font-bold text-slate-400">{CURRENCIES[code].symbol}</span>
                    <span className="min-w-0 flex-1 truncate">{code} - {CURRENCIES[code].name}</span>
                    {selected && <Check className="h-4 w-4 shrink-0 text-blue-400" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-slate-400">
          <Info className="mt-0.5 w-3.5 h-3.5 shrink-0" />
          <span>Select the currency printed on your physical receipt.</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-300">
            Service Charge %
          </label>
          <input
            value={serviceChargeInput}
            onChange={(e) => onServiceChargeChange(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            className="glass-input w-full rounded-xl px-4 py-2.5 text-sm font-semibold outline-none transition"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-300">
            Tax %
          </label>
          <input
            value={taxInput}
            onChange={(e) => onTaxChange(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            className="glass-input w-full rounded-xl px-4 py-2.5 text-sm font-semibold outline-none transition"
          />
        </div>
      </div>

      {isForeign && (
        <div className="mt-3">
          <label className="mb-1.5 block text-xs font-semibold text-slate-300">
            Exchange Rate (1 {CURRENCIES[currency].symbol} = RM {displayRate})
          </label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <ArrowRightLeft className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-400" />
              <input
                value={rateInput}
                onChange={(e) => onRateChange(e.target.value)}
                inputMode="decimal"
                placeholder={String(CURRENCIES[currency].defaultRate)}
                className="glass-input w-full rounded-xl py-2.5 pl-10 pr-4 text-sm font-semibold outline-none transition"
              />
            </div>
            <button
              type="button"
              onClick={onFetchRate}
              disabled={fetchingRate}
              aria-label="Fetch latest exchange rate"
              className="flex shrink-0 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-600/10 px-3.5 text-blue-300 transition hover:bg-blue-600/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={16} className={fetchingRate ? 'animate-spin' : ''} />
            </button>
          </div>
          <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-slate-400">
            <Info className="mt-0.5 w-3.5 h-3.5 shrink-0" />
            <span>
              Items are entered in the local receipt currency. Converted RM
              amounts show how much to transfer via DuitNow.
            </span>
          </p>
        </div>
      )}
    </section>
  );
}
