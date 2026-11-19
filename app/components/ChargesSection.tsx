'use client';

import type { ReceiptCharges } from '../types';
import { ArrowRightLeft, CreditCard, Info, RefreshCw } from 'lucide-react';
import {
  CURRENCIES,
  CURRENCY_OPTIONS,
  formatMoney,
  parseMyrRate,
  type CurrencyCode,
  type ExchangeRateSource,
} from '../lib/currency';

type Props = {
  receiptCharges?: ReceiptCharges;
  receiptChargesNeedReview: boolean;
  onReviewReceiptCharges: () => void;
  serviceChargeInput: string;
  taxInput: string;
  roundingAdjustmentInput: string;
  onServiceChargeChange: (value: string) => void;
  onTaxChange: (value: string) => void;
  onRoundingAdjustmentChange: (value: string) => void;
  currency: CurrencyCode;
  onCurrencyChange: (value: CurrencyCode) => void;
  rateInput: string;
  rateSource?: ExchangeRateSource;
  onRateChange: (value: string) => void;
  onFetchRate: () => void;
  fetchingRate: boolean;
};

export default function ChargesSection({
  receiptCharges,
  receiptChargesNeedReview,
  onReviewReceiptCharges,
  serviceChargeInput,
  taxInput,
  roundingAdjustmentInput,
  onServiceChargeChange,
  onTaxChange,
  onRoundingAdjustmentChange,
  currency,
  onCurrencyChange,
  rateInput,
  rateSource,
  onRateChange,
  onFetchRate,
  fetchingRate,
}: Props) {
  const isForeign = currency !== 'MYR';
  const rateDescription = parseMyrRate(rateInput) === 0
    ? 'Enter or refresh a rate to see approximate RM amounts.'
    : rateSource?.kind === 'frankfurter'
      ? `Frankfurter reference rate · ${new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(rateSource.date))}`
      : rateSource?.kind === 'estimate'
        ? 'Built-in estimate. Refresh for the latest available reference rate.'
        : rateSource?.kind === 'manual'
          ? 'Manually entered rate.'
          : 'Saved rate with unknown source. Refresh for a dated reference rate.';

  return (
    <section className="bill-panel p-5">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold tracking-tight text-white">
        <CreditCard className="h-4 w-4 text-blue-400" />
        Charges
      </h2>

      <div className="mb-3">
        <label htmlFor="receipt-currency" className="mb-1.5 block text-sm font-semibold text-slate-300">
          Receipt Currency
        </label>
        <select
          id="receipt-currency"
          value={currency}
          onChange={(event) => onCurrencyChange(event.target.value as CurrencyCode)}
          className="glass-input w-full text-base font-semibold"
        >
          {CURRENCY_OPTIONS.map((code) => (
            <option key={code} value={code}>{code} ({CURRENCIES[code].symbol}) - {CURRENCIES[code].name}</option>
          ))}
        </select>
        <p className="mt-1.5 flex items-start gap-1.5 text-sm text-slate-300">
          <Info className="mt-0.5 w-3.5 h-3.5 shrink-0" />
          <span>Select the currency printed on your physical receipt.</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="service-charge" className="mb-1.5 block text-sm font-semibold text-slate-300">
            Service Charge %
          </label>
          <input id="service-charge"
            value={serviceChargeInput}
            onChange={(e) => onServiceChargeChange(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            className="glass-input w-full rounded-xl px-4 py-2.5 text-base font-semibold outline-none transition"
          />
        </div>
        <div>
          <label htmlFor="tax" className="mb-1.5 block text-sm font-semibold text-slate-300">
            Tax %
          </label>
          <input id="tax"
            value={taxInput}
            onChange={(e) => onTaxChange(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            className="glass-input w-full rounded-xl px-4 py-2.5 text-base font-semibold outline-none transition"
          />
        </div>
      </div>

      <div className="mt-3">
        {receiptChargesNeedReview && (
          <p role="status" className="rounded-xl border border-amber-300/25 bg-amber-400/10 p-3 text-sm text-amber-100">
            {receiptCharges?.reviewedSubtotal === undefined
              ? 'Check the fixed amounts against your current items before sharing.'
              : `The item subtotal changed since these amounts were reviewed at ${formatMoney(receiptCharges.reviewedSubtotal, currency)}. Check the fixed amounts before sharing.`}
          </p>
        )}
        {(receiptCharges?.discount !== undefined || receiptCharges?.serviceAmount !== undefined || receiptCharges?.taxAmount !== undefined) && (
          <p className="mt-2 text-sm text-slate-300">
            Fixed amounts: {[
              receiptCharges.discount === undefined ? null : `discount ${formatMoney(receiptCharges.discount, currency)}`,
              receiptCharges.serviceAmount === undefined ? null : `service charge ${formatMoney(receiptCharges.serviceAmount, currency)}`,
              receiptCharges.taxAmount === undefined ? null : `tax ${formatMoney(receiptCharges.taxAmount, currency)}`,
            ].filter(Boolean).join(', ')}.
          </p>
        )}
        <button type="button" onClick={onReviewReceiptCharges} className="min-h-11 text-sm font-semibold text-blue-300 hover:underline">
          {receiptChargesNeedReview ? 'Review fixed amounts' : 'Edit fixed amounts'}
        </button>
      </div>
      <div className="mt-3">
        <label htmlFor="rounding-adjustment" className="mb-1.5 block text-sm font-semibold text-slate-300">
          Rounding Adjustment
        </label>
        <input id="rounding-adjustment"
          value={roundingAdjustmentInput}
          onChange={(e) => onRoundingAdjustmentChange(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          aria-label="Rounding adjustment"
          className="glass-input w-full rounded-xl px-4 py-2.5 text-base font-semibold outline-none transition"
        />
        <p className="mt-1.5 text-sm text-slate-300">
          Enter a signed receipt adjustment, such as +0.01 or -0.02.
        </p>
      </div>

      {isForeign && (
        <div className="mt-3">
          <label htmlFor="exchange-rate" className="mb-1.5 block text-sm font-semibold text-slate-300">
            Exchange Rate (RM per 1 {currency})
          </label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <ArrowRightLeft className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-400" />
              <input id="exchange-rate"
                value={rateInput}
                onChange={(e) => onRateChange(e.target.value)}
                inputMode="decimal"
                aria-describedby="exchange-rate-source"
                className="glass-input w-full rounded-xl py-2.5 pl-10 pr-4 text-base font-semibold outline-none transition"
              />
            </div>
            <button
              type="button"
              onClick={onFetchRate}
              disabled={fetchingRate}
              className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-600/10 px-3.5 text-sm font-semibold text-blue-300 transition hover:bg-blue-600/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={16} className={fetchingRate ? 'animate-spin' : ''} />
              {fetchingRate ? 'Refreshing…' : 'Refresh rate'}
            </button>
          </div>
          <p id="exchange-rate-source" role="status" className="mt-1.5 text-sm text-slate-300">{rateDescription}</p>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-300">
            <Info className="mt-0.5 w-3.5 h-3.5 shrink-0" />
            <span>
              RM amounts are approximate. Your bank or card rate may differ.
            </span>
          </p>
        </div>
      )}
    </section>
  );
}
