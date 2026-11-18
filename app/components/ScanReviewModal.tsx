'use client';

import { useState } from 'react';
import Modal from './Modal';
import Image from 'next/image';
import { Plus, Trash2, X } from 'lucide-react';
import type { Item, ReceiptCharges } from '../types';
import { computeSplit, isBillAmount, MAX_BILL_AMOUNT, MAX_CHARGE_PERCENT } from '../lib/split';
import { formatMoney, type CurrencyCode } from '../lib/currency';
import { uid } from '../lib/utils';

export type ReviewedScan = {
  items: Item[];
  receiptCharges?: ReceiptCharges;
  printedTotal?: number;
  reviewNotes?: string[];
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
  const [discount, setDiscount] = useState(String(scan.receiptCharges?.discount ?? ''));
  const [serviceAmount, setServiceAmount] = useState(String(scan.receiptCharges?.serviceAmount ?? ''));
  const [taxAmount, setTaxAmount] = useState(String(scan.receiptCharges?.taxAmount ?? ''));
  const [printedTotal, setPrintedTotal] = useState(String(scan.printedTotal ?? ''));
  const optionalAmounts = [
    ['Discount', discount, setDiscount],
    ['Service charge amount', serviceAmount, setServiceAmount],
    ['Tax amount', taxAmount, setTaxAmount],
    ['Printed grand total', printedTotal, setPrintedTotal],
  ] as const;
  const hasRequiredInputs = items.length > 0 && items.every((item) => item.name.trim() && item.price.trim()) &&
    serviceCharge.trim() && tax.trim() && rounding.trim();
  const reviewedItems = items.map((item) => ({ ...item, name: item.name.trim(), price: Math.round(Number(item.price) * 100) / 100 }));
  const receiptCharges: ReceiptCharges = {
    discount: discount === '' ? undefined : Number(discount),
    serviceAmount: serviceAmount === '' ? undefined : Number(serviceAmount),
    taxAmount: taxAmount === '' ? undefined : Number(taxAmount),
  };
  const calculation = hasRequiredInputs
    ? computeSplit(reviewedItems, [], Number(serviceCharge), Number(tax), Number(rounding), receiptCharges, currency)
    : null;
  const totals = calculation?.issue === 'invalidAmounts' ? null : calculation;
  const valid = Boolean(totals) && (printedTotal === '' || isBillAmount(Number(printedTotal)));
  const difference = totals && printedTotal !== '' ? Math.round((totals.grandTotal - Number(printedTotal)) * 100) / 100 : null;

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
          if (valid) onConfirm({ items: reviewedItems, restaurantName: restaurantName.trim(), serviceCharge: Number(serviceCharge), tax: Number(tax), roundingAdjustment: Number(rounding), receiptCharges });
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
                      <input required type="number" min="0" max={MAX_BILL_AMOUNT} step="0.01" inputMode="decimal" value={item.price} onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, price: event.target.value } : entry))} className="glass-input mt-1 w-full" />
                    </label>
                    <button type="button" aria-label={`Remove scanned item ${index + 1}`} onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-rose-300 hover:bg-rose-400/10"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setItems((current) => [...current, { id: uid(), name: '', price: '', assigned: [] }])} className="flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-300"><Plus size={18} />Add missing item</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-slate-300">Service charge (%)
                <input required type="number" min="0" max={MAX_CHARGE_PERCENT} step="any" inputMode="decimal" value={serviceCharge} onChange={(event) => setServiceCharge(event.target.value)} className="glass-input mt-1 w-full" />
              </label>
              <label className="text-sm text-slate-300">Tax (%)
                <input required type="number" min="0" max={MAX_CHARGE_PERCENT} step="any" inputMode="decimal" value={tax} onChange={(event) => setTax(event.target.value)} className="glass-input mt-1 w-full" />
              </label>
            </div>
            <label className="block text-sm text-slate-300">Rounding adjustment ({currency})
              <input required type="number" min={-MAX_BILL_AMOUNT} max={MAX_BILL_AMOUNT} step="0.01" inputMode="decimal" value={rounding} onChange={(event) => setRounding(event.target.value)} className="glass-input mt-1 w-full" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              {optionalAmounts.map(([label, value, setValue]) => (
                <label key={label} className="text-sm text-slate-300">{label} ({currency})
                  <input type="number" min="0" max={MAX_BILL_AMOUNT} step="0.01" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} className="glass-input mt-1 w-full" />
                </label>
              ))}
              <p className="col-span-2 text-sm text-slate-300">Enter discounts as positive amounts. Leave service charge or tax amounts blank to calculate them from the rates above.</p>
            </div>
            {existingItems.length > 0 && <p className="text-sm text-amber-200">These items will be added to your {existingItems.length} existing items. The preview below is for this receipt only. Its charges and discount will apply to the combined bill.</p>}
            {totals && <dl className="space-y-2 rounded-2xl bg-blue-500/10 p-4 text-sm">
              {([['Subtotal', totals.subtotal], ['Discount', -totals.discount], ['Service charge', totals.serviceAmt], ['Tax', totals.taxAmt], ['Rounding', totals.roundingAdjustment], ['Calculated receipt total', totals.grandTotal]] as const).map(([label, amount]) => <div key={label} className="flex justify-between gap-3"><dt>{label}</dt><dd className="font-semibold tabular-nums">{formatMoney(amount, currency)}</dd></div>)}
            </dl>}
            {difference !== null && (
              <p role="status" className={difference === 0 ? 'text-sm text-emerald-200' : 'text-sm text-amber-200'}>
                {difference === 0
                  ? 'Calculated total matches the printed total.'
                  : `Calculated total is ${formatMoney(Math.abs(difference), currency)} ${difference > 0 ? 'above' : 'below'} the printed total. Check the items and charges before confirming.`}
              </p>
            )}
            {Boolean(scan.reviewNotes?.length) && (
              <div className="rounded-xl border border-amber-300/25 p-3 text-sm text-amber-200">
                <h3 className="font-semibold">Receipt lines to check</h3>
                <p className="mt-1">These lines may affect the total. Check the photo before confirming.</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {scan.reviewNotes?.map((note, index) => <li key={index}>{note}</li>)}
                </ul>
              </div>
            )}
            {!valid && <p role="status" className="text-sm text-amber-200">Enter all item names and prices. Amounts and totals can be at most 1 billion and percentages must be between 0 and 100.</p>}
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
