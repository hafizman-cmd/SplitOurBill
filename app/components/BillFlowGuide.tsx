'use client';

import { Check } from 'lucide-react';
import { useState } from 'react';

type Props = {
  currentStep: number;
  hasItems: boolean;
  hasPeople: boolean;
  unassignedCount: number;
  onSelectStep: (step: number) => void;
};

export default function BillFlowGuide({ currentStep, hasItems, hasPeople, unassignedCount, onSelectStep }: Props) {
  const [selected, setSelected] = useState<{ step: number; progress: number } | null>(null);
  const descriptionStep = selected?.progress === currentStep ? selected.step : currentStep;
  const steps = ['Scan or Add Items', 'Add People', 'Assign Items', 'Review & Share'];
  const complete = [hasItems, hasPeople, hasItems && hasPeople && unassignedCount === 0, false];
  const descriptions = [
    'Scan a receipt or add items manually.',
    'Add everyone sharing the bill.',
    unassignedCount > 0 ? `Choose who shared each item. ${unassignedCount} left.` : 'Choose who shared each item.',
    'Check totals and share the split.',
  ];

  return (
    <section aria-label="Your bill progress" className="bill-panel px-2 py-2">
      <nav aria-label="Bill steps" className="relative">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-[12.5%] top-[19px] h-0.5 bg-slate-700">
          <div className="h-full origin-left bg-blue-400 transition-transform duration-500 ease-out motion-reduce:transition-none" style={{ transform: `scaleX(${currentStep / (steps.length - 1)})` }} />
        </div>
        <ol className="relative grid grid-cols-4">
          {steps.map((label, index) => (
            <li key={label}>
              <button type="button" aria-current={currentStep === index ? 'step' : undefined} aria-label={`${index + 1}. ${label}${complete[index] ? ', complete' : ''}`} onClick={() => {
                setSelected({ step: index, progress: currentStep });
                onSelectStep(index);
              }} className={`flex h-full min-h-11 w-full flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-center text-xs font-semibold leading-tight transition-colors hover:bg-white/10 ${currentStep === index ? 'text-blue-200' : 'text-slate-300'}`}>
                <span aria-hidden="true" className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${complete[index] ? 'border-blue-500 bg-blue-600 text-white' : currentStep === index ? 'border-blue-400 bg-slate-950 text-blue-200' : 'border-slate-600 bg-slate-900 text-slate-300'}`}>{complete[index] ? <Check size={15} /> : index + 1}</span>
                <span>{label}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <p role="status" className="px-2 pb-1 pt-0.5 text-center text-xs leading-4 text-slate-300">{descriptions[descriptionStep]}</p>
    </section>
  );
}
