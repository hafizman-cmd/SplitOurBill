import { deviceLabel, type AdminEvent } from '../lib/adminAnalytics';
import { formatAuditTime } from '../lib/auditEvents';

export const panelClass = 'rounded-2xl border border-slate-700/70 bg-slate-900/85';
export const controlClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 disabled:opacity-50';

type DisplayEvent = AdminEvent & { message?: string; sessionId?: string };

function eventBadge(name: string) {
  switch (name) {
    case 'app_open':
      return { text: 'App open', style: 'bg-sky-400/10 text-sky-300' };
    case 'scan_completed':
      return { text: 'Scan success', style: 'bg-emerald-400/10 text-emerald-300' };
    case 'scan_failed':
      return { text: 'Scan failure', style: 'bg-rose-400/10 text-rose-300' };
    case 'scan_client_error':
      return { text: 'Client error', style: 'bg-rose-400/10 text-rose-300' };
    case 'share_summary':
      return { text: 'Summary shared', style: 'bg-violet-400/10 text-violet-300' };
    case 'share_summary_tapped':
      return { text: 'Share tapped', style: 'bg-violet-400/10 text-violet-300' };
    default:
      return { text: name.replace(/_/g, ' '), style: 'bg-slate-700/60 text-slate-200' };
  }
}

export default function AdminEvents({ events, audit = false }: { events: DisplayEvent[]; audit?: boolean }) {
  const columns = audit
    ? 'sm:grid-cols-[minmax(0,1.7fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]'
    : 'sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,1fr)]';

  return (
    <>
      <div aria-hidden="true" className={`hidden gap-4 border-b border-slate-700/70 bg-slate-950/40 px-5 py-2.5 text-xs font-medium text-slate-400 sm:grid ${columns}`}>
        <span>Event</span><span>Date and time (MYT)</span><span>Device</span>{audit && <span>Session</span>}
      </div>
      <ul className="space-y-2 px-3 py-3 sm:space-y-0 sm:divide-y sm:divide-slate-800 sm:p-0">
        {events.map((event) => {
          const badge = eventBadge(event.eventName);
          const knownSession = event.sessionId && event.sessionId !== 'anonymous';
          return (
            <li key={event.id} className={`grid gap-x-4 gap-y-2 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-3 text-sm sm:items-start sm:rounded-none sm:border-0 sm:bg-transparent sm:px-5 ${columns}`}>
              <div className="min-w-0">
                <span className={`inline-block max-w-full break-words rounded-md px-2 py-0.5 text-xs font-medium ${badge.style}`}>{badge.text}</span>
                {event.message && <p className="mt-1.5 text-xs leading-relaxed text-slate-200">{event.message}</p>}
              </div>
              <time dateTime={event.createdAt} className="text-xs tabular-nums text-slate-400 sm:pt-1">{formatAuditTime(event.createdAt)}</time>
              <p className="break-words text-xs text-slate-300 sm:pt-1">
                <span className="mr-1 text-slate-400 sm:sr-only">Device:</span>{deviceLabel(event.osName, event.deviceBrand)}
              </p>
              {audit && <p className="break-words text-xs text-slate-400 sm:pt-1" title={knownSession ? event.sessionId : undefined}>{knownSession ? `Session ${event.sessionId?.slice(0, 8)}` : 'Anonymous'}</p>}
            </li>
          );
        })}
      </ul>
    </>
  );
}
