import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { hasTursoConfiguration, turso } from './turso';

export const ADMIN_COOKIE_NAME = 'kira_admin_auth';
export const ADMIN_SESSION_SECONDS = 8 * 60 * 60;

const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_ATTEMPT_LIMIT = 10;

let schemaReady: Promise<unknown> | undefined;

export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD) &&
    (hasTursoConfiguration || process.env.NODE_ENV !== 'production');
}

function ensureAdminTables() {
  schemaReady ??= turso.batch([
    `CREATE TABLE IF NOT EXISTS admin_sessions (
      token_hash TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    )`,
    'CREATE INDEX IF NOT EXISTS admin_sessions_expiry ON admin_sessions(expires_at)',
    `CREATE TABLE IF NOT EXISTS admin_login_limit (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL
    )`,
  ], 'write').catch((error: unknown) => {
    schemaReady = undefined;
    throw error;
  });
  return schemaReady;
}

function sessionHash(token: string | undefined): string | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || !token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const sessionResetKey = process.env.ADMIN_SESSION_RESET_KEY ?? '';
  return createHash('sha256')
    .update(JSON.stringify(['kira_admin_auth:v3', token, password, sessionResetKey]))
    .digest('hex');
}

export function isValidAdminPassword(password: string): boolean {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword) return false;
  const received = createHash('sha256').update(password).digest();
  const expected = createHash('sha256').update(configuredPassword).digest();
  return timingSafeEqual(received, expected);
}

export async function reserveAdminLoginAttempt(): Promise<number | null> {
  await ensureAdminTables();
  const now = Date.now();
  const result = await turso.execute({
    sql: `INSERT INTO admin_login_limit (id, expires_at, attempts) VALUES (1, ?, 1)
      ON CONFLICT(id) DO UPDATE SET
        expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END,
        attempts = CASE WHEN expires_at <= ? THEN 1 ELSE attempts + 1 END
      WHERE expires_at <= ? OR attempts < ?`,
    args: [now + LOGIN_WINDOW_MS, now, now, now, LOGIN_ATTEMPT_LIMIT],
  });
  if (result.rowsAffected === 1) return null;
  const { rows: [limit] } = await turso.execute('SELECT expires_at FROM admin_login_limit WHERE id = 1');
  return Math.max(1, Math.ceil((Number(limit.expires_at) - Date.now()) / 1000));
}

export async function createAdminSession(request: NextRequest): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const hash = sessionHash(token);
  if (!hash) throw new Error('Admin authentication is unavailable.');
  const previousHash = sessionHash(request.cookies.get(ADMIN_COOKIE_NAME)?.value);
  await ensureAdminTables();
  const now = Date.now();
  await turso.batch([
    {
      sql: 'DELETE FROM admin_sessions WHERE expires_at <= ? OR token_hash = ?',
      args: [now, previousHash],
    },
    {
      sql: 'INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?, ?)',
      args: [hash, now + ADMIN_SESSION_SECONDS * 1000],
    },
  ], 'write');
  return token;
}

export async function isAdminRequest(request: NextRequest): Promise<boolean> {
  if (!isAdminConfigured()) return false;
  const hash = sessionHash(request.cookies.get(ADMIN_COOKIE_NAME)?.value);
  if (!hash) return false;
  try {
    await ensureAdminTables();
    const { rows } = await turso.execute({
      sql: 'SELECT expires_at FROM admin_sessions WHERE token_hash = ? AND expires_at > ?',
      args: [hash, Date.now()],
    });
    return rows.length > 0 && Number(rows[0].expires_at) > Date.now();
  } catch {
    console.error('[admin] Could not validate session.');
    return false;
  }
}

export async function revokeAdminSession(request: NextRequest): Promise<void> {
  if (!isAdminConfigured()) return;
  const hash = sessionHash(request.cookies.get(ADMIN_COOKIE_NAME)?.value);
  if (!hash) return;
  await ensureAdminTables();
  await turso.execute({ sql: 'DELETE FROM admin_sessions WHERE token_hash = ?', args: [hash] });
}
