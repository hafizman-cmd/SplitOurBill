import { NextRequest } from 'next/server';
import { UAParser } from 'ua-parser-js';
import { ensureAnalyticsEventsTable } from '@/lib/analyticsSchema';
import { hasTursoConfiguration, turso } from '@/lib/turso';

export async function recordScanEvent(request: NextRequest, status: number, code: string): Promise<void> {
  if (!hasTursoConfiguration) return;
  try {
    const parsed = new UAParser(request.headers.get('user-agent') ?? '').getResult();
    const session = request.headers.get('x-telemetry-session');
    const sessionId = session && /^[a-zA-Z0-9_-]{1,100}$/.test(session) ? session : '';
    const os = parsed.os.name ?? 'Unknown';
    const deviceType = parsed.device.type ?? (/android|ios/i.test(os) ? 'mobile' : 'desktop');
    const vendor = parsed.device.vendor ?? (/mac/i.test(os) ? 'Apple' : deviceType === 'desktop' ? 'PC' : 'Mobile');
    await ensureAnalyticsEventsTable();
    await turso.execute({
      sql: `INSERT INTO analytics_events
        (id, session_id, event_name, os_name, os_version, device_vendor, device_brand, device_type, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [crypto.randomUUID(), sessionId, status < 400 ? 'scan_completed' : 'scan_failed',
        os, parsed.os.version ?? '', vendor, vendor, deviceType,
        JSON.stringify({ code, status, source: 'server' }), new Date().toISOString()],
    });
  } catch {
    console.error('[audit] Could not record scan event.');
  }
}
