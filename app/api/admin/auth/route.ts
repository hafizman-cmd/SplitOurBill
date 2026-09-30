import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_COOKIE_NAME,
  getAdminSessionValue,
  isAdminRequest,
  isValidAdminPassword,
} from '@/lib/adminAuth';

export const runtime = 'nodejs';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 8,
};

export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  const password =
    typeof body === 'object' && body !== null && typeof (body as { password?: unknown }).password === 'string'
      ? (body as { password: string }).password
      : '';

  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Admin authentication is not configured.' }, { status: 503 });
  }
  if (!isValidAdminPassword(password)) {
    return NextResponse.json({ error: 'Incorrect passcode.' }, { status: 401 });
  }

  const session = getAdminSessionValue();
  if (!session) {
    return NextResponse.json({ error: 'Admin authentication is not configured.' }, { status: 503 });
  }
  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(ADMIN_COOKIE_NAME, session, cookieOptions);
  return response;
}

export function GET(request: NextRequest) {
  return NextResponse.json({ authenticated: isAdminRequest(request) });
}

export function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(ADMIN_COOKIE_NAME, '', { ...cookieOptions, maxAge: 0 });
  return response;
}
