import { History, Settings, ShieldCheck } from 'lucide-react';

export default function Header({
  onOpenSettings,
  onOpenHistory,
}: {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
}) {
  return (
    <header className="glass-nav sticky top-4 z-50 mx-4 my-3 flex items-center justify-between px-5 py-3 text-white">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-500/30 bg-blue-600/20 text-blue-400">
          <ShieldCheck size={21} strokeWidth={2.3} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-white">Kira-Kira</h1>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">SPLIT BILLS FAIRLY</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onOpenHistory}
          aria-label="Open receipt history"
          className="rounded-full border border-white/10 bg-white/5 p-2.5 text-slate-300 transition hover:text-white active:scale-95"
        >
          <History size={19} strokeWidth={2.2} />
        </button>
        <button
          onClick={onOpenSettings}
          aria-label="Open settings"
          className="rounded-full border border-white/10 bg-white/5 p-2.5 text-slate-300 transition hover:text-white active:scale-95"
        >
          <Settings size={19} strokeWidth={2.2} />
        </button>
      </div>
    </header>
  );
}
