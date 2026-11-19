'use client';

import { useState } from 'react';
import Modal from './Modal';
import type { Item } from '../types';

type Props = {
  item: Item;
  people: string[];
  onClose: () => void;
  onSave: (assignees: string[]) => void;
};

export default function ItemAssignmentModal({ item, people, onClose, onSave }: Props) {
  const [selected, setSelected] = useState(() => item.assigned.filter((person) => people.includes(person)));
  const assignees = selected.filter((person) => people.includes(person));

  return (
    <Modal onClose={onClose} onClick={onClose} className="sheet-overlay" aria-labelledby="item-assignment-title" aria-describedby="item-assignment-name">
      <div className="glass-card sheet-panel flex w-full max-w-md flex-col gap-4 p-5 text-slate-100 sm:p-6" onClick={(event) => event.stopPropagation()}>
        <div>
          <h3 id="item-assignment-title" className="text-lg font-bold text-white">Assign people</h3>
          <p id="item-assignment-name" className="text-sm text-slate-300 [overflow-wrap:anywhere]">{item.name}</p>
        </div>
        {people.length > 1 && (
          <button type="button" onClick={() => setSelected([...people])} className="min-h-11 shrink-0 rounded-xl border border-blue-400/30 px-3 text-sm font-semibold text-blue-200 hover:bg-blue-500/10">
            Split between everyone
          </button>
        )}
        <fieldset aria-label="People sharing this item" className="min-h-0 min-w-0 space-y-1 overflow-y-auto">
          {people.map((person) => (
            <label key={person} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/5 has-[:checked]:bg-blue-500/15">
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 accent-blue-500"
                checked={assignees.includes(person)}
                onChange={(event) => setSelected(event.target.checked ? [...assignees, person] : assignees.filter((name) => name !== person))}
              />
              <span className="min-w-0 [overflow-wrap:anywhere]">{person}</span>
            </label>
          ))}
        </fieldset>
        <div className="grid shrink-0 grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-white/10 px-3 text-sm font-semibold hover:bg-white/5">Cancel</button>
          <button type="button" onClick={() => onSave(assignees)} className="min-h-11 rounded-xl bg-blue-700 px-3 text-sm font-semibold text-white hover:bg-blue-600">Apply</button>
        </div>
      </div>
    </Modal>
  );
}
