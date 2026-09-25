'use client';

import { useEffect, useState } from 'react';
import { Loader2, Trash2, Upload, X } from 'lucide-react';
import { compressImage } from '../lib/utils';

type Props = {
  open: boolean;
  initialBankDetails: string;
  initialQrCode: string;
  onClose: () => void;
  onSave: (bankDetails: string, qrCode: string) => void;
  onNotify: (message: string) => void;
};

export default function SettingsModal({
  open,
  initialBankDetails,
  initialQrCode,
  onClose,
  onSave,
  onNotify,
}: Props) {
  const [settingsDraft, setSettingsDraft] = useState('');
  const [settingsQrDraft, setSettingsQrDraft] = useState('');
  const [qrProcessing, setQrProcessing] = useState(false);

  useEffect(() => {
    if (open) {
      setSettingsDraft(initialBankDetails);
      setSettingsQrDraft(initialQrCode);
    }
  }, [open, initialBankDetails, initialQrCode]);

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
    onSave(settingsDraft.trim(), settingsQrDraft);
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
      const dataUrl = await compressImage(file);
      setSettingsQrDraft(dataUrl);
      onNotify('QR code ready — tap Save to keep it');
    } catch {
      onNotify('Could not process the QR image.');
    } finally {
      setQrProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Payment settings"
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">
            Payment Details
          </h3>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mb-2 text-xs text-slate-500">
          Saved on this device and included when you share the summary.
        </p>
        <textarea
          value={settingsDraft}
          onChange={(e) => setSettingsDraft(e.target.value)}
          rows={4}
          placeholder={'e.g.\nDuitNow: Maybank\n162112345678\nAlice Tan'}
          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
        />

        <div className="mt-5">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
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
                <p className="text-xs font-semibold text-slate-700">
                  QR code ready
                </p>
                <p className="text-[11px] text-slate-400">
                  Shown at the table when paying.
                </p>
              </div>
              <button
                onClick={() => setSettingsQrDraft('')}
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
                    ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                    : 'border-indigo-300 bg-indigo-50/60 text-indigo-600 hover:bg-indigo-100/70'
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
            className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
