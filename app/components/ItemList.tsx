'use client';

import { useState } from 'react';
import { Check, Plus, Receipt, Trash2 } from 'lucide-react';
import type { Item } from '../types';
import { formatRM } from '../lib/utils';

type Props = {
  items: Item[];
  people: string[];
  onAddManualItem: (name: string, price: number) => void;
  onRemoveItem: (id: string) => void;
  onToggleAssignment: (itemId: string, person: string) => void;
};

export default function ItemList({
  items,
  people,
  onAddManualItem,
  onRemoveItem,
  onToggleAssignment,
}: Props) {
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');

  const addManualItem = () => {
    const name = manualName.trim();
    const price = Number(manualPrice);
    if (!name) return;
    if (!Number.isFinite(price) || price < 0) return;
    onAddManualItem(name, price);
    setManualName('');
    setManualPrice('');
  };

  const unassignedCount = items.filter((it) => it.assigned.length === 0).length;

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt size={16} className="text-indigo-600" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Items
          </h2>
        </div>
        {unassignedCount > 0 && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-600">
            {unassignedCount} unassigned
          </span>
        )}
      </div>

      {items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((it) => (
            <li
              key={it.id}
              className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 break-words text-sm font-semibold text-slate-800">
                  {it.name}
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-bold text-slate-700">
                    {formatRM(it.price)}
                  </span>
                  <button
                    onClick={() => onRemoveItem(it.id)}
                    aria-label={`Remove ${it.name}`}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {people.length > 0 ? (
                  people.map((p) => {
                    const assigned = it.assigned.includes(p);
                    return (
                      <button
                        key={p}
                        onClick={() => onToggleAssignment(it.id, p)}
                        className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                          assigned
                            ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
                        }`}
                      >
                        {assigned && <Check size={12} />}
                        {p}
                      </button>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-400">
                    Add people above, then tap names to split this item.
                  </p>
                )}
              </div>
              {it.assigned.length > 0 && (
                <p className="mt-2.5 text-[11px] font-medium text-indigo-600">
                  {formatRM(it.price / it.assigned.length)} each - shared by{' '}
                  {it.assigned.length}
                  {it.assigned.length > 1 ? ' people' : ' person'}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-400">
          No items yet. Scan a receipt or add items manually below.
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <input
          value={manualName}
          onChange={(e) => setManualName(e.target.value)}
          placeholder="Item name"
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
        />
        <input
          value={manualPrice}
          onChange={(e) => setManualPrice(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addManualItem();
          }}
          inputMode="decimal"
          placeholder="0.00"
          className="w-24 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
        />
        <button
          onClick={addManualItem}
          aria-label="Add item"
          className="flex items-center justify-center rounded-xl bg-indigo-600 px-4 text-white shadow-sm transition active:scale-95 hover:bg-indigo-700"
        >
          <Plus size={18} />
        </button>
      </div>
    </section>
  );
}
