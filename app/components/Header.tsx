import Link from 'next/link';
import { BarChart3, History, Settings } from 'lucide-react';
import { KiraKiraLogo } from './ui/logo';

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
        <KiraKiraLogo className="h-10 w-10" />
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-white">Kira-Kira</h1>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">SPLIT BILLS FAIRLY</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Link
          href="/admin"
          aria-label="Open analytics admin"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10 active:scale-95"
        >
          <BarChart3 className="w-4 h-4 text-slate-300 hover:text-white" />
        </Link>
        <button
          onClick={onOpenHistory}
          aria-label="Open receipt history"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:text-white active:scale-95"
        >
          <History className="w-4 h-4" />
        </button>
        <button
          onClick={onOpenSettings}
          aria-label="Open settings"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:text-white active:scale-95"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
