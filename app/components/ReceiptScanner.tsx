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
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
      <div className="mb-3 flex items-center gap-2">
        <Camera size={16} className="text-indigo-600" />
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          AI Receipt Scanner
        </h2>
      </div>

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
          className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Camera size={18} />
          Take Photo
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={scanning}
          className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/60 py-3.5 text-sm font-bold text-indigo-600 transition hover:bg-indigo-100/70 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload size={18} />
          Upload File
        </button>
      </div>

      {scanning && (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700">
          <Loader2 size={16} className="animate-spin" />
          Scanning receipt — AI is reading your items
        </div>
      )}

      {scanError && (
        <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
          {scanError}
        </p>
      )}
    </section>
  );
}
