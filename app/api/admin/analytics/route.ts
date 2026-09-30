import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { hasTursoConfiguration, turso } from '@/lib/turso';
import { ensureAnalyticsEventsTable } from '@/lib/analyticsSchema';

export const runtime = 'nodejs';

type Distribution = { label: string; count: number };

const EMPTY_ANALYTICS = {
  visits: 0,
  scans: 0,
  mobilePercent: 0,
  mobileVisits: 0,
  totalVisits: 0,
  iosPercent: 0,
  androidPercent: 0,
  osDistribution: [] as Distribution[],
  brandDistribution: [] as Distribution[],
  recentEvents: [],
};

function value(row: Record<string, unknown>, key: string): string {
  const entry = row[key];
  return entry === null || entry === undefined ? '' : String(entry);
}

function count(rows: Record<string, unknown>[]): number {
  return Number(rows[0]?.count ?? 0) || 0;
}

function distribution(rows: Record<string, unknown>[]): Distribution[] {
  return rows.map((row) => ({ label: value(row, 'label'), count: Number(row.count) || 0 }));
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!hasTursoConfiguration) {
    return NextResponse.json(EMPTY_ANALYTICS);
  }

  try {
    await ensureAnalyticsEventsTable();
    const [visitsResult, scansResult, osResult, mobileOsResult, brandsResult, recentResult] =
      await Promise.all([
        turso.execute(`
          SELECT
            COUNT(CASE WHEN event_name = 'app_open' THEN 1 END) AS app_open_count,
            COUNT(DISTINCT NULLIF(session_id, '')) AS session_count,
            COUNT(CASE WHEN event_name = 'app_open' AND (
              lower(device_type) IN ('mobile', 'tablet')
              OR lower(os_name) IN ('ios', 'android')
            ) THEN 1 END) AS mobile_app_open_count,
            COUNT(DISTINCT CASE WHEN
              lower(device_type) IN ('mobile', 'tablet')
              OR lower(os_name) IN ('ios', 'android')
              THEN NULLIF(session_id, '') END) AS mobile_session_count
          FROM analytics_events
        `),
        turso.execute("SELECT COUNT(*) AS count FROM analytics_events WHERE event_name = 'scan_completed'"),
        turso.execute(`
          SELECT
            CASE
              WHEN lower(os_name) LIKE '%ios%' THEN 'iOS'
              WHEN lower(os_name) LIKE '%android%' THEN 'Android'
              ELSE 'Desktop'
            END AS label,
            COUNT(*) AS count
          FROM analytics_events
          GROUP BY label
          ORDER BY count DESC
        `),
        turso.execute(`
          SELECT
            CASE
              WHEN lower(os_name) LIKE '%ios%' THEN 'iOS'
              WHEN lower(os_name) LIKE '%android%' THEN 'Android'
              ELSE 'Other'
            END AS label,
            COUNT(*) AS count
          FROM analytics_events
          WHERE lower(device_type) IN ('mobile', 'tablet')
          GROUP BY label
        `),
        turso.execute(`
          SELECT COALESCE(NULLIF(device_brand, ''), NULLIF(device_vendor, ''), 'Unknown') AS label, COUNT(*) AS count
          FROM analytics_events
          GROUP BY device_vendor
          ORDER BY count DESC
          LIMIT 8
        `),
        turso.execute(`
          SELECT id, event_name, os_name, os_version,
            COALESCE(NULLIF(device_brand, ''), NULLIF(device_vendor, ''), 'Unknown') AS device_vendor,
            device_type, metadata, created_at
          FROM analytics_events
          ORDER BY created_at DESC
          LIMIT 50
        `),
      ]);

    const osDistribution = distribution(osResult.rows as Record<string, unknown>[]);
    const mobileOsDistribution = distribution(mobileOsResult.rows as Record<string, unknown>[]);
    const mobileEvents = mobileOsDistribution.reduce((total, item) => total + item.count, 0);
    const iosCount = mobileOsDistribution.find((item) => item.label === 'iOS')?.count ?? 0;
    const androidCount = mobileOsDistribution.find((item) => item.label === 'Android')?.count ?? 0;
    const visitsRow = visitsResult.rows[0] as Record<string, unknown> | undefined;
    const appOpenCount = Number(visitsRow?.app_open_count ?? 0) || 0;
    const sessionCount = Number(visitsRow?.session_count ?? 0) || 0;
    const mobileAppOpenCount = Number(visitsRow?.mobile_app_open_count ?? 0) || 0;
    const mobileSessionCount = Number(visitsRow?.mobile_session_count ?? 0) || 0;
    const totalVisits = appOpenCount > 0 ? appOpenCount : sessionCount;
    const mobileVisits = appOpenCount > 0 ? mobileAppOpenCount : mobileSessionCount;

    return NextResponse.json({
      visits: totalVisits,
      scans: count(scansResult.rows as Record<string, unknown>[]),
      mobilePercent: totalVisits > 0 ? Math.round((mobileVisits / totalVisits) * 100) : 0,
      mobileVisits,
      totalVisits,
      iosPercent: mobileEvents > 0 ? Math.round((iosCount / mobileEvents) * 100) : 0,
      androidPercent: mobileEvents > 0 ? Math.round((androidCount / mobileEvents) * 100) : 0,
      osDistribution,
      brandDistribution: distribution(brandsResult.rows as Record<string, unknown>[]),
      recentEvents: (recentResult.rows as Record<string, unknown>[]).map((row) => ({
        id: value(row, 'id'),
        eventName: value(row, 'event_name'),
        osName: value(row, 'os_name'),
        osVersion: value(row, 'os_version'),
        deviceVendor: value(row, 'device_vendor'),
        deviceType: value(row, 'device_type'),
        metadata: value(row, 'metadata'),
        createdAt: value(row, 'created_at'),
      })),
    });
  } catch {
    return NextResponse.json(EMPTY_ANALYTICS);
  }
}
