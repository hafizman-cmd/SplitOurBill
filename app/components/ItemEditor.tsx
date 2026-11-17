'use client';

import { useState } from 'react';

type Props = {
  name: string;
  price: number;
  onSave: (name: string, price: number) => void;
  onCancel: () => void;
};

export default function ItemEditor({ name, price, onSave, onCancel }: Props) {
  const [draftName, setDraftName] = useState(name);
  const [draftPrice, setDraftPrice] = useState(price.toFixed(2));

  return (
    <form className="space-y-3" onSubmit={(event) => {
      event.preventDefault();
      const amount = Number(draftPrice);
      if (draftName.trim() && draftPrice.trim() && Number.isFinite(amount) && amount >= 0) {
        onSave(draftName.trim(), Math.round(amount * 100) / 100);
      }
    }} onKeyDown={(event) => { if (event.key === 'Escape') onCancel(); }}>
      <label className="block text-sm text-slate-300">Item name
        <input autoFocus required value={draftName} onChange={(event) => setDraftName(event.target.value)} className="glass-input mt-1 w-full" />
      </label>
      <label className="block text-sm text-slate-300">Price
        <input required type="number" min="0" step="0.01" inputMode="decimal" value={draftPrice} onChange={(event) => setDraftPrice(event.target.value)} className="glass-input mt-1 w-full" />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={!draftName.trim() || !draftPrice.trim()} className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">Save changes</button>
        <button type="button" onClick={onCancel} className="min-h-11 rounded-xl border border-white/15 px-4 text-sm text-slate-200">Cancel</button>
      </div>
    </form>
  );
}
