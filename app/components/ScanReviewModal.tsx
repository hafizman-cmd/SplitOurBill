'use client';

import { useState } from 'react';
import Modal from './Modal';
import Image from 'next/image';
import { Plus, Trash2, X } from 'lucide-react';
import type { Item } from '../types';
import { computeSplit } from '../lib/split';
import { formatMoney, type CurrencyCode } from '../lib/currency';
import { uid } from '../lib/utils';

export type ReviewedScan = {
  items: Item[];
  restaurantName: string;
  serviceCharge: number;
  tax: number;
  roundingAdjustment: number;
};

type Props = {
  scan: ReviewedScan;
  image: string;
  currency: CurrencyCode;
  existingItems: Item[];
  onConfirm: (scan: ReviewedScan) => void;
  onClose: () => void;
};

export default function ScanReviewModal({ scan, image, currency, existingItems, onConfirm, onClose }: Props) {
  const [items, setItems] = useState(scan.items.map((item) => ({ ...item, price: item.price.toFixed(2) })));
  const [restaurantName, setRestaurantName] = useState(scan.restaurantName);
  const [serviceCharge, setServiceCharge] = useState(String(scan.serviceCharge));
  const [tax, setTax] = useState(String(scan.tax));
  const [rounding, setRounding] = useState(String(scan.roundingAdjustment));
  const validNumber = (value: string, allowNegative = false) => value.trim() !== '' && Number.isFinite(Number(value)) && (allowNegative || Number(value) >= 0);
  const valid = items.length > 0 && items.every((item) => item.name.trim() && validNumber(item.price)) && validNumber(serviceCharge) && validNumber(tax) && validNumber(rounding, true);
  const reviewedItems = items.map((item) => ({ ...item, name: item.name.trim(), price: Math.round(Number(item.price) * 100) / 100 }));
  const totals = valid ? computeSplit([...existingItems, ...reviewedItems], [], Number(serviceCharge), Number(tax), Number(rounding)) : null;

  return (
    <Modal onClose={onClose} aria-labelledby="scan-review-title" aria-describedby="scan-review-description" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-md sm:p-6" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/15 bg-slate-950 text-slate-100 shadow-2xl outline-none">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
          <div>
            <h2 id="scan-review-title" className="text-xl font-semibold">Review your receipt</h2>
            <p id="scan-review-description" className="mt-1 text-sm text-slate-300">Check items and charges against your receipt before adding them.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Discard scanned receipt" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-white/10"><X size={20} /></button>
        </div>
        <form className="flex min-h-0 flex-col" onSubmit={(event) => {
          event.preventDefault();
          if (valid) onConfirm({ items: reviewedItems, restaurantName: restaurantName.trim(), serviceCharge: Number(serviceCharge), tax: Number(tax), roundingAdjustment: Number(rounding) });
        }}>
          <div className="space-y-5 overflow-y-auto p-5">
            <details className="rounded-xl border border-white/15 p-3">
              <summary className="cursor-pointer py-1 text-sm font-semibold text-blue-300">View receipt photo</summary>
              <Image unoptimized width={1600} height={1600} src={image} alt="Receipt being reviewed" className="mt-3 h-auto w-full rounded-lg" />
            </details>
            <label className="block text-sm text-slate-300">Restaurant name
              <input value={restaurantName} onChange={(event) => setRestaurantName(event.target.value)} className="glass-input mt-1 w-full" />
            </label>
            <div className="space-y-3">
              <h3 className="font-semibold">Items ({items.length})</h3>
              {items.map((item, index) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <label className="block text-sm text-slate-300">Item {index + 1}
                    <input required value={item.name} onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, name: event.target.value } : entry))} className="glass-input mt-1 w-full" />
                  </label>
                  <div className="mt-2 flex items-end gap-2">
                    <label className="block min-w-0 flex-1 text-sm text-slate-300">Price ({currency})
                      <input required type="number" min="0" step="0.01" inputMode="decimal" value={item.price} onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, price: event.target.value } : entry))} className="glass-input mt-1 w-full" />
                    </label>
                    <button type="button" aria-label={`Remove scanned item ${index + 1}`} onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-rose-300 hover:bg-rose-400/10"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setItems((current) => [...current, { id: uid(), name: '', price: '', assigned: [] }])} className="flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-300"><Plus size={18} />Add missing item</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-slate-300">Service charge (%)
                <input required type="number" min="0" step="any" inputMode="decimal" value={serviceCharge} onChange={(event) => setServiceCharge(event.target.value)} className="glass-input mt-1 w-full" />
              </label>
              <label className="text-sm text-slate-300">Tax (%)
                <input required type="number" min="0" step="any" inputMode="decimal" value={tax} onChange={(event) => setTax(event.target.value)} className="glass-input mt-1 w-full" />
              </label>
            </div>
            <label className="block text-sm text-slate-300">Rounding adjustment ({currency})
              <input required type="number" step="0.01" inputMode="decimal" value={rounding} onChange={(event) => setRounding(event.target.value)} className="glass-input mt-1 w-full" />
            </label>
            {existingItems.length > 0 && <p className="text-sm text-amber-200">These items will be added to your {existingItems.length} existing items. The charges above will apply to the combined bill.</p>}
            {totals && <dl className="space-y-2 rounded-2xl bg-blue-500/10 p-4 text-sm">
              {([['Subtotal', totals.subtotal], ['Service charge', totals.serviceAmt], ['Tax', totals.taxAmt], ['Rounding', totals.roundingAdjustment], ['Bill total', totals.grandTotal]] as const).map(([label, amount]) => <div key={label} className="flex justify-between gap-3"><dt>{label}</dt><dd className="font-semibold tabular-nums">{formatMoney(amount, currency)}</dd></div>)}
            </dl>}
            {!valid && <p role="status" className="text-sm text-amber-200">Add at least one item and fill in all item names and valid amounts. Prices and percentages must be zero or more.</p>}
          </div>
          <div className="flex gap-3 border-t border-white/10 p-4">
            <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-white/15 px-4 text-sm">Discard</button>
            <button type="submit" disabled={!valid} className="min-h-11 flex-1 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">Confirm {items.length} item{items.length === 1 ? '' : 's'}</button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
