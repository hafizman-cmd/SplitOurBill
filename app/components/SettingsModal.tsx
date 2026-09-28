'use client';

import { useEffect, useState } from 'react';
import { Loader2, Trash2, Upload, X } from 'lucide-react';
import { compressImage, readQrPayload, readQrPayloadFromFile } from '../lib/utils';

type Props = {
  open: boolean;
  initialBankDetails: string;
  initialQrCode: string;
  initialQrPayload: string;
  onClose: () => void;
  onSave: (bankDetails: string, qrCode: string, qrPayload: string) => void;
  onNotify: (message: string) => void;
};

export default function SettingsModal({
  open,
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

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const save = () => {
    onSave(settingsDraft.trim(), settingsQrDraft, settingsQrPayloadDraft);
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Payment settings"
    >
      <div
        className="glass-card w-full max-w-md p-6 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-white">
            Payment Details
          </h3>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-full p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mb-2 text-xs leading-relaxed text-slate-300">
          Saved on this device and included when you share the summary.
        </p>
        <textarea
          value={settingsDraft}
          onChange={(e) => setSettingsDraft(e.target.value)}
          rows={4}
          placeholder={'e.g.\nDuitNow: Maybank\n162112345678\nAlice Tan'}
          className="glass-input w-full resize-none rounded-xl px-4 py-3 text-sm outline-none transition"
        />

        <div className="mt-5">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-300">
            DuitNow / Bank QR Code
          </h4>
          <input
            id="qr-code-input"
            type="file"
            accept="image/*"
            className="hidden"
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
                    <p className="text-xs font-semibold text-slate-700">
                      DuitNow QR decoded
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Included in interactive links once saved.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-slate-700">
                      QR image ready
                    </p>
                    <p className="text-[11px] text-slate-400">
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
                className="flex shrink-0 items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-100 active:scale-95"
              >
                <Trash2 size={12} />
                Remove
              </button>
            </div>
          ) : (
            <label htmlFor="qr-code-input" className="block cursor-pointer">
              <div
                className={`flex items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-3.5 text-xs font-semibold transition ${
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
            </label>
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
            className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition hover:brightness-110 active:scale-[0.98]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
