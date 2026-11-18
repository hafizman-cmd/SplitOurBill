'use client';

import Modal from './Modal';

import { useEffect, useState } from 'react';
import { Download, Globe, ReceiptText, Smartphone } from 'lucide-react';

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const CHOICE_KEY = 'kira_install_choice_v1';

export default function InstallChoiceModal() {
  const [open, setOpen] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [instructions, setInstructions] = useState(false);

  useEffect(() => {
    const installed = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
      document.referrer.startsWith('android-app://');
    if (installed) return;

    setIsIOS(/iPhone|iPad|iPod/i.test(navigator.userAgent));
    try {
      if (!window.localStorage.getItem(CHOICE_KEY)) setOpen(true);
    } catch {
      setOpen(false);
    }
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const close = () => {
    setOpen(false);
    try {
      window.localStorage.setItem(CHOICE_KEY, 'web');
    } catch {
      return;
    }
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
      setOpen(false);
      try {
        window.localStorage.setItem(CHOICE_KEY, 'installed');
      } catch {
        return;
      }
    }
  };

  if (!open) return null;

  return (
    <Modal onClose={close} aria-labelledby="install-choice-title" className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-4 backdrop-blur-md">
      <div className="my-auto w-full max-w-sm rounded-[2rem] border border-white/15 bg-[#111827] p-5 text-slate-100 shadow-2xl shadow-black/70">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-400/25 bg-blue-500/15 text-cyan-300"><ReceiptText size={25} /></div>
        <h2 id="install-choice-title" className="text-2xl font-bold">Welcome to Kira-Kira</h2>
        <p className="mt-2 text-sm leading-5 text-slate-300">Split your bill here, or install Kira-Kira on your device for easy access.</p>
        {instructions ? (
          <div className="mt-3 rounded-2xl border border-blue-400/20 bg-blue-500/10 p-3 text-sm leading-5 text-slate-200">
            {isIOS
              ? 'Open this page in Safari, tap Share, then Add to Home Screen.'
              : 'Open your browser menu and look for Install app or Add to Home Screen.'}
          </div>
        ) : null}
        <div className="mt-4 grid gap-2">
          <button type="button" onClick={() => void install()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#007AFF] px-4 py-2.5 font-semibold text-white shadow-lg shadow-blue-500/25 hover:bg-[#0066D6]">
            <Download size={18} aria-hidden="true" />Install app
          </button>
          {!isIOS && (
            <a href="/kira-kira.apk" download="Kira-Kira.apk" className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 font-semibold hover:bg-white/10">
              <Smartphone size={18} aria-hidden="true" />Download Android APK
            </a>
          )}
          <button type="button" onClick={close} className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 font-semibold text-slate-300 hover:text-white">
            <Globe size={18} aria-hidden="true" />Continue on web
          </button>
        </div>
      </div>
    </Modal>
  );
}
