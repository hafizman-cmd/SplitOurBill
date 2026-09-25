export default function Toast({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2.5 text-xs font-semibold text-white shadow-xl backdrop-blur-sm"
    >
      {message}
    </div>
  );
}
