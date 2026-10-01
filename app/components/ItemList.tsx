'use client';

import { useState, type RefObject } from 'react';
import { Check, ListChecks, Plus, Trash2, UserCircle } from 'lucide-react';
import type { Item } from '../types';
import { formatMoney, formatMyrEquivalent, type CurrencyCode } from '../lib/currency';

type Props = {
  items: Item[];
  people: string[];
  onAddManualItem: (name: string, price: number) => void;
  onRemoveItem: (id: string) => void;
  onToggleAssignment: (itemId: string, person: string) => void;
  currency: CurrencyCode;
  myrRate: number;
  manualNameInputRef?: RefObject<HTMLInputElement | null>;
};

export default function ItemList({
  items,
  people,
  onAddManualItem,
  onRemoveItem,
  onToggleAssignment,
  currency,
  myrRate,
  manualNameInputRef,
}: Props) {
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const unassignedCount = items.filter((item) => item.assigned.length === 0).length;

  const addManualItem = () => {
    const name = manualName.trim();
    const price = Number(manualPrice);
    if (!name || !Number.isFinite(price) || price < 0) return;
    onAddManualItem(name, price);
    setManualName('');
    setManualPrice('');
  };

  return (
    <section className="glass-card overflow-hidden p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <ListChecks className="h-4 w-4 text-blue-400" />
          Items
        </h2>
        {unassignedCount > 0 && (
          <span className="shrink-0 rounded-full border border-blue-500/30 bg-blue-600/10 px-2.5 py-1 text-[10px] font-bold tracking-wide text-blue-300">
            {unassignedCount} TO ASSIGN
          </span>
        )}
      </div>

      {items.length > 0 ? (
        <ul className="space-y-5">
          {items.map((item) => {
            const splitCount = item.assigned.length;
            const each = splitCount > 0 ? formatMoney(item.price / splitCount, currency) : null;
            return (
              <li key={item.id} className="rounded-2xl border-x border-white/10 border-t border-white/20 border-b border-white/5 bg-slate-950/30 px-4 py-5 shadow-xl shadow-black/20 sm:px-5">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4">
                  <div className="min-w-0">
                    <p className="break-words text-lg font-bold leading-snug tracking-tight text-white sm:text-xl">{item.name}</p>
                    {each ? (
                      <p className="mt-2 text-sm font-semibold text-slate-300">
                        {each} each <span className="font-medium text-slate-300">· shared by {splitCount}</span>
                      </p>
                    ) : (
                      <p className="mt-2 text-sm font-medium text-slate-300">Choose diners to split this item</p>
                    )}
                  </div>
                  <div className="flex items-start gap-1">
                    <div className="text-right">
                      <p className="text-lg font-bold leading-tight tracking-tight text-white sm:text-xl">{formatMoney(item.price, currency)}</p>
                      {formatMyrEquivalent(item.price, currency, myrRate) && (
                        <p className="mt-1 text-[11px] font-semibold text-blue-300/80">{formatMyrEquivalent(item.price, currency, myrRate)}</p>
                      )}
                    </div>
                    <button onClick={() => onRemoveItem(item.id)} aria-label={`Remove ${item.name}`} className="-mt-1 ml-1 rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-400/10 hover:text-rose-200 active:scale-95">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-x-3 gap-y-3">
                  {people.length > 0 ? people.map((person) => {
                    const assigned = item.assigned.includes(person);
                    return (
                      <button
                        key={person}
                        onClick={() => onToggleAssignment(item.id, person)}
                        className={`flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition active:scale-95 ${assigned ? 'border-blue-500/40 bg-blue-600/20 text-blue-400 shadow-md shadow-blue-950/30' : 'border-white/10 bg-white/5 text-slate-400 hover:border-blue-500/30 hover:bg-white/10 hover:text-white'}`}
                      >
                        {assigned ? <Check size={14} strokeWidth={2.6} /> : <UserCircle size={14} className="text-slate-400" />}
                        {person}
                      </button>
                    );
                  }) : <p className="text-xs text-slate-300">Add people above, then select who shared each item.</p>}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-white/20 bg-white/[0.03] p-6 text-center text-sm font-medium text-slate-300">No items yet. Scan a receipt or add an item below.</div>
      )}

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)_5.75rem_auto] gap-2 border-t border-white/10 pt-4">
        <input ref={manualNameInputRef} value={manualName} onChange={(event) => setManualName(event.target.value)} placeholder="Item name" className="glass-input min-w-0 text-sm" />
        <input value={manualPrice} onChange={(event) => setManualPrice(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addManualItem(); }} inputMode="decimal" placeholder="0.00" className="glass-input w-full text-sm" />
        <button onClick={addManualItem} aria-label="Add item" className="flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-3 text-white shadow-lg shadow-blue-500/25 transition hover:brightness-110 active:scale-95"><Plus size={18} /></button>
      </div>
    </section>
  );
}
