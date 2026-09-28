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
    <section className="glass-card p-5">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <Users className="h-4 w-4 text-blue-400" />
          People
      </h2>
      <div className="flex gap-2">
        <input
          value={personInput}
          onChange={(e) => setPersonInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addPerson();
          }}
          placeholder="Friend's name"
          className="glass-input min-w-0 flex-1 rounded-xl px-4 py-2.5 text-sm outline-none transition"
        />
        <button
          onClick={addPerson}
          aria-label="Add person"
          className="flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 text-white shadow-lg shadow-blue-500/25 transition active:scale-95 hover:brightness-110"
        >
          <Plus size={18} />
        </button>
      </div>
      {people.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {people.map((p) => (
            <span
              key={p}
              className="flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-600/15 py-1.5 pl-3 pr-1.5 text-xs font-semibold text-blue-300"
            >
              {p}
              <button
                onClick={() => onRemove(p)}
                aria-label={`Remove ${p}`}
                className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-slate-300 transition hover:bg-white/20 active:scale-90"
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
