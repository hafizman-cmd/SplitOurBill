'use client';

import { ArrowRight, Check } from 'lucide-react';

type Props = {
  currentStep: number;
  hasItems: boolean;
  hasPeople: boolean;
  unassignedCount: number;
  onSelectStep: (step: number) => void;
};

export default function BillFlowGuide({ currentStep, hasItems, hasPeople, unassignedCount, onSelectStep }: Props) {
  const steps = ['Scan or add items', 'Add people', 'Assign items', 'Review & share'];
  const complete = [hasItems, hasPeople, hasItems && hasPeople && unassignedCount === 0, false];
  const descriptions = [
    'Start with a receipt photo, or enter your items manually.',
    'Add everyone sharing this bill. You can add more people anytime.',
    `Choose who shared each dish. ${unassignedCount} item${unassignedCount === 1 ? '' : 's'} still need an owner.`,
    'All items assigned. Check charges and each person’s total, then share.',
  ];

  return (
    <section aria-label="Your bill progress" className="glass-card p-4 sm:p-5">
      <nav aria-label="Bill steps">
        <ol className="grid grid-cols-4 gap-1">
          {steps.map((label, index) => (
            <li key={label}>
              <button type="button" aria-current={currentStep === index ? 'step' : undefined} aria-label={`${index + 1}. ${label}${complete[index] ? ', complete' : ''}`} onClick={() => onSelectStep(index)} className={`flex min-h-20 w-full flex-col items-center gap-2 rounded-xl px-1 py-2 text-center text-xs font-semibold transition hover:bg-white/10 ${currentStep === index ? 'bg-blue-500/15 text-blue-100' : 'text-slate-300'}`}>
                <span className={`flex h-7 w-7 items-center justify-center rounded-full border ${complete[index] ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-200' : currentStep === index ? 'border-blue-400 bg-blue-600 text-white' : 'border-white/20 text-slate-400'}`}>{complete[index] ? <Check size={15} /> : index + 1}</span>
                <span>{label}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <p role="status" className="mt-3 text-sm leading-relaxed text-slate-300">{descriptions[currentStep]}</p>
      {currentStep === 3 && <button type="button" onClick={() => onSelectStep(3)} className="mt-2 flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-200">Review split <ArrowRight size={16} /></button>}
    </section>
  );
}
