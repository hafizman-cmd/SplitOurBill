'use client';

import { useState } from 'react';
import { Plus, Users, X } from 'lucide-react';
import { capitalizeFirstLetter } from '../lib/utils';

type Props = {
  people: string[];
  onAdd: (name: string) => boolean;
  onRemove: (name: string) => void;
};

export default function PeopleManager({ people, onAdd, onRemove }: Props) {
  const [personInput, setPersonInput] = useState('');

  const addPerson = () => {
    const name = capitalizeFirstLetter(personInput.trim());
    if (!name) return;
    if (onAdd(name)) setPersonInput('');
  };

  return (
    <section className="bill-panel p-5">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold tracking-tight text-white">
        <Users className="h-4 w-4 text-blue-400" />
          People
      </h2>
      <div className="flex gap-2">
        <input
          value={personInput}
          autoCapitalize="sentences"
          onChange={(e) => {
            const { value } = e.currentTarget;
            setPersonInput((e.nativeEvent as InputEvent).isComposing ? value : capitalizeFirstLetter(value));
          }}
          onCompositionEnd={(e) => setPersonInput(capitalizeFirstLetter(e.currentTarget.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) addPerson();
          }}
          aria-label="Friend's name"
          placeholder="Friend's name"
          className="glass-input min-w-0 flex-1 rounded-xl px-4 py-2.5 text-base outline-none transition"
        />
        <button
          onClick={addPerson}
          aria-label="Add person"
          className="flex items-center justify-center rounded-xl bg-blue-700 px-4 text-white transition hover:bg-blue-600 active:scale-95"
        >
          <Plus size={18} />
        </button>
      </div>
      {people.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-x-1.5 gap-y-1">
          {people.map((p) => (
            <li
              key={p}
              className="flex max-w-full items-center rounded-full border border-white/10 bg-white/5 pl-2.5 text-sm font-medium text-slate-100"
            >
              <span className="min-w-0 py-2 [overflow-wrap:anywhere]">{p}</span>
              <button
                type="button"
                onClick={() => onRemove(p)}
                aria-label={`Remove ${p}`}
                className="flex h-11 w-8 min-w-8 shrink-0 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white active:scale-95"
              >
                <X aria-hidden="true" size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-300">
          Add everyone sharing the bill so items can be assigned.
        </p>
      )}
    </section>
  );
}
