import { History, Settings, Sparkles } from 'lucide-react';
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
    <header className="glass-nav sticky top-[max(0.75rem,env(safe-area-inset-top))] z-50 mx-4 my-3 flex w-auto items-center justify-between gap-2 p-2.5 text-white sm:p-3">
      <div className="flex shrink-0 items-center gap-2">
        <div className="relative">
          <KiraKiraLogo className="h-8 w-8 shrink-0 sm:h-11 sm:w-11" />
          {scansRemaining !== null && (
            <span aria-label={`${scansRemaining} scans remaining`} className="absolute -right-1.5 -top-1.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold leading-none text-white sm:hidden">
              {scansRemaining}
            </span>
          )}
        </div>
        <h1 className="whitespace-nowrap text-sm font-bold tracking-tight text-white sm:text-base">Kira-Kira</h1>
        {scansRemaining !== null && (
          <span className="hidden shrink-0 items-center gap-1 rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-1 text-sm font-semibold text-blue-400 sm:flex">
            <Sparkles className="h-3 w-3 shrink-0 text-cyan-400" />
            <span>{scansRemaining} left</span>
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        <button
          onClick={onOpenHistory}
          aria-label="Open receipt history"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 sm:h-11 sm:w-11"
        >
          <History className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </button>
        <button
          onClick={onOpenSettings}
          aria-label="Open settings"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 sm:h-11 sm:w-11"
        >
          <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </button>
      </div>
    </header>
  );
}
