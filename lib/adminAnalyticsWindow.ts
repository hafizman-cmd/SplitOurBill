import { ANALYTICS_RANGES, DEFAULT_ANALYTICS_RANGE, type AnalyticsRange } from '@/app/lib/adminAnalytics';

const MYT_OFFSET = 8 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function parseAnalyticsRange(value: string | null): AnalyticsRange | null {
  if (value === null) return DEFAULT_ANALYTICS_RANGE;
  return Object.hasOwn(ANALYTICS_RANGES, value) ? value as AnalyticsRange : null;
}

export function analyticsWindow(range: AnalyticsRange, now = new Date()) {
  const localNow = new Date(now.getTime() + MYT_OFFSET);
  const year = localNow.getUTCFullYear();
  const month = localNow.getUTCMonth();
  const localMidnight = Date.UTC(year, month, localNow.getUTCDate());
  const days = range === 'today' ? 1 : range === '7d' ? 7 : 30;
  const localStart = range === 'all' ? Date.UTC(year, month - 11, 1) : localMidnight - (days - 1) * DAY;
  const toUtcIso = (timestamp: number) => new Date(timestamp - MYT_OFFSET).toISOString();

  const hourly = range === 'today';
  const monthly = range === 'all';
  const bucketFormat = monthly ? '%Y-%m' : hourly ? '%Y-%m-%d %H' : '%Y-%m-%d';
  const formatter = new Intl.DateTimeFormat('en-MY', monthly
    ? { timeZone: 'UTC', month: 'short', year: '2-digit' }
    : { timeZone: 'UTC', day: 'numeric', month: 'short' });
  const bucketCount = monthly ? 12 : hourly ? localNow.getUTCHours() + 1 : days;
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const date = new Date(monthly ? Date.UTC(year, month - 11 + index, 1) : localStart + index * (hourly ? HOUR : DAY));
    const iso = date.toISOString();
    const key = hourly ? iso.slice(0, 13).replace('T', ' ') : iso.slice(0, monthly ? 7 : 10);
    return { key, label: hourly ? iso.slice(11, 16) : formatter.format(date) };
  });

  return {
    start: monthly ? '' : toUtcIso(localStart),
    end: now.toISOString(),
    trendStart: toUtcIso(localStart),
    bucketFormat,
    buckets,
  };
}
