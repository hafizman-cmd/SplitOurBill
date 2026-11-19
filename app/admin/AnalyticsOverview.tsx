import { Activity, ChevronRight, MonitorSmartphone, ScanLine } from 'lucide-react';
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import type { AnalyticsData, AnalyticsRange, Distribution, ScanBucket } from '../lib/adminAnalytics';
import type { AuditFilter } from '../lib/auditEvents';
import { panelClass } from './AdminEvents';

const countFormat = new Intl.NumberFormat('en-MY');
const percentFormat = new Intl.NumberFormat('en-MY', { style: 'percent', maximumFractionDigits: 1 });

export default function AnalyticsOverview({ data, range, onOpenEvents }: {
  data: AnalyticsData;
  range: AnalyticsRange;
  onOpenEvents: (filter: AuditFilter) => void;
}) {
  const { appOpens, mobileOpens, failedScans, clientErrors, serverSuccesses, serverOutcomes, serverSuccessRate, scanTrend } = data;

  return (
    <>
      <section aria-labelledby="scan-health-heading" className={`${panelClass} space-y-4 p-4 sm:p-5`}>
        <h2 id="scan-health-heading" className="flex items-center gap-2 text-lg font-semibold text-white">
          <ScanLine size={20} aria-hidden="true" className="text-indigo-300" /> Scan health
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <Metric label="Server success rate" value={serverSuccessRate === null ? '—' : percentFormat.format(serverSuccessRate / 100)} detail={serverOutcomes ? `${countFormat.format(serverSuccesses)} of ${countFormat.format(serverOutcomes)} successful` : 'No recorded server outcomes'} />
          <Metric label="Server outcomes" value={countFormat.format(serverOutcomes)} detail="Recorded successes and failures" />
          <Metric label="Failed scans" value={countFormat.format(failedScans)} detail="View failed scan events" onClick={() => onOpenEvents('scan_failed')} />
          <Metric label="Client errors" value={countFormat.format(clientErrors)} detail="View client error events" onClick={() => onOpenEvents('scan_client_error')} />
        </div>
        <div className="border-t border-slate-700/70 pt-4">
          <h3 className="text-sm font-semibold text-white">Server scan trend</h3>
          <p className="mt-1 text-sm text-slate-400">{range === 'all' ? 'Latest 12 months · MYT' : range === 'today' ? 'Hourly server outcomes · MYT' : 'Daily server outcomes · MYT'}</p>
          <ScanTrend buckets={scanTrend} />
          <p className="mt-3 text-xs leading-relaxed text-slate-400">Older scans may lack a recorded server outcome. Client errors can occur after a successful server scan.</p>
        </div>
      </section>

      <section aria-labelledby="usage-heading" className={`${panelClass} space-y-4 p-4 sm:p-5`}>
        <h2 id="usage-heading" className="text-base font-semibold text-white">Usage</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Metric icon={<Activity size={16} />} label="Recorded app opens" value={countFormat.format(appOpens)} detail="Bill splitter and shared bill views" />
          <Metric icon={<MonitorSmartphone size={16} />} label="Mobile opens" value={appOpens ? percentFormat.format(mobileOpens / appOpens) : '—'} detail={`${countFormat.format(mobileOpens)} of ${countFormat.format(appOpens)} recorded opens`} />
          <DistributionCard title="Operating systems" items={data.osDistribution} />
          <DistributionCard title="Device brands" items={data.brandDistribution} />
        </div>
      </section>
    </>
  );
}

function Metric({ icon, label, value, detail, onClick }: {
  icon?: ReactNode; label: string; value: string; detail: string; onClick?: () => void;
}) {
  const className = 'flex min-w-0 flex-col gap-1.5 rounded-xl border border-slate-700/70 bg-slate-950/50 p-3 text-left sm:p-4';
  const content = (
    <>
      <span className="flex w-full items-start justify-between gap-1 text-sm font-medium leading-tight text-slate-300">
        <span className="flex items-center gap-2">{icon && <span className="text-indigo-300" aria-hidden="true">{icon}</span>}{label}</span>
        {onClick && <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-indigo-300" />}
      </span>
      <span className={`break-all text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl ${onClick && value !== '0' ? 'text-rose-300' : 'text-white'}`}>{value}</span>
      <span className="text-xs leading-relaxed text-slate-400">{detail}</span>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={`${className} transition hover:border-indigo-400 hover:bg-indigo-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400`}>{content}</button>
  ) : <div className={className}>{content}</div>;
}

function ScanTrend({ buckets }: { buckets: ScanBucket[] }) {
  const [selection, setSelection] = useState<number | null>(null);
  const max = Math.max(0, ...buckets.map(({ successful, failed }) => successful + failed));
  if (!max) return <p className="mt-4 rounded-xl border border-dashed border-slate-700 px-4 py-7 text-center text-sm text-slate-400">No server scan outcomes in this chart period.</p>;

  const activeIndex = Math.min(selection ?? buckets.length - 1, buckets.length - 1);
  const active = buckets[activeIndex];
  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number;
    switch (event.key) {
      case 'ArrowLeft': next = Math.max(0, index - 1); break;
      case 'ArrowRight': next = Math.min(buckets.length - 1, index + 1); break;
      case 'Home': next = 0; break;
      case 'End': next = buckets.length - 1; break;
      default: return;
    }
    event.preventDefault();
    event.currentTarget.parentElement?.querySelectorAll('button')[next]?.focus();
  };

  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />Successful</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-400" />Failed</span>
      </div>
      <div>
        <div role="group" aria-label="Scan trend periods. Use left and right arrow keys to move between periods." className="flex h-28 items-end justify-between gap-0.5 rounded-t-lg border-b border-slate-700 bg-slate-950/50 px-2 pt-2 sm:h-36 sm:gap-1.5">
          {buckets.map(({ label, successful, failed }, index) => (
            <button
              key={label}
              type="button"
              tabIndex={index === activeIndex ? 0 : -1}
              aria-label={`${label}, ${countFormat.format(successful)} successful, ${countFormat.format(failed)} failed`}
              aria-current={index === activeIndex ? 'true' : undefined}
              onFocus={() => setSelection(index)}
              onClick={() => setSelection(index)}
              onKeyDown={(event) => moveFocus(event, index)}
              className="relative flex h-full min-w-0 flex-1 flex-col justify-end rounded-t-sm hover:bg-slate-700/50 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300 aria-[current=true]:bg-indigo-400/20"
            >
              <span aria-hidden="true" className="w-full rounded-t-sm bg-rose-400" style={{ height: `${100 * failed / max}%` }} />
              <span aria-hidden="true" className={`w-full bg-emerald-400 ${failed ? '' : 'rounded-t-sm'}`} style={{ height: `${100 * successful / max}%` }} />
            </button>
          ))}
        </div>
        <div aria-hidden="true" className="mt-2 flex justify-between text-xs tabular-nums text-slate-400">
          <span>{buckets[0]?.label}</span>
          {buckets.length > 2 && <span>{buckets[Math.floor(buckets.length / 2)]?.label}</span>}
          {buckets.length > 1 && <span>{buckets.at(-1)?.label}</span>}
        </div>
      </div>
      <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-slate-950/50 px-3 py-2 text-xs tabular-nums text-slate-300">
        <span className="font-semibold text-white">{active.label}</span>
        <span>{countFormat.format(active.successful)} successful</span>
        <span>{countFormat.format(active.failed)} failed</span>
      </p>
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
    <section className="min-w-0 rounded-xl border border-slate-700/70 bg-slate-950/50 p-3 sm:p-4">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
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
