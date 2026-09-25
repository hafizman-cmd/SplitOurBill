'use client';

import { useState } from 'react';
import { Plus, Users, X } from 'lucide-react';

type Props = {
  people: string[];
  onAdd: (name: string) => boolean;
  onRemove: (name: string) => void;
};

export default function PeopleManager({ people, onAdd, onRemove }: Props) {
  const [personInput, setPersonInput] = useState('');

  const addPerson = () => {
    const name = personInput.trim();
    if (!name) return;
    if (onAdd(name)) setPersonInput('');
  };

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
      <div className="mb-3 flex items-center gap-2">
        <Users size={16} className="text-indigo-600" />
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          People
        </h2>
      </div>
      <div className="flex gap-2">
        <input
          value={personInput}
          onChange={(e) => setPersonInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addPerson();
          }}
          placeholder="Friend's name"
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
        />
        <button
          onClick={addPerson}
          aria-label="Add person"
          className="flex items-center justify-center rounded-xl bg-indigo-600 px-4 text-white shadow-sm transition active:scale-95 hover:bg-indigo-700"
        >
          <Plus size={18} />
        </button>
      </div>
      {people.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {people.map((p) => (
            <span
              key={p}
              className="flex items-center gap-1.5 rounded-full bg-indigo-100 py-1.5 pl-3 pr-1.5 text-xs font-semibold text-indigo-700"
            >
              {p}
              <button
                onClick={() => onRemove(p)}
                aria-label={`Remove ${p}`}
                className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-200/70 text-indigo-600 transition hover:bg-indigo-300 active:scale-90"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-400">
          Add everyone sharing the bill so items can be assigned.
        </p>
      )}
    </section>
  );
}
