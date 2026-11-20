'use client';

import { useRef } from 'react';
import { ArrowRight, Camera, Loader2, Upload } from 'lucide-react';

type Props = {
  scanning: boolean;
  scanError: string | null;
  onSelect: (file: File) => void | Promise<void>;
  onOpenCamera: () => void;
  onEnterManually: () => void;
};

export default function ReceiptScanner({
  scanning,
  scanError,
  onSelect,
  onOpenCamera,
  onEnterManually,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void onSelect(file);
    e.currentTarget.value = '';
  };

  return (
    <section className="bill-panel p-5">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold tracking-tight text-white">
        <Camera className="h-4 w-4 text-blue-400" /> Receipt Scanner
      </h2>
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
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-2 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Camera size={18} />
          Take Photo
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={scanning}
          className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-2 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload size={18} />
          Upload File
        </button>
      </div>

      <button
        type="button"
        onClick={onEnterManually}
        className="mx-auto mt-2 flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold text-blue-200 transition hover:bg-white/5"
      >
        Enter items manually <ArrowRight aria-hidden="true" size={16} />
      </button>
      <p className="mt-2 text-sm text-slate-300">Scanning sends your receipt photo to an AI provider.</p>

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
    </section>
  );
}
