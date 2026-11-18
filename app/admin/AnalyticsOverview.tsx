import { Activity, CheckCircle2, CircleAlert, MonitorSmartphone, ScanLine } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AnalyticsData, AnalyticsRange, Distribution, ScanBucket } from '../lib/adminAnalytics';
import { panelClass } from './AdminEvents';

const countFormat = new Intl.NumberFormat('en-MY');
const percentFormat = new Intl.NumberFormat('en-MY', { style: 'percent', maximumFractionDigits: 1 });

export default function AnalyticsOverview({ data, range }: { data: AnalyticsData; range: AnalyticsRange }) {
  const { appOpens, mobileOpens, successfulScans, failedScans, clientErrors, serverSuccessRate, scanTrend } = data;

  return (
    <>
      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={<Activity size={18} />} label="Recorded app opens" value={countFormat.format(appOpens)} detail="Bill splitter and shared bill views" />
        <Metric icon={<CheckCircle2 size={18} />} label="Successful scans" value={countFormat.format(successfulScans)} detail="Recorded scan completions" accent="text-emerald-300" />
        <Metric icon={<CircleAlert size={18} />} label="Failed scans" value={countFormat.format(failedScans)} detail={`${countFormat.format(clientErrors)} separate client ${clientErrors === 1 ? 'error' : 'errors'}`} accent="text-rose-300" />
        <Metric icon={<MonitorSmartphone size={18} />} label="Mobile opens" value={appOpens ? percentFormat.format(mobileOpens / appOpens) : '—'} detail={`${countFormat.format(mobileOpens)} of ${countFormat.format(appOpens)} recorded opens`} />
      </section>

      <section aria-labelledby="scan-health-heading" className={`${panelClass} p-4 sm:p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="scan-health-heading" className="flex items-center gap-2 text-base font-semibold text-white">
              <ScanLine size={18} className="text-sky-300" /> Scan health
            </h2>
            <p className="mt-1 text-sm text-slate-400">{range === 'all' ? 'Latest 12 months · MYT' : range === 'today' ? 'Hourly server outcomes · MYT' : 'Daily server outcomes · MYT'}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2">
            <p className="text-xs text-slate-400">Server success rate</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-white">{serverSuccessRate === null ? '—' : percentFormat.format(serverSuccessRate / 100)}</p>
          </div>
        </div>
        <ScanTrend buckets={scanTrend} />
        <p className="mt-4 text-xs leading-relaxed text-slate-400">The rate and chart use scans with a recorded server outcome. Older scans may lack these records. Client errors are counted separately because they can occur after a successful server scan.</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <DistributionCard title="Operating systems" items={data.osDistribution} />
        <DistributionCard title="Device brands" items={data.brandDistribution} />
      </div>
    </>
  );
}

function Metric({ icon, label, value, detail, accent = 'text-sky-300' }: {
  icon: ReactNode; label: string; value: string; detail: string; accent?: string;
}) {
  return (
    <article className={`${panelClass} flex flex-col p-3.5 sm:p-4`}>
      <span className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800/80 ${accent}`}>{icon}</span>
      <p className="text-sm font-medium leading-tight text-slate-300">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-white sm:text-3xl">{value}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{detail}</p>
    </article>
  );
}

function ScanTrend({ buckets }: { buckets: ScanBucket[] }) {
  const max = Math.max(0, ...buckets.map(({ successful, failed }) => successful + failed));
  if (!max) return <p className="mt-4 rounded-xl border border-dashed border-slate-700 px-4 py-7 text-center text-sm text-slate-400">No server scan outcomes in this chart period.</p>;

  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />Successful</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-400" />Failed</span>
      </div>
      <div aria-hidden="true">
        <div className="flex h-28 items-end justify-between gap-0.5 rounded-t-lg border-b border-slate-700 bg-slate-950/50 px-2 pt-2 sm:h-36 sm:gap-1.5">
          {buckets.map(({ label, successful, failed }) => (
            <div key={label} title={`${label} · ${successful} successful · ${failed} failed`} className="flex h-full min-w-0 flex-1 flex-col justify-end">
              <div className="rounded-t-sm bg-rose-400" style={{ height: `${100 * failed / max}%` }} />
              <div className={failed ? 'bg-emerald-400' : 'rounded-t-sm bg-emerald-400'} style={{ height: `${100 * successful / max}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs tabular-nums text-slate-400">
          <span>{buckets[0]?.label}</span>
          {buckets.length > 2 && <span>{buckets[Math.floor(buckets.length / 2)]?.label}</span>}
          {buckets.length > 1 && <span>{buckets.at(-1)?.label}</span>}
        </div>
      </div>
      <details className="mt-3 text-xs text-slate-300">
        <summary className="w-fit cursor-pointer rounded-sm text-sky-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">View scan counts</summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <thead><tr className="text-slate-400"><th scope="col" className="py-1">Period (MYT)</th><th scope="col" className="py-1">Successful</th><th scope="col" className="py-1">Failed</th></tr></thead>
          <tbody>
            {buckets.map(({ label, successful, failed }) => (
              <tr key={label} className="border-t border-slate-800"><th scope="row" className="py-1.5 font-normal">{label}</th><td>{countFormat.format(successful)}</td><td>{countFormat.format(failed)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function DistributionCard({ title, items }: { title: string; items: Distribution[] }) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return (
    <section className={`${panelClass} p-4 sm:p-5`}>
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <p className="mt-1 text-sm text-slate-400">Share of recorded app opens</p>
      {total > 0 ? (
        <ul className="mt-4 space-y-3">
          {items.map(({ label, count }) => {
            const proportion = count / total;
            return (
              <li key={label}>
                <div className="mb-1.5 flex justify-between gap-3 text-xs">
                  <span className="font-medium text-slate-200">{label}</span>
                  <span className="text-right tabular-nums text-slate-400">{countFormat.format(count)} · {percentFormat.format(proportion)}</span>
                </div>
                <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-sky-400/80" style={{ width: `${100 * proportion}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : <p className="mt-5 text-sm text-slate-400">No app opens recorded for this range.</p>}
    </section>
  );
}
