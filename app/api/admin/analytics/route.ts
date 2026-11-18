import { NextRequest, NextResponse } from 'next/server';
import { brandLabel, osLabel, type AnalyticsData, type Distribution } from '@/app/lib/adminAnalytics';
import { analyticsWindow, parseAnalyticsRange } from '@/lib/adminAnalyticsWindow';
import { isAdminRequest } from '@/lib/adminAuth';
import { ensureAnalyticsEventsTable } from '@/lib/analyticsSchema';
import { hasTursoConfiguration, turso } from '@/lib/turso';

export const runtime = 'nodejs';

function addCount(counts: Map<string, number>, label: string, count: number) {
  counts.set(label, (counts.get(label) ?? 0) + count);
}

function distribution(counts: Map<string, number>): Distribution[] {
  return Array.from(counts, ([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function brandDistribution(counts: Map<string, number>): Distribution[] {
  const known = distribution(counts).filter(({ label }) => label !== 'Unknown');
  const other = known.slice(5).reduce((total, item) => total + item.count, 0);
  const unknown = counts.get('Unknown') ?? 0;
  return [
    ...known.slice(0, 5),
    ...(other ? [{ label: 'Other', count: other }] : []),
    ...(unknown ? [{ label: 'Unknown', count: unknown }] : []),
  ];
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const range = parseAnalyticsRange(request.nextUrl.searchParams.get('range'));
  if (!range) return NextResponse.json({ error: 'Invalid date range.' }, { status: 400 });
  if (!hasTursoConfiguration) {
    return NextResponse.json({ error: 'Telemetry database is not configured.' }, { status: 503 });
  }

  const { start, end, trendStart, bucketFormat, buckets } = analyticsWindow(range);
  const timeFilter = start ? 'created_at >= ? AND created_at <= ?' : 'created_at <= ?';
  const args = start ? [start, end] : [end];

  try {
    await ensureAnalyticsEventsTable();
    const [opens, scans, trend, recent] = await turso.batch([
      {
        sql: `SELECT os_name, lower(trim(device_type)) AS device_type,
          COALESCE(NULLIF(trim(device_brand), ''), NULLIF(trim(device_vendor), ''), '') AS brand,
          COUNT(*) AS count
          FROM analytics_events
          WHERE event_name = 'app_open' AND ${timeFilter}
          GROUP BY os_name, lower(trim(device_type)), brand`,
        args,
      },
      {
        sql: `SELECT event_name,
          json_extract(CASE WHEN json_valid(metadata) THEN metadata ELSE '{}' END, '$.source') AS source,
          COUNT(*) AS count
          FROM analytics_events
          WHERE event_name IN ('scan_completed', 'scan_failed', 'scan_client_error') AND ${timeFilter}
          GROUP BY event_name, source`,
        args,
      },
      {
        sql: `SELECT strftime(?, created_at, '+8 hours') AS bucket,
          COUNT(CASE WHEN event_name = 'scan_completed' THEN 1 END) AS successful,
          COUNT(CASE WHEN event_name = 'scan_failed' THEN 1 END) AS failed
          FROM analytics_events
          WHERE event_name IN ('scan_completed', 'scan_failed') AND created_at >= ? AND created_at <= ?
            AND json_extract(CASE WHEN json_valid(metadata) THEN metadata ELSE '{}' END, '$.source') = 'server'
          GROUP BY bucket`,
        args: [bucketFormat, trendStart, end],
      },
      {
        sql: `SELECT id, event_name, os_name,
          COALESCE(NULLIF(trim(device_brand), ''), NULLIF(trim(device_vendor), ''), '') AS brand, created_at
          FROM analytics_events WHERE ${timeFilter}
          ORDER BY created_at DESC, id DESC LIMIT 50`,
        args,
      },
    ], 'read');

    const osCounts = new Map<string, number>();
    const brandCounts = new Map<string, number>();
    let appOpens = 0;
    let mobileOpens = 0;
    for (const row of opens.rows) {
      const os = osLabel(String(row.os_name ?? ''));
      const count = Number(row.count);
      appOpens += count;
      if (row.device_type === 'mobile' || row.device_type === 'tablet' || os === 'iOS' || os === 'Android') {
        mobileOpens += count;
      }
      addCount(osCounts, os, count);
      addCount(brandCounts, brandLabel(os, String(row.brand ?? '')), count);
    }

    let successfulScans = 0;
    let failedScans = 0;
    let clientErrors = 0;
    let serverSuccesses = 0;
    let serverFailures = 0;
    for (const row of scans.rows) {
      const count = Number(row.count);
      if (row.event_name === 'scan_completed') {
        successfulScans += count;
        if (row.source === 'server') serverSuccesses += count;
      } else if (row.event_name === 'scan_failed') {
        failedScans += count;
        if (row.source === 'server') serverFailures += count;
      } else {
        clientErrors += count;
      }
    }

    const serverOutcomes = serverSuccesses + serverFailures;
    const trendByBucket = new Map(trend.rows.map((row) => [
      String(row.bucket), { successful: Number(row.successful), failed: Number(row.failed) },
    ]));

    const data: AnalyticsData = {
      updatedAt: end,
      appOpens,
      mobileOpens,
      successfulScans,
      failedScans,
      clientErrors,
      serverSuccessRate: serverOutcomes > 0 ? 100 * serverSuccesses / serverOutcomes : null,
      scanTrend: buckets.map(({ key, label }) => ({
        label,
        ...(trendByBucket.get(key) ?? { successful: 0, failed: 0 }),
      })),
      osDistribution: distribution(osCounts),
      brandDistribution: brandDistribution(brandCounts),
      recentEvents: recent.rows.map((row) => ({
        id: String(row.id),
        eventName: String(row.event_name),
        osName: String(row.os_name ?? ''),
        deviceBrand: String(row.brand ?? ''),
        createdAt: String(row.created_at),
      })),
    };

    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not load analytics.' }, { status: 503 });
  }
}
