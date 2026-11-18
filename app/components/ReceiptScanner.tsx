'use client';

import Modal from './Modal';

import { useEffect, useRef, useState } from 'react';
import { Camera, Code2, Loader2, Upload } from 'lucide-react';

type Props = {
  scanning: boolean;
  scanError: string | null;
  onSelect: (file: File) => void | Promise<void>;
  onOpenCamera: () => void;
  developerMode: boolean;
  onDeveloperModeChange: (enabled: boolean) => void;
};

export default function ReceiptScanner({
  scanning,
  scanError,
  onSelect,
  onOpenCamera,
  developerMode,
  onDeveloperModeChange,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [switchingOff, setSwitchingOff] = useState(false);
  const [toggleError, setToggleError] = useState('');

  useEffect(() => {
    fetch('/api/admin/auth', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => onDeveloperModeChange(data.authenticated === true))
      .catch(() => undefined);
  }, [onDeveloperModeChange]);

  const unlock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        setError(response.status === 401 ? 'Incorrect password.' : 'Unable to unlock developer mode.');
        return;
      }
      onDeveloperModeChange(true);
      setToggleError('');
      setPassword('');
      setUnlockOpen(false);
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDeveloperMode = async () => {
    if (!developerMode) {
      setPassword('');
      setError('');
      setUnlockOpen(true);
      return;
    }
    setSwitchingOff(true);
    setToggleError('');
    try {
      const response = await fetch('/api/admin/auth', { method: 'DELETE' });
      if (!response.ok) throw new Error('Logout failed');
      onDeveloperModeChange(false);
    } catch {
      setToggleError('Could not turn off developer mode. Please try again.');
    } finally {
      setSwitchingOff(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void onSelect(file);
    e.currentTarget.value = '';
  };

  return (
    <>
    <section className="glass-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-white">
          <Camera className="h-4 w-4 text-blue-400" /> Receipt Scanner
        </h2>
        <button type="button" role="switch" aria-checked={developerMode} aria-label="Developer mode" onClick={() => void toggleDeveloperMode()} disabled={switchingOff || scanning} className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-slate-300 hover:bg-white/10 disabled:opacity-60">
          <Code2 size={16} />
          <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${developerMode ? 'bg-blue-600' : 'bg-slate-600'}`}>
            <span className={`absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${developerMode ? 'translate-x-4' : 'translate-x-0'}`} />
          </span>
        </button>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-slate-300">Capture your receipt and we will find the items for you.</p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={scanning}
        onChange={handleInputChange}
      />

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          aria-label="Take a receipt photo"
          onClick={onOpenCamera}
          disabled={scanning}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 py-3.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Camera size={18} />
          Take Photo
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={scanning}
          className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-3.5 text-sm font-medium text-white transition hover:bg-white/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload size={18} />
          Upload File
        </button>
      </div>

      <p className="mt-3 text-sm text-slate-300">Scanning sends the receipt photo to an AI provider. You can enter items manually instead.</p>
      {!developerMode && <p className="mt-1 text-sm text-slate-300">2 free successful scans per browser each day. Resets at midnight Malaysia time.</p>}

      {scanning && (
        <div role="status" className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-600/10 px-4 py-3 text-sm font-semibold text-blue-300">
          <Loader2 size={16} className="animate-spin" />
          Scanning Receipt
        </div>
      )}

      {scanError && (
        <p role="alert" className="mt-3 rounded-xl border border-rose-300/15 bg-rose-400/10 px-3 py-2 text-sm font-medium text-rose-100">
          {scanError}
        </p>
      )}
      {toggleError && <p role="alert" className="mt-3 text-sm text-rose-300">{toggleError}</p>}
    </section>
      {unlockOpen && (
        <Modal onClose={() => setUnlockOpen(false)} aria-labelledby="developer-unlock-title" onClick={() => setUnlockOpen(false)} className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/65 px-5 py-6 backdrop-blur-md">
          <div onClick={(event) => event.stopPropagation()} className="my-auto w-full max-w-sm rounded-3xl border border-white/15 bg-[#111217] p-6 shadow-2xl">
            <h2 id="developer-unlock-title" className="text-xl font-semibold text-white">Developer access</h2>
            <p className="mt-2 text-sm text-rose-300">Enter the admin password again to turn developer mode on and bypass the daily scan limit.</p>
            <form onSubmit={unlock} autoComplete="off" className="mt-4 space-y-4">
              <label className="block text-sm text-slate-300">Admin password
                <input type="password" required autoComplete="off" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-white" />
              </label>
              {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setUnlockOpen(false)} className="flex-1 rounded-xl border border-white/15 px-3 py-3 text-sm text-slate-200">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 rounded-xl bg-blue-600 px-3 py-3 text-sm font-semibold text-white disabled:opacity-60">{submitting ? 'Checking…' : 'Unlock'}</button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </>
  );
}
