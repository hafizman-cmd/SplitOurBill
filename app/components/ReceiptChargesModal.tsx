'use client';

import { useState } from 'react';
import type { ReceiptCharges } from '../types';
import { formatMoney, type CurrencyCode } from '../lib/currency';
import { MAX_BILL_AMOUNT } from '../lib/split';
import Modal from './Modal';

type Props = {
  charges: ReceiptCharges;
  subtotal: number;
  currency: CurrencyCode;
  onSave: (charges: ReceiptCharges) => void;
  onClose: () => void;
};

const fields = [
  ['discount', 'Discount amount'],
  ['serviceAmount', 'Service charge amount'],
  ['taxAmount', 'Tax amount'],
] as const;

export default function ReceiptChargesModal({ charges, subtotal, currency, onSave, onClose }: Props) {
  const [amounts, setAmounts] = useState({
    discount: String(charges.discount ?? ''),
    serviceAmount: String(charges.serviceAmount ?? ''),
    taxAmount: String(charges.taxAmount ?? ''),
  });
  const readAmount = (key: keyof typeof amounts) => amounts[key] === '' ? undefined : Number(amounts[key]);

  return (
    <Modal onClose={onClose} aria-labelledby="receipt-charges-title" aria-describedby="receipt-charges-description" className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-md" onClick={onClose}>
      <form
        className="my-auto w-full max-w-md space-y-4 rounded-3xl border border-white/20 bg-slate-950 p-5 text-slate-100 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            discount: readAmount('discount'),
            serviceAmount: readAmount('serviceAmount'),
            taxAmount: readAmount('taxAmount'),
            reviewedSubtotal: subtotal,
          });
        }}
      >
        <h2 id="receipt-charges-title" className="text-xl font-semibold">Review fixed amounts</h2>
        <p id="receipt-charges-description" className="text-sm text-slate-300">
          Current item subtotal: {formatMoney(subtotal, currency)}. Leave a field blank to remove the discount or calculate service charge and tax from their percentages.
        </p>
        {fields.map(([key, label]) => (
          <label key={key} className="block text-sm font-semibold text-slate-300">
            {label} ({currency})
            <input
              type="number"
              min="0"
              max={key === 'discount' ? Math.min(subtotal, MAX_BILL_AMOUNT) : MAX_BILL_AMOUNT}
              step="0.01"
              inputMode="decimal"
              value={amounts[key]}
              onChange={(event) => setAmounts((current) => ({ ...current, [key]: event.target.value }))}
              className="glass-input mt-1 w-full"
            />
          </label>
        ))}
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-xl border border-white/20 px-4 font-semibold">Cancel</button>
          <button type="submit" className="min-h-11 flex-1 rounded-xl bg-blue-600 px-4 font-semibold text-white">Apply amounts</button>
        </div>
      </form>
    </Modal>
  );
}
