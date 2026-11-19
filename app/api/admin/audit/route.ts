import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { ensureAnalyticsEventsTable } from '@/lib/analyticsSchema';
import { hasTursoConfiguration, turso } from '@/lib/turso';
import { AUDIT_FILTERS, auditCode, type AuditFilter } from '@/app/lib/auditEvents';
import { ADMIN_EVENT_PAGE_SIZE, type AdminEvent } from '@/app/lib/adminAnalytics';
import { analyticsWindow, parseAnalyticsRange } from '@/lib/adminAnalyticsWindow';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const filter = request.nextUrl.searchParams.get('filter') ?? 'all';
  if (!Object.hasOwn(AUDIT_FILTERS, filter)) return NextResponse.json({ error: 'Invalid filter.' }, { status: 400 });
  const range = parseAnalyticsRange(request.nextUrl.searchParams.get('range') ?? 'all');
  if (!range) return NextResponse.json({ error: 'Invalid date range.' }, { status: 400 });
  const cursor = request.nextUrl.searchParams.get('cursor');
  let after: { time: string; id: string } | null = null;
  if (cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString());
      if (typeof decoded.time !== 'string' || typeof decoded.id !== 'string' || decoded.time.length > 64 || decoded.id.length > 100) throw new Error();
      after = decoded;
    } catch {
      return NextResponse.json({ error: 'Invalid cursor.' }, { status: 400 });
    }
  }
  if (!hasTursoConfiguration) return NextResponse.json({ events: [], nextCursor: null, configured: false });
  const clauses: Record<AuditFilter, string> = {
    all: '1 = 1',
    errors: "event_name IN ('scan_failed', 'scan_client_error')",
    scan_completed: "event_name = 'scan_completed'",
    scan_failed: "event_name = 'scan_failed'",
    scan_client_error: "event_name = 'scan_client_error'",
    upstream_timeout: "json_extract(CASE WHEN json_valid(metadata) THEN metadata ELSE '{}' END, '$.code') = 'upstream_timeout'",
    upstream_error: "json_extract(CASE WHEN json_valid(metadata) THEN metadata ELSE '{}' END, '$.code') = 'upstream_error'",
    configuration_missing: "json_extract(CASE WHEN json_valid(metadata) THEN metadata ELSE '{}' END, '$.code') = 'configuration_missing'",
    internal_error: "json_extract(CASE WHEN json_valid(metadata) THEN metadata ELSE '{}' END, '$.code') = 'internal_error'",
    rate_limited: "json_extract(CASE WHEN json_valid(metadata) THEN metadata ELSE '{}' END, '$.code') = 'rate_limited'",
    daily_limit: "json_extract(CASE WHEN json_valid(metadata) THEN metadata ELSE '{}' END, '$.code') = 'daily_limit'",
    invalid_receipt: "json_extract(CASE WHEN json_valid(metadata) THEN metadata ELSE '{}' END, '$.code') IN ('invalid_payload', 'invalid_image', 'image_too_large', 'unreadable_receipt', 'no_items')",
  };
  const { start, end } = analyticsWindow(range);
  try {
    await ensureAnalyticsEventsTable();
    const result = await turso.execute({
      sql: `SELECT id, event_name, session_id, os_name,
        COALESCE(NULLIF(trim(device_brand), ''), NULLIF(trim(device_vendor), ''), '') AS brand, metadata, created_at
        FROM analytics_events WHERE (${clauses[filter as AuditFilter]}) AND created_at <= ?
        ${start ? 'AND created_at >= ?' : ''}
        ${after ? 'AND (created_at < ? OR (created_at = ? AND id < ?))' : ''}
        ORDER BY created_at DESC, id DESC LIMIT ?`,
      args: [end, ...(start ? [start] : []), ...(after ? [after.time, after.time, after.id] : []), ADMIN_EVENT_PAGE_SIZE + 1],
    });
    const events: (AdminEvent & { sessionId: string; code: string })[] = result.rows.slice(0, ADMIN_EVENT_PAGE_SIZE).map(row => ({
      id: String(row.id ?? ''), eventName: String(row.event_name ?? ''),
      sessionId: String(row.session_id ?? ''), osName: String(row.os_name ?? ''),
      deviceBrand: String(row.brand ?? ''), code: auditCode(String(row.metadata ?? '')),
      createdAt: String(row.created_at ?? ''),
    }));
    const last = events.at(-1);
    const nextCursor = result.rows.length > ADMIN_EVENT_PAGE_SIZE && last
      ? Buffer.from(JSON.stringify({ time: last.createdAt, id: last.id })).toString('base64url') : null;
    return NextResponse.json({ events, nextCursor, configured: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not load audit events. Please try again.' }, { status: 503 });
  }
}
