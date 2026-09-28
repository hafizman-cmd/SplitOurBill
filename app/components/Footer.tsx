import { ShieldCheck } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="mx-auto mt-8 max-w-sm px-6 pb-28 text-center">
      <p className="text-[11px] font-normal leading-relaxed text-slate-400 dark:text-slate-500">
        <ShieldCheck className="-mt-0.5 mr-1 inline-block w-3.5 h-3.5 text-slate-400 opacity-75" />
        Kira-Kira is a bill calculation tool and does not process payments
        directly. All fund transfers are executed securely within your
        bank&apos;s official application.
      </p>
    </footer>
  );
}
