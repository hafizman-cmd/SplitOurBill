'use client';

import { useState, type RefObject } from 'react';
import { Check, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react';
import ItemEditor from './ItemEditor';
import type { Item } from '../types';
import { formatMoney, formatMyrEquivalent, type CurrencyCode } from '../lib/currency';

type Props = {
  items: Item[];
  people: string[];
  onAddManualItem: (name: string, price: number) => void;
  onRemoveItem: (id: string) => void;
  onUpdateItem: (id: string, name: string, price: number) => void;
  onAssignEveryone: (id: string) => void;
  showUnassignedOnly: boolean;
  onFilterChange: (unassignedOnly: boolean) => void;
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
  onUpdateItem,
  onAssignEveryone,
  showUnassignedOnly,
  onFilterChange,
  onToggleAssignment,
  currency,
  myrRate,
  manualNameInputRef,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const unassignedCount = items.filter((item) => item.assigned.length === 0).length;

  const assignedCount = items.length - unassignedCount;
  const visibleItems = showUnassignedOnly ? items.filter((item) => item.assigned.length === 0) : items;

  const addManualItem = () => {
    const name = manualName.trim();
    const price = Number(manualPrice);
    if (!name || !manualPrice.trim() || !Number.isFinite(price) || price < 0) return;
    onAddManualItem(name, price);
    setManualName('');
    setManualPrice('');
  };

  return (
    <section className="glass-card overflow-hidden p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold tracking-tight text-white">
          <ListChecks className="h-4 w-4 text-blue-400" />
          Items
        </h2>
        {unassignedCount > 0 && (
          <span className="shrink-0 rounded-full border border-blue-500/30 bg-blue-600/10 px-2.5 py-1 text-[10px] font-bold tracking-wide text-blue-300">
            {unassignedCount} to assign
          </span>
        )}
      </div>

      {items.length > 0 && (
        <div className="mb-4 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <p role="status" className="text-sm font-semibold text-slate-200">{assignedCount} of {items.length} items assigned</p>
          <div role="progressbar" aria-label="Item assignment progress" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={assignedCount} className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className={`h-full rounded-full transition-all ${unassignedCount === 0 ? 'bg-emerald-400' : 'bg-blue-400'}`} style={{ width: `${assignedCount / items.length * 100}%` }} />
          </div>
          <p className={`text-sm ${unassignedCount === 0 ? 'text-emerald-200' : 'text-amber-200'}`}>{unassignedCount === 0 ? 'All items assigned. Your split is ready to share.' : 'Assign every item before sharing. Select everyone who shared a dish.'}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={!showUnassignedOnly} onClick={() => onFilterChange(false)} className={`min-h-11 rounded-xl border px-3 text-sm ${!showUnassignedOnly ? 'border-blue-400/40 bg-blue-500/20 text-blue-100' : 'border-white/15 text-slate-300'}`}>All items ({items.length})</button>
            <button type="button" aria-pressed={showUnassignedOnly} onClick={() => onFilterChange(true)} className={`min-h-11 rounded-xl border px-3 text-sm ${showUnassignedOnly ? 'border-blue-400/40 bg-blue-500/20 text-blue-100' : 'border-white/15 text-slate-300'}`}>Unassigned ({unassignedCount})</button>
          </div>
        </div>
      )}
      {items.length > 0 && visibleItems.length === 0 && <p className="mb-4 text-sm text-emerald-200">No unassigned items left. Select All items to review your split.</p>}

      {items.length > 0 ? (
        <ul className="space-y-5">
          {visibleItems.map((item) => {
            const splitCount = item.assigned.length;
            const each = splitCount > 0 ? formatMoney(item.price / splitCount, currency) : null;
            return (
              <li key={item.id} className={`rounded-2xl border bg-slate-950/30 px-4 py-5 shadow-xl shadow-black/20 sm:px-5 ${splitCount === 0 ? 'border-amber-300/30' : 'border-white/10'}`}>
                {editingId === item.id ? <ItemEditor name={item.name} price={item.price} onSave={(name, price) => { onUpdateItem(item.id, name, price); setEditingId(null); }} onCancel={() => setEditingId(null)} /> : (
                <div className="grid grid-cols-1 gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-lg font-bold leading-snug tracking-tight text-white sm:text-xl">{item.name}</p>
                    {each ? (
                      <p className="mt-2 text-sm font-semibold text-slate-300">
                        {each} each <span className="font-medium text-slate-300">- shared by {splitCount}</span>
                      </p>
                    ) : (
                      <p className="mt-2 text-sm font-medium text-slate-300">Unassigned - choose who shared this item</p>
                    )}
                  </div>
                  <div className="flex items-start gap-1">
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-bold leading-tight tracking-tight text-white sm:text-xl">{formatMoney(item.price, currency)}</p>
                      {formatMyrEquivalent(item.price, currency, myrRate) && (
                        <p className="mt-1 text-[11px] font-semibold text-blue-300/80">{formatMyrEquivalent(item.price, currency, myrRate)}</p>
                      )}
                    </div>
                    <button type="button" onClick={() => setEditingId(item.id)} aria-label={`Edit ${item.name}`} className="-mt-1 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10"><Pencil size={16} /></button>
                    <button type="button" onClick={() => onRemoveItem(item.id)} aria-label={`Remove ${item.name}`} className="-mt-1 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 transition hover:bg-rose-400/10 hover:text-rose-200 active:scale-95">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                )}

                <div className="mt-6 flex flex-wrap gap-x-3 gap-y-3">
                  {people.length > 1 && <button type="button" onClick={() => onAssignEveryone(item.id)} className="min-h-11 rounded-full border border-blue-400/30 px-3 text-sm font-semibold text-blue-200">Split between everyone</button>}
                  {people.length > 0 ? people.map((person) => {
                    const assigned = item.assigned.includes(person);
                    return (
                      <button
                        key={person}
                        onClick={() => onToggleAssignment(item.id, person)}
                        aria-pressed={assigned}
                        aria-label={`${person}, ${assigned ? "assigned" : "not assigned"} to ${item.name}`}
                        className={`flex min-h-11 items-center gap-2 rounded-full border px-2.5 text-sm font-semibold transition active:scale-95 ${assigned ? 'border-blue-400/40 bg-blue-500/20 text-blue-100 shadow-md shadow-blue-950/30' : 'border-white/10 bg-white/5 text-slate-400 hover:border-blue-500/30 hover:bg-white/10 hover:text-white'}`}
                      >
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${assigned ? "bg-blue-400 text-slate-950" : "bg-white/10 text-slate-300"}`}>{assigned ? <Check size={14} strokeWidth={2.6} /> : person.charAt(0).toUpperCase()}</span>
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
        <input ref={manualNameInputRef} value={manualName} onChange={(event) => setManualName(event.target.value)} aria-label="New item name" placeholder="Item name" className="glass-input min-w-0 text-sm" />
        <input value={manualPrice} onChange={(event) => setManualPrice(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addManualItem(); }} aria-label="New item price" inputMode="decimal" placeholder="0.00" className="glass-input w-full text-sm" />
        <button onClick={addManualItem} aria-label="Add item" className="flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-3 text-white shadow-lg shadow-blue-500/25 transition hover:brightness-110 active:scale-95"><Plus size={18} /></button>
      </div>
    </section>
  );
}
