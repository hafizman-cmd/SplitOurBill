'use client';

import Modal from './Modal';

type Props = {
  title: string;
  description: string;
  confirmLabel: string;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
};

export default function ConfirmModal({ title, description, confirmLabel, error, onConfirm, onClose }: Props) {
  return (
    <Modal onClose={onClose} aria-labelledby="confirm-title" aria-describedby="confirm-description" className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="my-auto w-full max-w-md rounded-3xl border border-white/20 bg-slate-950 p-6 text-slate-100 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <h2 id="confirm-title" className="text-xl font-semibold">{title}</h2>
        <p id="confirm-description" className="mt-3 text-base leading-relaxed text-slate-300">{description}</p>
        {error && <p role="alert" className="mt-3 text-sm text-amber-200">{error}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" data-autofocus onClick={onClose} className="min-h-11 flex-1 rounded-xl border border-white/20 px-4 py-3 font-semibold">Cancel</button>
          <button type="button" onClick={onConfirm} className="min-h-11 flex-1 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white">{confirmLabel}</button>
        </div>
      </div>
    </Modal>
  );
}
