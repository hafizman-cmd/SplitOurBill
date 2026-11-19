'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, CircleAlert, Lock, LogOut, RotateCw } from 'lucide-react';
import { KiraKiraLogo } from '../components/ui/logo';
import {
  ANALYTICS_RANGES, DEFAULT_ANALYTICS_RANGE,
  type AdminEvent, type AnalyticsData, type AnalyticsRange,
} from '../lib/adminAnalytics';
import { formatAuditTime, type AuditFilter } from '../lib/auditEvents';
import AdminEvents, { controlClass, panelClass } from './AdminEvents';
import AnalyticsOverview from './AnalyticsOverview';
import AuditLog from './AuditLog';

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/admin/auth', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Session check failed');
        const data: { authenticated?: boolean } = await response.json();
        if (!controller.signal.aborted) setAuthenticated(data.authenticated === true);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setAuthError('Could not check your admin session. You can try signing in.');
        setAuthenticated(false);
      });
    return () => controller.abort();
  }, []);

  const expireSession = useCallback(() => {
    setAuthError('Your admin session expired. Sign in again to continue.');
    setAuthenticated(false);
  }, []);

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (authBusy || !password) return;
    setAuthBusy(true);
    setAuthError('');
    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data: { error?: string } | null = await response.json().catch(() => null);
      if (!response.ok) {
        setAuthError(data?.error ?? 'Could not sign in. Please try again.');
        return;
      }
      setPassword('');
      setAuthenticated(true);
    } catch {
      setAuthError('Could not sign in. Please try again.');
    } finally {
      setAuthBusy(false);
    }
  };

  if (authenticated === null) {
    return <main className="grid min-h-screen place-items-center text-sm text-slate-300"><p role="status">Checking admin session…</p></main>;
  }

  if (!authenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-8 text-slate-100">
        <form onSubmit={submitPassword} className={`${panelClass} w-full max-w-sm p-6 sm:p-8`}>
          <Link href="/" className="inline-flex min-h-10 items-center gap-2 text-sm text-slate-300 hover:text-white"><ArrowLeft size={16} /> Back to app</Link>
          <div className="mt-4 flex items-center gap-3">
            <KiraKiraLogo className="h-9 w-9" />
            <h1 className="text-xl font-semibold tracking-tight text-white">Kira-Kira Analytics</h1>
          </div>
          <label className="mt-6 block text-sm font-medium text-slate-300">
            Admin passcode
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={`${controlClass} mt-2 w-full`} autoComplete="current-password" required />
          </label>
          {authError && <p role="alert" className="mt-3 text-sm text-rose-300">{authError}</p>}
          <button type="submit" disabled={authBusy || !password} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-sky-400 px-4 text-sm font-semibold text-slate-950 hover:bg-sky-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:opacity-50">
            <Lock size={16} /> {authBusy ? 'Signing in…' : 'Unlock dashboard'}
          </button>
        </form>
      </main>
    );
  }

  return <Dashboard onLogout={() => setAuthenticated(false)} onUnauthorized={expireSession} />;
}

function Dashboard({ onLogout, onUnauthorized }: { onLogout: () => void; onUnauthorized: () => void }) {
  const [range, setRange] = useState<AnalyticsRange>(DEFAULT_ANALYTICS_RANGE);
  const [view, setView] = useState<'overview' | 'events'>('overview');
  const [filter, setFilter] = useState<AuditFilter>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  const logout = async () => {
    if (logoutBusy) return;
    setLogoutBusy(true);
    setLogoutError('');
    try {
      const response = await fetch('/api/admin/auth', { method: 'DELETE' });
      if (!response.ok) throw new Error('Sign out failed');
      onLogout();
    } catch {
      setLogoutError('Could not sign out. Please try again.');
    } finally {
      setLogoutBusy(false);
    }
  };

  const refresh = () => setRefreshKey((value) => value + 1);
  const openEvents = (nextFilter: AuditFilter) => {
    setFilter(nextFilter);
    setView('events');
  };

  return (
    <main className="min-h-screen px-4 py-5 text-slate-100 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className={`${panelClass} p-4 sm:p-6`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/70 pb-3">
            <Link href="/" className={controlClass}><ArrowLeft size={16} /> Back to app</Link>
            <button type="button" onClick={() => void logout()} disabled={logoutBusy} className={controlClass}><LogOut size={16} /> {logoutBusy ? 'Signing out…' : 'Sign out'}</button>
          </div>
          {logoutError && <p role="alert" className="mt-3 text-sm text-rose-300">{logoutError}</p>}
          <div className="flex flex-wrap items-end justify-between gap-4 pt-4">
            <div className="flex items-center gap-3">
              <KiraKiraLogo className="h-10 w-10 shrink-0" />
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-white sm:text-3xl">Kira-Kira Analytics</h1>
                <p className="mt-1 text-sm text-slate-400">Usage and receipt scan health</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <CalendarDays size={17} aria-hidden="true" className="text-slate-400" /> Date range
                <select value={range} onChange={(event) => setRange(event.target.value as AnalyticsRange)} className={controlClass}>
                  {Object.entries(ANALYTICS_RANGES).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </select>
              </label>
              <button type="button" onClick={refresh} className={controlClass}><RotateCw size={16} aria-hidden="true" /> Refresh</button>
            </div>
          </div>
        </header>

        <nav aria-label="Admin views" className="grid grid-cols-2 gap-2 sm:flex">
          <button type="button" onClick={() => setView('overview')} aria-pressed={view === 'overview'} className={`${controlClass} aria-pressed:border-indigo-400 aria-pressed:bg-indigo-500/20 aria-pressed:text-indigo-100`}>Overview</button>
          <button type="button" onClick={() => setView('events')} aria-pressed={view === 'events'} className={`${controlClass} aria-pressed:border-indigo-400 aria-pressed:bg-indigo-500/20 aria-pressed:text-indigo-100`}>Events</button>
        </nav>

        {view === 'overview' ? (
          <AnalyticsSection key={range} range={range} refreshKey={refreshKey} onOpenEvents={openEvents} onUnauthorized={onUnauthorized} />
        ) : (
          <AuditLog range={range} filter={filter} onFilterChange={setFilter} refreshKey={refreshKey} onUnauthorized={onUnauthorized} />
        )}
      </div>
    </main>
  );
}

function AnalyticsSection({ range, refreshKey, onOpenEvents, onUnauthorized }: {
  range: AnalyticsRange; refreshKey: number; onOpenEvents: (filter: AuditFilter) => void; onUnauthorized: () => void;
}) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/analytics?range=${range}`, { cache: 'no-store', signal: controller.signal });
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          onUnauthorized();
          return;
        }
        if (!response.ok) {
          const payload: { error?: string } | null = await response.json().catch(() => null);
          throw new Error(payload?.error === 'Telemetry database is not configured.'
            ? payload.error : 'Could not refresh analytics.');
        }
        const snapshot: AnalyticsData = await response.json();
        if (controller.signal.aborted) return;
        setData(snapshot);
        setError('');
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error && cause.message === 'Telemetry database is not configured.'
            ? cause.message : 'Could not refresh analytics.');
        }
      } finally {
        inFlight = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [range, refreshKey, onUnauthorized]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-400">
          <span>Malaysia time (MYT)</span>
          {data && <span>· Last updated <time dateTime={data.updatedAt}>{formatAuditTime(data.updatedAt)}</time></span>}
        </div>
        {data && loading && <span className="text-sm text-slate-400">Refreshing…</span>}
      </div>
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-slate-900 px-4 py-3 text-sm text-rose-200">
          <CircleAlert size={17} className="mt-0.5 shrink-0" />
          {error} {data ? 'Showing the last successful update.' : 'Try refreshing to load the dashboard.'}
        </p>
      )}
      {data ? (
        <>
          <AnalyticsOverview data={data} range={range} onOpenEvents={onOpenEvents} />
          <RecentActivity events={data.recentEvents.slice(0, 5)} onViewEvents={() => onOpenEvents('all')} />
        </>
      ) : loading && !error && (
        <p role="status" className={`${panelClass} p-6 text-sm text-slate-300`}>Loading analytics…</p>
      )}
    </>
  );
}

function RecentActivity({ events, onViewEvents }: { events: AdminEvent[]; onViewEvents: () => void }) {
  return (
    <section aria-labelledby="recent-heading" className={`${panelClass} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/70 px-4 py-4 sm:px-5">
        <h2 id="recent-heading" className="text-base font-semibold text-white">Recent activity</h2>
        <button type="button" className={controlClass} onClick={onViewEvents}>View all events</button>
      </div>
      {events.length > 0
        ? <AdminEvents events={events} />
        : <p className="px-4 py-8 text-center text-sm text-slate-400">No activity recorded for this range.</p>}
    </section>
  );
}
