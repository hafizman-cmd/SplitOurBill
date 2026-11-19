'use client';

import { useEffect, useRef, useState } from 'react';
import { ADMIN_EVENT_PAGE_SIZE, type AdminEvent, type AnalyticsRange } from '../lib/adminAnalytics';
import { AUDIT_FILTERS, AUDIT_MESSAGES, type AuditFilter } from '../lib/auditEvents';
import AdminEvents, { controlClass, panelClass } from './AdminEvents';

type AuditEvent = AdminEvent & { sessionId: string; code: string };
type AuditPage = { events: AuditEvent[]; nextCursor: string | null; configured: boolean };

type AuditLogProps = {
  range: AnalyticsRange;
  onUnauthorized: () => void;
  refreshKey: number;
};

export default function AuditLog({ range, onUnauthorized, refreshKey, filter, onFilterChange }: AuditLogProps & {
  filter: AuditFilter;
  onFilterChange: (filter: AuditFilter) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <section aria-labelledby="audit-log-heading" className={`${panelClass} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/70 px-4 py-4 sm:px-5">
        <div>
          <h2 id="audit-log-heading" tabIndex={-1} ref={heading} className="scroll-mt-6 text-base font-semibold text-white">Audit log</h2>
          <p className="mt-1 text-sm text-slate-400">Filter events to investigate what happened.</p>
        </div>
        <label className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
          Event type
          <select value={filter} onChange={(event) => onFilterChange(event.target.value as AuditFilter)} className={controlClass}>
            {Object.entries(AUDIT_FILTERS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <AuditResults
        key={`${range}:${filter}`}
        range={range}
        filter={filter}
        refreshKey={refreshKey}
        onUnauthorized={onUnauthorized}
        onCollapse={() => heading.current?.focus()}
      />
    </section>
  );
}

function AuditResults({
  range, filter, refreshKey, onUnauthorized, onCollapse,
}: AuditLogProps & { filter: AuditFilter; onCollapse: () => void }) {
  const [page, setPage] = useState<AuditPage | null>(null);
  const [firstCursor, setFirstCursor] = useState<string | null>(null);
  const [pending, setPending] = useState<'initial' | 'more' | null>('initial');
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const request = useRef<AbortController | null>(null);
  const query = `/api/admin/audit?range=${range}&filter=${filter}`;

  useEffect(() => {
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    setPending('initial');
    setError('');

    void loadPage(query, controller.signal, onUnauthorized)
      .then((data) => {
        if (!data || controller.signal.aborted) return;
        setPage(data);
        setFirstCursor(data.nextCursor);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('Could not refresh the audit log.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setPending(null);
      });

    return () => request.current?.abort();
  }, [query, refreshKey, retryKey, onUnauthorized]);

  const showMore = async () => {
    if (!page?.nextCursor || pending) return;
    const controller = new AbortController();
    request.current = controller;
    setPending('more');
    setError('');
    try {
      const data = await loadPage(`${query}&cursor=${encodeURIComponent(page.nextCursor)}`, controller.signal, onUnauthorized);
      if (!data || controller.signal.aborted) return;
      if (!data.configured) {
        setError('Telemetry database is not configured.');
        return;
      }
      setPage({ ...data, events: [...page.events, ...data.events] });
    } catch {
      if (!controller.signal.aborted) setError('Could not load more events. Try Show more again.');
    } finally {
      if (!controller.signal.aborted) setPending(null);
    }
  };

  const showLess = () => {
    if (!page) return;
    setPage({ ...page, events: page.events.slice(0, ADMIN_EVENT_PAGE_SIZE), nextCursor: firstCursor });
    setError('');
    onCollapse();
  };

  const events = page?.events ?? [];
  let emptyMessage = 'No events match this range and filter.';
  if (pending) emptyMessage = 'Loading audit events…';
  else if (error) emptyMessage = '';
  else if (page?.configured === false) emptyMessage = 'Telemetry database is not configured.';

  return (
    <>
      <div aria-busy={pending !== null}>
        {events.length > 0
          ? <AdminEvents audit events={events.map((event) => ({ ...event, message: AUDIT_MESSAGES[event.code] }))} />
          : emptyMessage && <p className="px-4 py-8 text-center text-sm text-slate-400" role="status">{emptyMessage}</p>}
      </div>
      {pending === 'initial' && events.length > 0 && <p role="status" className="px-4 py-3 text-sm text-slate-400 sm:px-5">Refreshing events…</p>}
      {error && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 px-4 py-3 sm:px-5">
          <p role="alert" className="text-sm text-rose-300">{error} {error === 'Could not refresh the audit log.' && events.length > 0 && 'Showing the last successful update.'}</p>
          {error === 'Could not refresh the audit log.' && (
            <button type="button" className={controlClass} onClick={() => setRetryKey((value) => value + 1)}>Retry audit log</button>
          )}
        </div>
      )}
      {page?.configured && events.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-700/70 px-4 py-3 sm:px-5">
          <p className="text-xs text-slate-400" aria-live="polite">{events.length} {events.length === 1 ? 'event' : 'events'} shown</p>
          <div className="flex flex-wrap gap-2">
            {events.length > ADMIN_EVENT_PAGE_SIZE && <button type="button" className={controlClass} disabled={pending !== null} onClick={showLess}>Show less</button>}
            {page.nextCursor && <button type="button" className={controlClass} disabled={pending !== null} onClick={() => void showMore()}>{pending === 'more' ? 'Loading…' : 'Show more'}</button>}
          </div>
        </div>
      )}
    </>
  );
}

async function loadPage(url: string, signal: AbortSignal, onUnauthorized: () => void): Promise<AuditPage | null> {
  const response = await fetch(url, { cache: 'no-store', signal });
  if (signal.aborted) return null;
  if (response.status === 401) {
    onUnauthorized();
    return null;
  }
  if (!response.ok) throw new Error('Audit events unavailable');
  return response.json() as Promise<AuditPage>;
}
