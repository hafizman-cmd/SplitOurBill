import { Receipt, Settings } from 'lucide-react';

export default function Header({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <header className="sticky top-3 z-50 mx-4 my-2 flex items-center justify-between rounded-2xl border border-white/10 bg-gradient-to-r from-indigo-600/90 to-violet-600/90 px-5 py-4 text-white shadow-lg backdrop-blur-md">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-indigo-100">
          <Receipt size={18} />
        </div>
        <div>
          <h1 className="text-lg font-bold leading-tight">Kira-Kira</h1>
          <p className="text-[11px] font-medium text-indigo-200">
            Split bills fairly
          </p>
        </div>
      </div>
      <button
        onClick={onOpenSettings}
        aria-label="Open settings"
        className="rounded-full p-2 transition-colors hover:bg-white/15 active:bg-white/25"
      >
        <Settings size={20} />
      </button>
    </header>
  );
}
