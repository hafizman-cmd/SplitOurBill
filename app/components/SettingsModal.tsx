'use client';

import Modal from './Modal';
import DeveloperSettings from './DeveloperSettings';

import { useEffect, useState } from 'react';
import { Download, Loader2, Trash2, Upload, X } from 'lucide-react';
import { compressImage, readQrPayload, readQrPayloadFromFile } from '../lib/utils';

type InstallPromptEvent = Event & {
  prompt: () => Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type Props = {
  open: boolean;
  developerMode: boolean;
  scanning: boolean;
  onDeveloperModeChange: (enabled: boolean) => void;
  initialBankDetails: string;
  initialQrCode: string;
  initialQrPayload: string;
  onClose: () => void;
  onSave: (bankDetails: string, qrCode: string, qrPayload: string) => void;
  onNotify: (message: string) => void;
};

export default function SettingsModal({
  open,
  developerMode,
  scanning,
  onDeveloperModeChange,
  initialBankDetails,
  initialQrCode,
  initialQrPayload,
  onClose,
  onSave,
  onNotify,
}: Props) {
  const [settingsDraft, setSettingsDraft] = useState('');
  const [settingsQrDraft, setSettingsQrDraft] = useState('');
  const [settingsQrPayloadDraft, setSettingsQrPayloadDraft] = useState('');
  const [qrProcessing, setQrProcessing] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showInstallInstructions, setShowInstallInstructions] = useState(false);

  useEffect(() => {
    setInstalled(window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      document.referrer.startsWith('android-app://'));
    setIsIOS(/iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setSettingsDraft(initialBankDetails);
      setSettingsQrDraft(initialQrCode);
      setSettingsQrPayloadDraft(initialQrPayload);
      if (initialQrCode && !initialQrPayload) {
        void readQrPayload(initialQrCode).then((payload) => {
          if (payload) setSettingsQrPayloadDraft(payload);
        });
      }
    }
  }, [open, initialBankDetails, initialQrCode, initialQrPayload]);

  const save = () => {
    onSave(settingsDraft.trim(), settingsQrDraft, settingsQrPayloadDraft);
  };

  const installApp = async () => {
    if (installPrompt) {
      setInstallPrompt(null);
      try {
        const choice = await installPrompt.prompt();
        if (choice.outcome === 'accepted') {
          setInstalled(true);
          return;
        }
      } catch {
        setShowInstallInstructions(true);
        return;
      }
    }
    setShowInstallInstructions(true);
  };

  const handleQrSelected = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      onNotify('Please select an image file for the QR code.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onNotify('QR image is too large. Please use a smaller image.');
      return;
    }

    setQrProcessing(true);
    try {
      const [dataUrl, filePayload] = await Promise.all([
        compressImage(file),
        readQrPayloadFromFile(file),
      ]);
      const payload = filePayload ?? (await readQrPayload(dataUrl));
      setSettingsQrDraft(dataUrl);
      setSettingsQrPayloadDraft(payload ?? '');
      onNotify(
        payload
          ? 'DuitNow QR decoded — tap Save to keep it'
          : 'QR image ready — no payment QR detected',
      );
    } catch {
      onNotify('Could not process the QR image.');
    } finally {
      setQrProcessing(false);
    }
  };

  return open ? (
    <Modal onClose={onClose}
      className="sheet-overlay"
      onClick={onClose}
      aria-label="Settings"
    >
      <div
        className="glass-card sheet-panel w-full max-w-md p-6 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div aria-hidden="true" className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/30 sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">
            Settings
          </h3>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="flex h-11 w-11 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        <h4 className="mb-1 text-sm font-semibold text-white">Payment details</h4>
        <p className="mb-2 text-sm leading-relaxed text-slate-300">
          Saved on this device and included when you share the summary.
        </p>
        <textarea
          aria-label="Bank and DuitNow payment details"
          value={settingsDraft}
          onChange={(e) => setSettingsDraft(e.target.value)}
          rows={4}
          placeholder={'e.g.\nDuitNow: Maybank\n162112345678\nAlice Tan'}
          className="glass-input w-full resize-none rounded-xl px-4 py-3 text-base outline-none transition"
        />

        <div className="mt-5">
          <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-300">
            DuitNow / Bank QR Code
          </h4>
          <input
            id="qr-code-input"
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Upload payment QR code image"
            disabled={qrProcessing}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleQrSelected(file);
              e.currentTarget.value = '';
            }}
          />
          {settingsQrDraft ? (
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
              <img
                src={settingsQrDraft}
                alt="Payment QR code"
                className="h-16 w-16 shrink-0 rounded-lg object-contain ring-1 ring-slate-200"
              />
              <div className="min-w-0 flex-1">
                {settingsQrPayloadDraft ? (
                  <>
                    <p className="text-sm font-semibold text-slate-700">
                      DuitNow QR decoded
                    </p>
                    <p className="text-sm text-slate-600">
                      Included in interactive links once saved.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-slate-700">
                      QR image ready
                    </p>
                    <p className="text-sm text-slate-600">
                      No payment QR decoded — shown at the table only.
                    </p>
                  </>
                )}
              </div>
              <button
                onClick={() => {
                  setSettingsQrDraft('');
                  setSettingsQrPayloadDraft('');
                }}
                aria-label="Remove QR code"
                className="flex min-h-11 shrink-0 items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 active:scale-95"
              >
                <Trash2 size={12} />
                Remove
              </button>
            </div>
          ) : (
            <button type="button" disabled={qrProcessing} onClick={() => document.getElementById('qr-code-input')?.click()} className="block w-full rounded-xl disabled:opacity-60">
              <div
                className={`flex items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-3.5 text-sm font-semibold transition ${
                  qrProcessing
                    ? 'border-blue-500/40 bg-blue-600/20 text-blue-400'
                    : 'border-blue-500/30 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20'
                }`}
              >
                {qrProcessing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Processing image...
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    Upload QR Code Image
                  </>
                )}
              </div>
            </button>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/15 bg-white/10 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/15"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={qrProcessing}
            className="flex-1 rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition hover:brightness-110 active:scale-[0.98]"
          >
            Save
          </button>
        </div>
        {(!installed || !isIOS) && (
          <details className="mt-4 border-t border-white/10 pt-2">
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Install Kira-Kira</summary>
            <div className="flex flex-wrap gap-2 text-sm">
              {!installed && <button type="button" onClick={() => void installApp()} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 font-semibold text-blue-200 hover:bg-white/10">
                <Download size={16} />Install app
              </button>}
              {!isIOS && <a href="/kira-kira.apk" download="Kira-Kira.apk" className="inline-flex min-h-11 items-center rounded-lg px-2 font-semibold text-blue-200 hover:bg-white/10">Download Android APK</a>}
            </div>
            {showInstallInstructions && !installed && <p role="status" className="mt-2 text-sm text-slate-300">
              {isIOS ? 'In Safari, tap Share, then Add to Home Screen.' : 'Open your browser menu and choose Install app or Add to Home Screen.'}
            </p>}
          </details>
        )}
        <DeveloperSettings developerMode={developerMode} scanning={scanning} onDeveloperModeChange={onDeveloperModeChange} />
      </div>
    </Modal>
  ) : null;
}
