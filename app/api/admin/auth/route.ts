import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_SECONDS,
  createAdminSession,
  isAdminConfigured,
  isAdminRequest,
  isValidAdminPassword,
  reserveAdminLoginAttempt,
  revokeAdminSession,
} from '@/lib/adminAuth';
import { readRequestBody } from '@/lib/requestBody';

export const runtime = 'nodejs';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: ADMIN_SESSION_SECONDS,
};

const noStore = { 'Cache-Control': 'no-store' };
const maxBodyBytes = 4096;

function unavailable() {
  return NextResponse.json({ error: 'Admin authentication is unavailable.' }, { status: 503, headers: noStore });
}

export async function POST(request: NextRequest) {
  if (!isAdminConfigured()) return unavailable();
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return NextResponse.json({ error: 'Expected a JSON request.' }, { status: 415, headers: noStore });
  }

  let body: unknown;
  try {
    const raw = await readRequestBody(request, maxBodyBytes);
    if (raw === null) {
      return NextResponse.json({ error: 'Request is too large.' }, { status: 413, headers: noStore });
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid login request.' }, { status: 400, headers: noStore });
  }
  if (typeof body !== 'object' || body === null || !('password' in body) ||
      typeof body.password !== 'string' || !body.password) {
    return NextResponse.json({ error: 'Invalid login request.' }, { status: 400, headers: noStore });
  }

  try {
    const retryAfter = await reserveAdminLoginAttempt();
    if (retryAfter !== null) {
      return NextResponse.json({ error: 'Too many login attempts. Please try again later.' }, {
        status: 429,
        headers: { ...noStore, 'Retry-After': String(retryAfter) },
      });
    }
    if (!isValidAdminPassword(body.password)) {
      return NextResponse.json({ error: 'Incorrect passcode.' }, { status: 401, headers: noStore });
    }

    const session = await createAdminSession(request);
    const response = NextResponse.json({ authenticated: true }, { headers: noStore });
    response.cookies.set(ADMIN_COOKIE_NAME, session, cookieOptions);
    return response;
  } catch {
    console.error('[admin] Could not process login.');
    return unavailable();
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ authenticated: await isAdminRequest(request) }, { headers: noStore });
}

export async function DELETE(request: NextRequest) {
  try {
    await revokeAdminSession(request);
  } catch {
    console.error('[admin] Could not revoke session.');
    return unavailable();
  }
  const response = NextResponse.json({ authenticated: false }, { headers: noStore });
  response.cookies.set(ADMIN_COOKIE_NAME, '', { ...cookieOptions, maxAge: 0 });
  return response;
}
