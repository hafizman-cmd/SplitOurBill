import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { hasTursoConfiguration, turso } from '@/lib/turso';
import { ensureAnalyticsEventsTable } from '@/lib/analyticsSchema';

export const runtime = 'nodejs';

type Distribution = { label: string; count: number };

const EMPTY_ANALYTICS = {
  visits: 0,
  scans: 0,
  iosPercent: 0,
  proMaxPercent: 0,
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
    const [opensResult, scansResult, osResult, brandsResult, proMaxResult, recentResult] =
      await Promise.all([
        turso.execute("SELECT COUNT(*) AS count FROM analytics_events WHERE event_name = 'app_open'"),
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
          SELECT COALESCE(NULLIF(device_brand, ''), NULLIF(device_vendor, ''), 'Unknown') AS label, COUNT(*) AS count
          FROM analytics_events
          GROUP BY device_vendor
          ORDER BY count DESC
          LIMIT 8
        `),
        turso.execute(`
          SELECT COUNT(*) AS count
          FROM analytics_events
          WHERE
            CAST(substr(COALESCE(screen_resolution, screen_metrics), 1, instr(COALESCE(screen_resolution, screen_metrics), 'x') - 1) AS INTEGER) >= 430
            OR CAST(substr(COALESCE(screen_resolution, screen_metrics), instr(COALESCE(screen_resolution, screen_metrics), 'x') + 1, instr(COALESCE(screen_resolution, screen_metrics), ' @') - instr(COALESCE(screen_resolution, screen_metrics), 'x') - 1) AS INTEGER) >= 932
        `),
        turso.execute(`
          SELECT id, event_name, COALESCE(screen_resolution, screen_metrics) AS screen_metrics, os_name, os_version, COALESCE(NULLIF(device_brand, ''), NULLIF(device_vendor, ''), 'Unknown') AS device_vendor,
            device_type, metadata, created_at
          FROM analytics_events
          ORDER BY created_at DESC
          LIMIT 50
        `),
      ]);

    const osDistribution = distribution(osResult.rows as Record<string, unknown>[]);
    const totalEvents = osDistribution.reduce((total, item) => total + item.count, 0);
    const iosCount = osDistribution.find((item) => item.label === 'iOS')?.count ?? 0;
    const proMaxViewports = count(proMaxResult.rows as Record<string, unknown>[]);

    return NextResponse.json({
      visits: count(opensResult.rows as Record<string, unknown>[]),
      scans: count(scansResult.rows as Record<string, unknown>[]),
      iosPercent: totalEvents > 0 ? Math.round((iosCount / totalEvents) * 100) : 0,
      proMaxPercent:
        totalEvents > 0 ? Math.round((proMaxViewports / totalEvents) * 100) : 0,
      osDistribution,
      brandDistribution: distribution(brandsResult.rows as Record<string, unknown>[]),
      recentEvents: (recentResult.rows as Record<string, unknown>[]).map((row) => ({
        id: value(row, 'id'),
        eventName: value(row, 'event_name'),
        screenMetrics: value(row, 'screen_metrics'),
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
