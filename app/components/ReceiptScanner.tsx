'use client';

import { useRef } from 'react';
import { Camera, Loader2, Upload } from 'lucide-react';

type Props = {
  scanning: boolean;
  scanError: string | null;
  onSelect: (file: File) => void | Promise<void>;
  onOpenCamera: () => void;
};

export default function ReceiptScanner({
  scanning,
  scanError,
  onSelect,
  onOpenCamera,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void onSelect(file);
    e.currentTarget.value = '';
  };

  return (
    <section className="glass-card p-5">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <Camera className="h-4 w-4 text-blue-400" />
          Receipt Scanner
      </h2>

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
          onClick={onOpenCamera}
          disabled={scanning}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-3.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Camera size={18} />
          Take Photo
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={scanning}
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-blue-500/30 bg-white/5 py-3.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload size={18} />
          Upload File
        </button>
      </div>

      {scanning && (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-600/10 px-4 py-3 text-sm font-semibold text-blue-300">
          <Loader2 size={16} className="animate-spin" />
          Scanning Receipt
        </div>
      )}

      {scanError && (
        <p className="mt-3 rounded-xl border border-rose-300/15 bg-rose-400/10 px-3 py-2 text-xs font-medium text-rose-100">
          {scanError}
        </p>
      )}
    </section>
  );
}
