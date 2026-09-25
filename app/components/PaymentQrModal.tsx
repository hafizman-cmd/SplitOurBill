'use client';

import { useEffect } from 'react';
import { Download, X } from 'lucide-react';

type Props = {
  open: boolean;
  qrCode: string;
  bankDetails: string;
  onClose: () => void;
};

export default function PaymentQrModal({
  open,
  qrCode,
  bankDetails,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !qrCode) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Payment QR code"
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">Scan to Pay</h3>
          <button
            onClick={onClose}
            aria-label="Close QR code view"
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex justify-center">
          <img
            src={qrCode}
            alt="DuitNow / bank payment QR code"
            className="w-full max-w-[280px] rounded-2xl ring-1 ring-slate-200"
          />
        </div>
        {bankDetails && (
          <p className="mt-3 whitespace-pre-wrap text-center text-xs font-medium text-slate-500">
            {bankDetails}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <a
            href={qrCode}
            download="kira-kira-payment-qr.jpg"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
          >
            <Download size={16} />
            Download
          </a>
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
