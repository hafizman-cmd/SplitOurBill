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
      className="sheet-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Payment QR code"
    >
      <div
        className="glass-card sheet-panel w-full max-w-sm p-6 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div aria-hidden="true" className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/30 sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Scan to Pay</h3>
          <button
            onClick={onClose}
            aria-label="Close QR code view"
            className="flex h-11 w-11 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mx-auto flex w-fit max-w-full justify-center rounded-2xl bg-white p-3">
          <img
            src={qrCode}
            alt="DuitNow / bank payment QR code"
            className="w-full max-w-[280px] rounded-lg"
          />
        </div>
        {bankDetails && (
          <p className="mt-3 whitespace-pre-wrap text-center text-xs font-medium text-slate-300">
            {bankDetails}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <a
            href={qrCode}
            download="kira-kira-payment-qr.jpg"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition hover:brightness-110 active:scale-[0.98]"
          >
            <Download size={16} />
            Download
          </a>
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/15 bg-white/10 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/15"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
