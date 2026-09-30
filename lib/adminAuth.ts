import { createHash, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';

export const ADMIN_COOKIE_NAME = 'kira_admin_auth';

function adminSessionValue(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  return createHash('sha256')
    .update(`kira_admin_auth:v1:${password}`)
    .digest('base64url');
}

export function isValidAdminPassword(password: string): boolean {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword) return false;
  const received = Buffer.from(password);
  const expected = Buffer.from(configuredPassword);
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

export function isAdminRequest(request: NextRequest): boolean {
  const expected = adminSessionValue();
  const received = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!expected || !received) return false;
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return (
    receivedBytes.length === expectedBytes.length &&
    timingSafeEqual(receivedBytes, expectedBytes)
  );
}

export function getAdminSessionValue(): string | null {
  return adminSessionValue();
}
