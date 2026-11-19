'use client';

import { useState } from 'react';
import Modal from './Modal';

type Props = {
  developerMode: boolean;
  scanning: boolean;
  onDeveloperModeChange: (enabled: boolean) => void;
};

export default function DeveloperSettings({ developerMode, scanning, onDeveloperModeChange }: Props) {
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [switchingOff, setSwitchingOff] = useState(false);
  const [toggleError, setToggleError] = useState('');

  const closeUnlock = () => {
    if (!submitting) setUnlockOpen(false);
  };
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

  return (
    <>
      <details className="mt-5 border-t border-white/10 pt-2">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-slate-300">Developer options</summary>
        <button type="button" role="switch" aria-checked={developerMode} aria-label="Developer mode" onClick={() => void toggleDeveloperMode()} disabled={switchingOff || scanning} className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-slate-300 hover:bg-white/10 disabled:opacity-60">
          <span>Developer mode</span>
          <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${developerMode ? 'bg-blue-600' : 'bg-slate-600'}`}>
            <span className={`absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${developerMode ? 'translate-x-4' : 'translate-x-0'}`} />
          </span>
        </button>
        {toggleError && <p role="alert" className="mt-2 text-sm text-rose-300">{toggleError}</p>}
      </details>
      {unlockOpen && (
        <Modal onClose={closeUnlock} aria-labelledby="developer-unlock-title" onClick={closeUnlock} className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/65 px-5 py-6 backdrop-blur-md">
          <div onClick={(event) => event.stopPropagation()} className="my-auto w-full max-w-sm rounded-3xl border border-white/15 bg-[#111217] p-6 shadow-2xl">
            <h2 id="developer-unlock-title" className="text-xl font-semibold text-white">Developer access</h2>
            <p className="mt-2 text-sm text-rose-300">Enter the admin password again to turn developer mode on and bypass the daily scan limit.</p>
            <form onSubmit={unlock} autoComplete="off" className="mt-4 space-y-4">
              <label className="block text-sm text-slate-300">Admin password
                <input type="password" required autoComplete="off" data-autofocus value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-white" />
              </label>
              {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={closeUnlock} disabled={submitting} className="flex-1 rounded-xl border border-white/15 px-3 py-3 text-sm text-slate-200 disabled:opacity-60">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 rounded-xl bg-blue-600 px-3 py-3 text-sm font-semibold text-white disabled:opacity-60">{submitting ? 'Checking…' : 'Unlock'}</button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </>
  );
}
