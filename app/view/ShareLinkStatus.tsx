import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

const messages = {
  expired: ['This bill link has expired', 'Share links last 3 days. Ask your host for a new link.'],
  missing: ['This bill link can’t be opened', 'Ask your host to share a new link.'],
  unavailable: ['The bill is temporarily unavailable', 'Try opening the link again in a moment.'],
};

export default function ShareLinkStatus({ status }: { status: keyof typeof messages }) {
  const [title, description] = messages[status];
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-card w-full max-w-sm p-6 text-center">
        <h1 className="text-base font-bold text-white">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">{description}</p>
        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition hover:brightness-110 active:scale-95"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Go to Kira-Kira
        </Link>
      </div>
    </main>
  );
}
