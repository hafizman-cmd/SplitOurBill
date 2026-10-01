import Link from 'next/link';
import { BarChart3, History, Settings, Sparkles } from 'lucide-react';
import { KiraKiraLogo } from './ui/logo';

export default function Header({
  onOpenSettings,
  onOpenHistory,
  scansRemaining,
}: {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  scansRemaining: number | null;
}) {
  return (
    <header className="glass-nav sticky top-4 z-50 mx-4 my-3 flex w-auto items-center justify-between gap-2 rounded-full border border-white/15 bg-slate-900/80 p-2.5 text-white backdrop-blur-xl sm:p-3">
      <div className="flex min-w-0 items-center gap-2">
        <KiraKiraLogo className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-sm font-bold tracking-tight text-white sm:text-base">Kira-Kira</h1>
          <span className="hidden text-[10px] font-medium uppercase tracking-wider text-slate-400 md:inline-block">
            SPLIT BILLS FAIRLY
          </span>
        </div>
        {scansRemaining !== null && (
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-1 text-[10px] font-semibold text-blue-400">
            <Sparkles className="h-3 w-3 shrink-0 text-cyan-400" />
            <span>{scansRemaining} LEFT</span>
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        <Link
          href="/admin"
          aria-label="Open analytics admin"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 sm:h-9 sm:w-9"
        >
          <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Link>
        <button
          onClick={onOpenHistory}
          aria-label="Open receipt history"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 sm:h-9 sm:w-9"
        >
          <History className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </button>
        <button
          onClick={onOpenSettings}
          aria-label="Open settings"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 sm:h-9 sm:w-9"
        >
          <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </button>
      </div>
    </header>
  );
}
