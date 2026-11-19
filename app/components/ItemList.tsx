'use client';

import { useRef, useState, type RefObject } from 'react';
import { ChevronDown, ChevronRight, ListChecks, Pencil, Plus, Trash2, Users } from 'lucide-react';
import ItemAssignmentModal from './ItemAssignmentModal';
import ItemEditor from './ItemEditor';
import type { Item } from '../types';
import { currencyDecimalPlaces, formatMoney, formatMyrEquivalent, type CurrencyCode } from '../lib/currency';
import { capitalizeFirstLetter } from '../lib/utils';
import { isBillAmount } from '../lib/split';

type Props = {
  items: Item[];
  people: string[];
  onAddManualItem: (name: string, price: number) => void;
  onRemoveItem: (id: string) => void;
  onUpdateItem: (id: string, name: string, price: number) => void;
  onUpdateAssignment: (id: string, people: string[]) => void;
  onAssignSelected: (ids: string[], people: string[]) => void;
  showUnassignedOnly: boolean;
  onFilterChange: (unassignedOnly: boolean) => void;
  currency: CurrencyCode;
  myrRate: number;
  manualNameInputRef?: RefObject<HTMLInputElement | null>;
};

const filterButtonClass = 'min-h-11 min-w-0 rounded-lg px-2 py-1.5 text-sm font-medium leading-tight text-slate-300 transition hover:bg-white/5 aria-pressed:bg-blue-500/20 aria-pressed:text-blue-100';
const toolButtonClass = 'min-h-11 min-w-0 rounded-lg border border-white/10 px-2 py-1.5 text-sm font-medium leading-tight text-slate-200 transition hover:bg-white/5 aria-pressed:border-blue-400/40 aria-pressed:bg-blue-500/15 aria-pressed:text-blue-100';

export default function ItemList({
  items,
  people,
  onAddManualItem,
  onRemoveItem,
  onUpdateItem,
  onUpdateAssignment,
  onAssignSelected,
  showUnassignedOnly,
  onFilterChange,
  currency,
  myrRate,
  manualNameInputRef,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [priceTouched, setPriceTouched] = useState(false);
  const [compact, setCompact] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [assignmentItemId, setAssignmentItemId] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const bulkToggleRef = useRef<HTMLButtonElement>(null);
  const unassignedFilterRef = useRef<HTMLButtonElement>(null);
  const decimalPlaces = currencyDecimalPlaces(currency);
  const priceInput = manualPrice.trim().replace(',', '.');
  const amount = Number(priceInput);
  const pricePattern = decimalPlaces === 0 ? /^\d+$/ : /^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/;
  const priceError = !priceInput ? 'Enter an item price.'
    : !pricePattern.test(priceInput) ? (decimalPlaces === 0 ? 'Enter a whole price in rupiah.' : 'Enter a price with up to two decimal places, such as 12.50.')
    : !isBillAmount(amount) ? 'An item price can be at most 1 billion in the receipt currency.' : '';
  const unassignedCount = items.filter((item) => item.assigned.length === 0).length;

  const assignedCount = items.length - unassignedCount;
  const visibleItems = showUnassignedOnly ? items.filter((item) => item.assigned.length === 0) : items;
  const assignmentItem = items.find((item) => item.id === assignmentItemId);
  const visibleSelection = visibleItems.filter((item) => selectedIds.includes(item.id)).map((item) => item.id);
  const assignees = people.filter((person) => selectedPeople.includes(person));

  const addManualItem = () => {
    setPriceTouched(true);
    const name = capitalizeFirstLetter(manualName.trim());
    if (!name || priceError) return;
    onAddManualItem(name, amount);
    setManualName('');
    setManualPrice('');
    setPriceTouched(false);
    manualNameInputRef?.current?.focus();
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    setSelectedIds([]);
    setSelectedPeople([]);
    bulkToggleRef.current?.focus();
  };

  const changeFilter = (unassignedOnly: boolean) => {
    setSelectedIds([]);
    setExpandedItemId(null);
    onFilterChange(unassignedOnly);
  };

  return (
    <section className="bill-panel p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold tracking-tight text-white">
          <ListChecks className="h-4 w-4 text-blue-400" />
          Items
        </h2>
        {unassignedCount > 0 && (
          <span className="shrink-0 rounded-full border border-blue-500/30 bg-blue-600/10 px-2.5 py-1 text-sm font-bold tracking-wide text-blue-300">
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
          <div className="space-y-2">
            <div role="group" aria-label="Item filters" className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-slate-950/40 p-1">
              <button type="button" aria-pressed={!showUnassignedOnly} onClick={() => changeFilter(false)} className={filterButtonClass}>
                All items ({items.length})
              </button>
              <button ref={unassignedFilterRef} type="button" aria-pressed={showUnassignedOnly} onClick={() => changeFilter(true)} className={filterButtonClass}>
                Unassigned ({unassignedCount})
              </button>
            </div>
            <div role="group" aria-label="Item tools" className={`grid gap-2 ${people.length > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <button type="button" aria-pressed={compact} onClick={() => { setCompact(!compact); setExpandedItemId(null); }} className={toolButtonClass}>
                Compact view
              </button>
              {people.length > 0 && (
                <button ref={bulkToggleRef} type="button" aria-pressed={bulkMode} onClick={() => { if (bulkMode) exitBulkMode(); else setBulkMode(true); }} className={toolButtonClass}>
                  Bulk assign
                </button>
              )}
            </div>
          </div>
          {bulkMode && people.length > 0 && (
            <fieldset className="space-y-2 rounded-xl border border-white/15 p-3">
              <legend className="px-1 text-sm font-semibold text-slate-100">Add people to selected items</legend>
              <div className="flex flex-wrap items-center gap-x-3">
                <p role="status" className="text-sm text-slate-300">{visibleSelection.length} selected</p>
                <button type="button" disabled={!visibleItems.length} onClick={() => setSelectedIds(visibleSelection.length === visibleItems.length ? [] : visibleItems.map((item) => item.id))} className="min-h-11 text-sm font-semibold text-blue-300 disabled:opacity-50">{visibleItems.length > 0 && visibleSelection.length === visibleItems.length ? 'Clear selection' : 'Select all visible'}</button>
              </div>
              <div className="flex flex-wrap gap-x-3">
                {people.map((person) => <label key={person} className="flex min-h-11 items-center gap-2 break-all text-sm text-slate-200"><input type="checkbox" checked={assignees.includes(person)} onChange={(event) => setSelectedPeople(event.target.checked ? [...assignees, person] : assignees.filter((name) => name !== person))} className="h-4 w-4 shrink-0 accent-blue-500" />{person}</label>)}
              </div>
              <button type="button" disabled={!visibleSelection.length || !assignees.length} onClick={() => { onAssignSelected(visibleSelection, assignees); exitBulkMode(); }} className="min-h-11 rounded-xl bg-blue-700 px-3 text-sm font-semibold text-white disabled:opacity-50">Add to selected items</button>
            </fieldset>
          )}
        </div>
      )}
      {items.length > 0 && visibleItems.length === 0 && <p className="mb-4 text-sm text-emerald-200">No unassigned items left. Select All items to review your split.</p>}

      {items.length > 0 ? (
        <ul className={compact ? 'space-y-2' : 'space-y-5'}>
          {visibleItems.map((item) => {
            const splitCount = item.assigned.length;
            const each = splitCount > 0 ? formatMoney(item.price / splitCount, currency) : null;
            const price = formatMoney(item.price, currency);
            const equivalent = formatMyrEquivalent(item.price, currency, myrRate);
            const expanded = compact && expandedItemId === item.id;
            const editing = editingId === item.id;
            const everyoneAssigned = people.length > 1 && people.every((person) => item.assigned.includes(person));
            const assignmentSummary = everyoneAssigned ? `Everyone (${people.length})` : item.assigned.slice(0, compact ? 1 : 2).join(', ') || 'Assign people';
            const extraAssignees = everyoneAssigned ? 0 : splitCount - (compact ? 1 : 2);
            const assignmentTrigger = people.length > 0 && (
              <button
                type="button"
                aria-haspopup="dialog"
                aria-label={splitCount ? `Change assignment for ${item.name}, ${everyoneAssigned ? assignmentSummary : item.assigned.join(', ')}` : `Assign people to ${item.name}`}
                onClick={() => setAssignmentItemId(item.id)}
                className={`flex min-h-11 min-w-0 items-center gap-1.5 rounded-lg border px-2.5 text-left font-semibold transition hover:bg-white/10 ${compact ? 'max-w-[45%] text-xs' : 'mt-3 w-full text-sm'} ${splitCount ? 'border-white/10 bg-white/5 text-blue-200' : 'border-amber-300/30 bg-amber-300/5 text-amber-200'}`}
              >
                {!compact && <Users size={16} aria-hidden="true" className="shrink-0" />}
                <span title={splitCount ? item.assigned.join(', ') : undefined} className="truncate">{assignmentSummary}</span>
                {extraAssignees > 0 && <span className="shrink-0">+{extraAssignees}</span>}
                <ChevronRight aria-hidden="true" size={15} className={`shrink-0 ${compact ? '' : 'ml-auto'}`} />
              </button>
            );
            const editor = editing && <ItemEditor name={item.name} price={item.price} onSave={(name, price) => { onUpdateItem(item.id, name, price); setEditingId(null); }} onCancel={() => setEditingId(null)} />;
            const itemActions = !editing && <>
              <button type="button" onClick={() => setEditingId(item.id)} aria-label={`Edit ${item.name}`} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10"><Pencil size={16} /></button>
              <button type="button" onClick={() => onRemoveItem(item.id)} aria-label={`Remove ${item.name}`} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-300 transition hover:bg-rose-400/10 hover:text-rose-200 active:scale-95"><Trash2 size={15} /></button>
            </>;
            const selectItem = bulkMode && people.length > 0 && (!showUnassignedOnly || splitCount === 0) && (
              <label className={`flex min-h-11 items-center text-sm text-slate-200 ${compact ? 'shrink-0 px-2' : 'gap-2 break-all'}`}>
                <input type="checkbox" checked={visibleSelection.includes(item.id)} onChange={(event) => setSelectedIds(event.target.checked ? [...visibleSelection, item.id] : visibleSelection.filter((id) => id !== item.id))} className="h-4 w-4 shrink-0 accent-blue-500" />
                <span className={compact ? 'sr-only' : undefined}>Select {item.name}</span>
              </label>
            );
            return (
              <li key={item.id} className={`rounded-xl border ${compact ? 'px-3 py-2' : 'px-4 py-5 sm:px-5'} ${splitCount === 0 ? 'border-amber-300/30 bg-amber-300/5' : 'border-white/10 bg-slate-950/25'}`}>
                {compact ? (
                  <div className="flex items-center gap-1">
                    {selectItem}
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={expanded ? `item-details-${item.id}` : undefined}
                      onClick={() => setExpandedItemId(expanded ? null : item.id)}
                      className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg text-left hover:bg-white/5"
                    >
                      <span title={item.name} className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{item.name}</span>
                      <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-slate-200">{price}</span>
                      <ChevronDown aria-hidden="true" size={14} className={`shrink-0 ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                    {assignmentTrigger || <span className="text-xs font-semibold text-amber-200">Unassigned</span>}
                  </div>
                ) : (
                  <>
                    {selectItem}
                    {editor || (
                      <div className="grid grid-cols-1 gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-lg font-bold leading-snug tracking-tight text-white sm:text-xl">{item.name}</p>
                          {each ? (
                            <p className="mt-2 text-sm font-semibold text-slate-300">
                              {each} each <span className="font-medium text-slate-300">- shared by {splitCount}</span>
                            </p>
                          ) : people.length === 0 && (
                            <p className="mt-2 text-sm font-medium text-amber-200">Unassigned</p>
                          )}
                        </div>
                        <div className="flex items-start gap-1">
                          <div className="min-w-0 flex-1">
                            <p className="text-lg font-bold leading-tight tracking-tight text-white sm:text-xl">{price}</p>
                            {equivalent && <p className="mt-1 text-sm font-semibold text-blue-300/80">{equivalent}</p>}
                          </div>
                          <div className="-mt-1 flex gap-1">{itemActions}</div>
                        </div>
                      </div>
                    )}
                    {assignmentTrigger}
                  </>
                )}

                {compact && editor && <div className="border-t border-white/10 pt-3">{editor}</div>}
                {expanded && (
                  <div id={`item-details-${item.id}`} className="flex items-center justify-between gap-2 border-t border-white/10 pt-1">
                    <div className="min-w-0 text-sm text-slate-300">
                      <p className="break-words font-semibold text-slate-100">{item.name}</p>
                      {each && <p>{each} each</p>}
                      {equivalent && <p className="text-blue-300">{equivalent}</p>}
                    </div>
                    <div className="flex shrink-0">{itemActions}</div>
                  </div>
                )}
                {people.length === 0 && (!compact || expanded) && <p className="mt-2 text-sm text-slate-300">Add people above, then select who shared each item.</p>}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-white/20 bg-white/[0.03] p-6 text-center text-sm font-medium text-slate-300">No items yet. Scan a receipt or add an item below.</div>
      )}

      {assignmentItem && people.length > 0 && (
        <ItemAssignmentModal
          key={assignmentItem.id}
          item={assignmentItem}
          people={people}
          onClose={() => setAssignmentItemId(null)}
          onSave={(assignees) => {
            onUpdateAssignment(assignmentItem.id, assignees);
            setAssignmentItemId(null);
            if (showUnassignedOnly && assignees.length > 0) {
              setExpandedItemId(null);
              requestAnimationFrame(() => unassignedFilterRef.current?.focus());
            }
          }}
        />
      )}

      <form noValidate onSubmit={(event) => { event.preventDefault(); addManualItem(); }} className="mt-6 grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-t border-white/10 pt-4">
        <input
          ref={manualNameInputRef}
          value={manualName}
          autoCapitalize="sentences"
          onChange={(event) => {
            const { value } = event.currentTarget;
            setManualName((event.nativeEvent as InputEvent).isComposing ? value : capitalizeFirstLetter(value));
          }}
          onCompositionEnd={(event) => setManualName(capitalizeFirstLetter(event.currentTarget.value))}
          aria-label="New item name"
          placeholder="Item name"
          className="bill-scroll-target glass-input col-span-2 min-w-0 text-base"
        />
        <input
          value={manualPrice}
          onChange={(event) => setManualPrice(event.currentTarget.value)}
          onBlur={() => { if (manualPrice.trim()) setPriceTouched(true); }}
          aria-label={`New item price (${currency})`}
          aria-invalid={priceTouched && Boolean(priceError)}
          aria-describedby="manual-item-price-hint"
          inputMode={decimalPlaces === 0 ? 'numeric' : 'decimal'}
          placeholder={decimalPlaces === 0 ? 'Price (IDR)' : `Price (${currency})`}
          className="glass-input w-full text-base"
        />
        <button type="submit" disabled={!manualName.trim()} aria-label="Add item" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-blue-700 px-3 text-white transition hover:bg-blue-600 active:scale-95 disabled:opacity-50"><Plus size={18} /></button>
        <p id="manual-item-price-hint" aria-live="polite" className={`col-span-2 text-xs ${priceTouched && priceError ? 'text-rose-200' : 'text-slate-300'}`}>
          {priceTouched && priceError ? priceError : decimalPlaces === 0 ? 'Enter the price in whole rupiah.' : 'Enter a price such as 12.50.'}
        </p>
      </form>
    </section>
  );
}
