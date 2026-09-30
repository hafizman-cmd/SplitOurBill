'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Lock,
  LogOut,
  RotateCw,
  Smartphone,
} from 'lucide-react';
import { KiraKiraLogo } from '../components/ui/logo';

type Distribution = { label: string; count: number };

type AnalyticsEvent = {
  id: string;
  eventName: string;
  osName: string;
  osVersion: string;
  deviceVendor: string;
  deviceType: string;
  createdAt: string;
};

type AnalyticsData = {
  visits: number;
  scans: number;
  mobilePercent: number;
  mobileVisits: number;
  totalVisits: number;
  iosPercent: number;
  androidPercent: number;
  osDistribution: Distribution[];
  brandDistribution: Distribution[];
  recentEvents: AnalyticsEvent[];
};

const EMPTY_ANALYTICS: AnalyticsData = {
  visits: 0,
  scans: 0,
  mobilePercent: 0,
  mobileVisits: 0,
  totalVisits: 0,
  iosPercent: 0,
  androidPercent: 0,
  osDistribution: [],
  brandDistribution: [],
  recentEvents: [],
};

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '--:--:--'
    : date.toLocaleTimeString('en-MY', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
}

function eventBadge(eventName: string): { label: string; className: string } {
  if (eventName === 'app_open') {
    return { label: 'App Visit', className: 'border-blue-400/30 bg-blue-600/20 text-blue-200' };
  }
  if (eventName === 'scan_completed') {
    return { label: 'Receipt Scan', className: 'border-emerald-400/30 bg-emerald-400/15 text-emerald-200' };
  }
  if (eventName === 'share_summary' || eventName === 'share_summary_tapped') {
    return { label: 'Summary Shared', className: 'border-cyan-400/30 bg-cyan-500/15 text-cyan-200' };
  }
  return { label: eventName.replace(/_/g, ' '), className: 'border-white/15 bg-white/5 text-slate-300' };
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [analytics, setAnalytics] = useState<AnalyticsData>(EMPTY_ANALYTICS);
  const [loading, setLoading] = useState(false);

  const refreshAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/analytics', { cache: 'no-store' });
      if (response.status === 401) {
        setAuthenticated(false);
        return;
      }
      const payload: unknown = await response.json().catch(() => null);
      if (response.ok && typeof payload === 'object' && payload !== null) {
        setAnalytics({ ...EMPTY_ANALYTICS, ...(payload as Partial<AnalyticsData>) });
      } else {
        setAnalytics(EMPTY_ANALYTICS);
      }
    } catch {
      setAnalytics(EMPTY_ANALYTICS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/admin/auth', { cache: 'no-store' });
        const payload: unknown = await response.json().catch(() => null);
        setAuthenticated(
          response.ok &&
            typeof payload === 'object' &&
            payload !== null &&
            (payload as { authenticated?: unknown }).authenticated === true,
        );
      } catch {
        setAuthenticated(false);
      }
    };
    void checkSession();
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    void refreshAnalytics();
    const timer = window.setInterval(() => void refreshAnalytics(), 30_000);
    return () => window.clearInterval(timer);
  }, [authenticated, refreshAnalytics]);

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError('');
    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          typeof payload === 'object' && payload !== null && 'error' in payload
            ? String(payload.error)
            : 'Authentication failed.',
        );
      }
      setPassword('');
      setAuthenticated(true);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Authentication failed.');
    }
  };

  const logout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' }).catch(() => undefined);
    setAnalytics(EMPTY_ANALYTICS);
    setAuthenticated(false);
  };

  if (authenticated !== true) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-slate-100">
        <form onSubmit={submitPassword} className="w-full max-w-sm rounded-2xl border-x border-white/10 border-b border-white/5 border-t border-white/20 bg-slate-900/50 p-7 shadow-xl shadow-black/40 backdrop-blur-xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-400/30 bg-blue-600/20 text-blue-300"><Lock className="w-5 h-5" /></div>
          <h1 className="mt-5 text-center text-xl font-bold tracking-tight text-white">Analytics Admin</h1>
          <p className="mt-2 text-center text-sm leading-relaxed text-slate-400">Enter the private passcode to view anonymous app telemetry.</p>
          <label className="mt-6 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Secret passcode
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="glass-input mt-2 w-full text-sm" autoComplete="current-password" autoFocus />
          </label>
          {authError && <p className="mt-3 text-xs font-medium text-rose-300">{authError}</p>}
          <button type="submit" disabled={authenticated === null} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/35 transition active:scale-95 disabled:opacity-60"><Lock className="w-4 h-4" />Unlock dashboard</button>
        </form>
      </main>
    );
  }

  return <Dashboard analytics={analytics} loading={loading} onRefresh={() => void refreshAnalytics()} onLogout={() => void logout()} />;
}

function Dashboard({ analytics, loading, onRefresh, onLogout }: { analytics: AnalyticsData; loading: boolean; onRefresh: () => void; onLogout: () => void }) {
  return (
    <main className="min-h-screen px-4 pb-4 pt-4 text-slate-100 sm:px-6 sm:pb-6 sm:pt-6">
      <div className="mx-auto max-w-5xl">
        <header className="sticky top-3 z-40 mx-2 mb-6 flex items-center justify-between gap-2 rounded-2xl border border-white/15 bg-slate-900/80 p-2.5 backdrop-blur-xl sm:mx-4 sm:p-3">
          <Link href="/" className="flex h-9 shrink-0 items-center rounded-xl border border-white/10 bg-white/5 px-2.5 text-slate-300 transition-colors hover:bg-white/10 sm:px-3"><ArrowLeft className="w-4 h-4" /><span className="ml-1.5 hidden text-xs font-medium sm:inline">Back to App</span></Link>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:justify-start"><KiraKiraLogo className="h-7 w-7" /><h1 className="truncate text-xs font-bold tracking-tight text-white sm:text-sm">Kira-Kira Analytics</h1><span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-label="Live" /></div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={onRefresh} aria-label="Refresh analytics" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"><RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
            <button type="button" onClick={onLogout} aria-label="Log out" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"><LogOut className="w-4 h-4" /></button>
          </div>
        </header>

        <section className="mb-6 grid grid-cols-3 gap-2.5 sm:gap-4">
          <KpiCard
            icon={<Activity className="w-4 h-4" />}
            value={analytics.visits}
            label="VISITS"
            subLabel="Total app opens"
          />
          <KpiCard
            icon={<BarChart3 className="w-4 h-4" />}
            value={analytics.scans}
            label="SCANS"
            subLabel="Receipts parsed"
          />
          <KpiCard
            icon={<Smartphone className="w-4 h-4" />}
            value={`${analytics.mobilePercent}%`}
            label="MOBILE"
            subLabel={`${analytics.mobileVisits} of ${analytics.totalVisits} visits`}
          />
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <DistributionCard title="OS Distribution" items={analytics.osDistribution} accent="bg-blue-500" />
          <DistributionCard title="Device Brands" items={analytics.brandDistribution} accent="bg-cyan-400" />
        </section>

        <section className="mt-4 overflow-hidden rounded-2xl border-x border-white/10 border-b border-white/5 border-t border-white/20 bg-slate-900/50 shadow-xl shadow-black/40 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div><h2 className="text-sm font-bold text-white">Live Activity</h2><p className="mt-0.5 text-[11px] text-slate-500">50 most recent anonymous events</p></div><Activity className="w-4 h-4 text-blue-400" /></div>
          <div className="w-full overflow-hidden">
            <table className="w-full table-fixed text-left text-xs">
              <thead className="bg-white/[0.03] text-slate-500"><tr><th className="w-24 px-4 py-3 font-semibold sm:w-32">Time</th><th className="w-32 px-4 py-3 font-semibold sm:w-40">Event</th><th className="px-4 py-3 font-semibold">Device Info</th></tr></thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {analytics.recentEvents.map((event) => { const badge = eventBadge(event.eventName); return <tr key={event.id}><td className="whitespace-nowrap px-4 py-3.5 font-mono text-slate-400">{formatTime(event.createdAt)}</td><td className="px-4 py-3.5"><span className={`whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-semibold ${badge.className}`}>{badge.label}</span></td><td className="truncate px-4 py-3.5 text-slate-300">{event.osName}{event.osVersion ? ` ${event.osVersion}` : ''} <span className="text-slate-600">•</span> {event.deviceVendor || event.deviceType}</td></tr>; })}
                {analytics.recentEvents.length === 0 && <tr><td colSpan={3} className="px-4 py-10 text-center text-sm text-slate-500">No telemetry events yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function KpiCard({ icon, value, label, subLabel }: { icon: React.ReactNode; value: number | string; label: string; subLabel?: string }) {
  return <article className="flex h-32 flex-col justify-between rounded-2xl border border-white/10 bg-slate-900/50 p-3.5 shadow-xl shadow-black/40 backdrop-blur-xl sm:h-36 sm:p-4"><div className="flex items-start justify-between text-blue-400">{icon}<span className="h-1.5 w-1.5 rounded-full bg-blue-400/70" /></div><p className="my-auto text-2xl font-bold tracking-tight text-white sm:text-3xl">{value}</p><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:text-xs">{label}</p>{subLabel && <p className="truncate text-[10px] text-slate-500">{subLabel}</p>}</div></article>;
}

function DistributionCard({ title, items, accent }: { title: string; items: Distribution[]; accent: string }) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return <section className="rounded-2xl border-x border-white/10 border-b border-white/5 border-t border-white/20 bg-slate-900/50 p-4 shadow-xl shadow-black/40 backdrop-blur-xl"><h2 className="text-sm font-bold text-white">{title}</h2><div className="mt-4 space-y-3">{items.length > 0 ? items.map((item) => { const percent = total > 0 ? Math.round((item.count / total) * 100) : 0; return <div key={item.label}><div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-medium text-slate-300">{item.label}</span><span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-300">{percent}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/5"><div className={`h-full rounded-full ${accent}`} style={{ width: `${percent}%` }} /></div></div>; }) : <p className="text-sm text-slate-500">Awaiting telemetry data.</p>}</div></section>;
}
