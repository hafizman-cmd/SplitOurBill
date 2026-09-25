'use client';

import { useRef } from 'react';
import { Camera, Loader2, Receipt } from 'lucide-react';

type Props = {
  scanning: boolean;
  scanError: string | null;
  onSelect: (file: File) => void | Promise<void>;
};

export default function ReceiptScanner({ scanning, scanError, onSelect }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="overflow-hidden rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
      <div className="mb-3 flex items-center gap-2">
        <Camera size={16} className="text-indigo-600" />
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          AI Receipt Scanner
        </h2>
      </div>
      <label className="block cursor-pointer">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={scanning}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onSelect(file);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
        />
        <div
          className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
            scanning
              ? 'border-indigo-400 bg-indigo-50'
              : 'border-indigo-300 bg-indigo-50/60 hover:bg-indigo-100/70'
          }`}
        >
          {scanning ? (
            <>
              <Loader2
                size={28}
                className="mb-2 animate-spin text-indigo-600"
              />
              <p className="text-sm font-semibold text-indigo-700">
                Scanning receipt...
              </p>
              <p className="mt-1 text-xs text-indigo-400">
                AI is reading your items
              </p>
            </>
          ) : (
            <>
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md shadow-indigo-200">
                <Receipt size={22} />
              </div>
              <p className="text-sm font-semibold text-slate-700">
                Tap to upload a receipt photo
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Items, service charge &amp; tax are detected automatically
              </p>
            </>
          )}
        </div>
      </label>
      {scanError && (
        <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
          {scanError}
        </p>
      )}
    </section>
  );
}
