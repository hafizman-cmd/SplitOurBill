'use client';

import { useEffect, useState } from 'react';
import { Download, Globe, ReceiptText } from 'lucide-react';

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const CHOICE_KEY = 'kira_install_choice_v1';

export default function InstallChoiceModal() {
  const [open, setOpen] = useState(false);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [instructions, setInstructions] = useState(false);

  useEffect(() => {
    const installed = window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!installed && !window.localStorage.getItem(CHOICE_KEY)) setOpen(true);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const close = () => {
    window.localStorage.setItem(CHOICE_KEY, 'web');
    setOpen(false);
  };

  const install = async () => {
    if (!promptEvent) {
      setInstructions(true);
      return;
    }
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setPromptEvent(null);
    if (choice.outcome === 'accepted') {
      window.localStorage.setItem(CHOICE_KEY, 'installed');
      setOpen(false);
    }
  };

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="install-choice-title" className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/70 px-5 py-6 backdrop-blur-md">
      <div className="my-auto w-full max-w-sm rounded-[2rem] border border-white/15 bg-[#111827] p-6 text-slate-100 shadow-2xl shadow-black/70">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-400/25 bg-blue-500/15 text-cyan-300"><ReceiptText size={25} /></div>
        <h2 id="install-choice-title" className="text-2xl font-bold">Welcome to Kira-Kira</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">Split your bill here, or add Kira-Kira to your home screen for easy access.</p>
        {instructions ? (
          <div className="mt-5 rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 text-sm leading-6 text-slate-200">
            On iPhone, open this page in Safari, tap Share, then Add to Home Screen. On Android, open your browser menu and choose Install app or Add to Home screen.
          </div>
        ) : null}
        <div className="mt-6 grid gap-3">
          <button type="button" onClick={() => void install()} className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white shadow-lg shadow-blue-500/25"><Download size={18} />Install app</button>
          <button type="button" onClick={close} className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-semibold text-slate-200"><Globe size={18} />Continue on web</button>
        </div>
      </div>
    </div>
  );
}
