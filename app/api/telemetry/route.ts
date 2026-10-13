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

function parseOsName(userAgent: string, parsedName?: string): string | null {
  const source = `${parsedName ?? ''} ${userAgent}`.toLowerCase();
  if (/iphone|ipad|ipod|ios|macintosh.*mobile/.test(source)) return 'iOS';
  if (source.includes('android')) return 'Android';
  if (source.includes('windows')) return 'Windows';
  if (source.includes('mac os') || source.includes('macintosh')) return 'macOS';
  if (source.includes('linux')) return 'Linux';
  return null;
}

function parseDeviceBrand(
  userAgent: string,
  osName: string | null,
  vendor?: string,
  model?: string,
): string {
  if (osName === 'iOS') return /ipad/i.test(userAgent) ? 'iPad' : 'Apple';
  if (osName === 'macOS') return 'Mac';
  if (osName === 'Windows' || osName === 'Linux') return 'PC';

  const androidVendors = [
    ['samsung', 'Samsung'],
    ['pixel', 'Pixel'],
    ['xiaomi', 'Xiaomi'],
    ['huawei', 'Huawei'],
    ['oppo', 'Oppo'],
    ['vivo', 'Vivo'],
    ['oneplus', 'OnePlus'],
  ] as const;
  const matchedVendor = androidVendors.find(([token]) => new RegExp(token, 'i').test(userAgent));
  if (osName === 'Android') return matchedVendor?.[1] ?? (/sm-/i.test(userAgent) ? 'Samsung' : 'Mobile');

  const genericTokens = /^(k|build|android(?:\s+\d+(?:\.\d+)*)?|mobile|apple)$/i;
  const candidate = [vendor, model]
    .map((value) => value?.trim() ?? '')
    .find((value) => value && !genericTokens.test(value));

  return candidate ?? 'PC';
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

  const userAgent = request.headers.get('user-agent') ?? '';
  const parsed = new UAParser(userAgent).getResult();
  const parsedType = parsed.device.type;
  const parsedDeviceType =
    parsedType === 'mobile' || parsedType === 'tablet' ? parsedType : 'desktop';

  const id = crypto.randomUUID();
  const sessionId =
    text(body.sessionId ?? body.session_id, 100) ?? 'anonymous';
  const eventName = text(body.eventName ?? body.event_name, 80) ?? 'app_open';
  const osName = parseOsName(userAgent, nullableText(body.osName ?? body.os_name) ?? parsed.os.name);
  const osVersion =
    nullableText(body.osVersion ?? body.os_version) ?? parsed.os.version ?? null;
  const deviceBrand = parseDeviceBrand(
    userAgent,
    osName,
    nullableText(body.deviceBrand ?? body.device_brand) ?? parsed.device.vendor,
    parsed.device.model,
  );
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
