import { NextRequest, NextResponse } from 'next/server';
import { parseSharedBill } from '@/app/lib/sharedBill';
import { saveSharedBill } from '@/lib/shared-bills';
import { hasTursoConfiguration } from '@/lib/turso';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 128 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_IP = 10;
const MAX_TRACKED_IPS = 10_000;
const requestsByIp = new Map<string, number>();
let rateLimitResetsAt = 0;

function allowRequest(request: NextRequest): boolean {
  const now = Date.now();
  if (now >= rateLimitResetsAt) {
    requestsByIp.clear();
    rateLimitResetsAt = now + RATE_LIMIT_WINDOW_MS;
  }
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const count = requestsByIp.get(ip);
  if (count === undefined && requestsByIp.size >= MAX_TRACKED_IPS) return false;
  if (count !== undefined && count >= MAX_REQUESTS_PER_IP) return false;
  requestsByIp.set(ip, (count ?? 0) + 1);
  return true;
}

async function readBody(request: NextRequest): Promise<string | null> {
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return '';

  const decoder = new TextDecoder();
  let size = 0;
  let body = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) return body + decoder.decode();
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    body += decoder.decode(value, { stream: true });
  }
}

export async function POST(request: NextRequest) {
  if (!hasTursoConfiguration) {
    return NextResponse.json({ error: 'Sharing is unavailable.' }, { status: 503 });
  }
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return NextResponse.json({ error: 'Expected a JSON bill.' }, { status: 415 });
  }
  if (!allowRequest(request)) {
    return NextResponse.json({ error: 'Too many requests.' }, {
      status: 429,
      headers: { 'Retry-After': '60' },
    });
  }

  let bill;
  try {
    const body = await readBody(request);
    if (body === null) return NextResponse.json({ error: 'Bill is too large.' }, { status: 413 });
    bill = parseSharedBill(JSON.parse(body));
  } catch {
    return NextResponse.json({ error: 'Invalid bill.' }, { status: 400 });
  }
  if (!bill) return NextResponse.json({ error: 'Invalid bill.' }, { status: 400 });

  try {
    const id = await saveSharedBill(bill);
    return NextResponse.json({ id }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    console.error('[SHARED BILL SAVE FAILED]');
    return NextResponse.json({ error: 'Couldn’t save the bill.' }, { status: 503 });
  }
}
