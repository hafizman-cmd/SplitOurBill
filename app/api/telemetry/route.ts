import { NextRequest, NextResponse } from 'next/server';
import { UAParser } from 'ua-parser-js';
import { hasTursoConfiguration, turso } from '@/lib/turso';
import { ensureAnalyticsEventsTable } from '@/lib/analyticsSchema';

export const runtime = 'nodejs';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : null;
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function POST(request: NextRequest) {
  if (!hasTursoConfiguration) {
    return NextResponse.json(
      { success: false, error: 'Telemetry database is not configured.' },
      { status: 500 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: 'Invalid telemetry payload.' }, { status: 400 });
  }

  const parsed = new UAParser(request.headers.get('user-agent') ?? '').getResult();
  const parsedType = parsed.device.type;
  const parsedDeviceType =
    parsedType === 'mobile' || parsedType === 'tablet' ? parsedType : 'desktop';

  const id = crypto.randomUUID();
  const sessionId =
    text(body.sessionId ?? body.session_id, 100) ?? 'anonymous';
  const eventName = text(body.eventName ?? body.event_name, 80) ?? 'app_open';
  const osName = nullableText(body.osName ?? body.os_name) ?? parsed.os.name ?? null;
  const osVersion =
    nullableText(body.osVersion ?? body.os_version) ?? parsed.os.version ?? null;
  const deviceBrand =
    nullableText(body.deviceBrand ?? body.device_brand) ??
    parsed.device.vendor ??
    parsed.device.model ??
    null;
  const deviceType =
    nullableText(body.deviceType ?? body.device_type) ?? parsedDeviceType;
  const metadata = JSON.stringify(isRecord(body.metadata) ? body.metadata : {});

  if (metadata.length > 4_000) {
    return NextResponse.json({ error: 'Invalid telemetry payload.' }, { status: 400 });
  }

  try {
    await ensureAnalyticsEventsTable();
    await turso.execute({
      sql: `
        INSERT INTO analytics_events (
          id, session_id, event_name, os_name, os_version, device_brand,
          device_vendor, device_type, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        id,
        sessionId,
        eventName,
        osName,
        osVersion,
        deviceBrand,
        deviceBrand,
        deviceType,
        metadata,
        new Date().toISOString(),
      ],
    });
    return NextResponse.json({ success: true, id }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to record event';
    console.error('[TURSO TELEMETRY INSERT ERROR]:', errorMessage);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
