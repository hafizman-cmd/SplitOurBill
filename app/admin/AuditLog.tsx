'use client';

import { useEffect, useRef, useState } from 'react';
import { ClipboardList, RotateCw } from 'lucide-react';
import { AUDIT_FILTERS, AUDIT_MESSAGES, auditCode, formatAuditTime, type AuditFilter } from '../lib/auditEvents';

type AuditEvent = {
  id: string;
  eventName: string;
  sessionId: string;
  osName: string;
  deviceType: string;
  deviceVendor: string;
  metadata: string;
  createdAt: string;
};

export default function AuditLog({ onUnauthorized, refreshKey }: { onUnauthorized: () => void; refreshKey: number }) {
  const [filter, setFilter] = useState<AuditFilter>('all');
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    activeRequest.current?.abort();
    activeRequest.current = controller;
    setLoading(true);
    setError('');
    setEvents([]);
    setCursor(null);
    void fetch(`/api/admin/audit?filter=${filter}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (response.status === 401) { onUnauthorized(); return; }
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (controller.signal.aborted) return;
        setEvents(data.events);
        setCursor(data.nextCursor);
        setConfigured(data.configured);
      })
      .catch(() => { if (!controller.signal.aborted) setError('Could not load audit events. Please refresh to try again.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); activeRequest.current?.abort(); };
  }, [filter, refresh, refreshKey, onUnauthorized]);

  const showMore = async () => {
    if (!cursor || loading) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/audit?filter=${filter}&cursor=${encodeURIComponent(cursor)}`, { cache: 'no-store', signal: controller.signal });
      if (response.status === 401) { onUnauthorized(); return; }
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (controller.signal.aborted) return;
      setEvents(previous => [...previous, ...data.events]);
      setCursor(data.nextCursor);
    } catch {
      if (!controller.signal.aborted) setError('Could not load more events. Please try again.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  return (
    <section aria-labelledby="audit-log-heading" className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 shadow-xl shadow-black/40 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
        <div>
          <h2 id="audit-log-heading" className="flex items-center gap-2 text-sm font-bold text-white"><ClipboardList size={16} className="text-blue-400" />Audit Log</h2>
          <p className="mt-1 text-[11px] text-slate-400">All users · Anonymous sessions · Malaysia time (MYT, UTC+8)</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400" htmlFor="audit-filter">Filter</label>
          <select id="audit-filter" value={filter} onChange={event => setFilter(event.target.value as AuditFilter)} className="max-w-[190px] rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-slate-200">
            {Object.entries(AUDIT_FILTERS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button type="button" aria-label="Refresh audit log" onClick={() => setRefresh(value => value + 1)} className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 hover:bg-white/10"><RotateCw size={16} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>
      <div className="overflow-x-auto" aria-busy={loading}>
        <table className="w-full min-w-[660px] text-left text-xs">
          <thead className="bg-white/[0.03] text-slate-400"><tr><th className="px-4 py-3 font-semibold">Date &amp; time (MYT)</th><th className="px-4 py-3 font-semibold">Event / message</th><th className="px-4 py-3 font-semibold">From</th><th className="px-4 py-3 font-semibold">Device</th></tr></thead>
          <tbody className="divide-y divide-white/5 text-slate-300">
            {events.map(event => {
              const failed = event.eventName === 'scan_failed' || event.eventName === 'scan_client_error';
              const success = event.eventName === 'scan_completed';
              const message = AUDIT_MESSAGES[auditCode(event.metadata)] ?? (success ? 'Receipt scanned successfully' : failed ? 'Scan failed' : event.eventName.replace(/_/g, ' '));
              return <tr key={event.id}>
                <td className="whitespace-nowrap px-4 py-3.5 font-mono text-slate-400">{formatAuditTime(event.createdAt)}</td>
                <td className="px-4 py-3.5"><span className={`mb-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${failed ? 'border-rose-400/30 bg-rose-500/10 text-rose-200' : success ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-blue-400/30 bg-blue-500/10 text-blue-200'}`}>{failed ? 'Error' : success ? 'Success' : 'Activity'}</span><p>{message}</p></td>
                <td className="px-4 py-3.5 font-mono" title={event.sessionId}>{event.sessionId && event.sessionId !== 'anonymous' ? `Session ${event.sessionId.slice(0, 8)}` : 'Anonymous'}</td>
                <td className="px-4 py-3.5"><p className="capitalize">{event.deviceType || 'Unknown'}</p><p className="mt-1 text-slate-400">{event.osName} · {event.deviceVendor || 'Unknown'}</p></td>
              </tr>;
            })}
            {!events.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">{loading ? 'Loading audit events…' : error ? 'Audit log unavailable.' : !configured ? 'Telemetry database is not configured.' : 'No events match this filter.'}</td></tr>}
          </tbody>
        </table>
      </div>
      {error && <p role="alert" className="px-4 py-3 text-xs text-rose-300">{error}</p>}
      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
        <p className="text-[11px] text-slate-400">{events.length} events shown · New scan failures are recorded from this update onward.</p>
        {cursor && <button type="button" disabled={loading} onClick={() => void showMore()} className="shrink-0 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-50">{loading ? 'Loading…' : 'Show more'}</button>}
      </div>
    </section>
  );
}
