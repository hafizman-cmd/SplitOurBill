'use client';

type Props = {
  serviceChargeInput: string;
  taxInput: string;
  onServiceChargeChange: (value: string) => void;
  onTaxChange: (value: string) => void;
};

export default function ChargesSection({
  serviceChargeInput,
  taxInput,
  onServiceChargeChange,
  onTaxChange,
}: Props) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
        Charges
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">
            Service Charge %
          </label>
          <input
            value={serviceChargeInput}
            onChange={(e) => onServiceChargeChange(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">
            Tax %
          </label>
          <input
            value={taxInput}
            onChange={(e) => onTaxChange(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </div>
    </section>
  );
}
