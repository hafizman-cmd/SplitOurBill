import { createHash, randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { turso } from './turso';

const DAILY_SCAN_LIMIT = 2;
const BROWSER_ATTEMPT_LIMIT = 8;
const NETWORK_ATTEMPT_LIMIT = 60;
const RESERVATION_MS = 5 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
const MALAYSIA_OFFSET_MS = 8 * 60 * 60_000;

export function scanWindow(now = Date.now()) {
  const localNow = now + MALAYSIA_OFFSET_MS;
  return {
    date: new Date(localNow).toISOString().slice(0, 10),
    resetsAt: (Math.floor(localNow / DAY_MS) + 1) * DAY_MS - MALAYSIA_OFFSET_MS,
  };
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function scanIdentity(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') || 'unknown_ip';
  const browserId = req.headers.get('x-scan-browser');
  const browserKey = browserId && /^dev_[a-z0-9]{8,64}$/.test(browserId)
    ? browserId
    : JSON.stringify([ip, req.headers.get('user-agent')]);
  return { browserHash: hash(browserKey), ipHash: hash(ip) };
}

type ScanIdentity = ReturnType<typeof scanIdentity>;

let schemaReady: Promise<unknown> | undefined;

async function ensureScanAttemptsTable() {
  schemaReady ??= turso.batch([
    `CREATE TABLE IF NOT EXISTS scan_attempts (
      id TEXT PRIMARY KEY,
      scan_date TEXT NOT NULL,
      browser_hash TEXT NOT NULL,
      ip_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed'))
    )`,
    'CREATE INDEX IF NOT EXISTS scan_attempts_browser ON scan_attempts(scan_date, browser_hash)',
    'CREATE INDEX IF NOT EXISTS scan_attempts_network ON scan_attempts(scan_date, ip_hash)',
  ], 'write').catch((error: unknown) => {
    schemaReady = undefined;
    throw error;
  });
  await schemaReady;
}

let lastCleanupDate = '';

async function pruneOldAttempts(now: number) {
  const { date } = scanWindow(now);
  if (date <= lastCleanupDate) return;
  lastCleanupDate = date;
  try {
    await turso.execute({
      sql: 'DELETE FROM scan_attempts WHERE scan_date < ?',
      args: [scanWindow(now - DAY_MS).date],
    });
  } catch {
    if (lastCleanupDate === date) lastCleanupDate = '';
    console.error('[scan] could not prune scan attempts.');
  }
}

export async function getScanAllowance({ browserHash, ipHash }: ScanIdentity, now = Date.now()) {
  await ensureScanAttemptsTable();
  const { date, resetsAt } = scanWindow(now);
  const { rows: [counts] } = await turso.execute({
    sql: `SELECT COUNT(*) AS attempts,
      COUNT(CASE WHEN status = 'success' THEN 1 END) AS successful,
      COUNT(CASE WHEN status = 'pending' AND expires_at > ? THEN 1 END) AS pending,
      (SELECT COUNT(*) FROM scan_attempts WHERE scan_date = ? AND ip_hash = ?) AS network_attempts
      FROM scan_attempts WHERE scan_date = ? AND browser_hash = ?`,
    args: [now, date, ipHash, date, browserHash],
  });
  const remaining = Math.max(0, DAILY_SCAN_LIMIT - Number(counts.successful));
  return {
    remaining,
    pending: Number(counts.pending),
    browserAttemptsExhausted: Number(counts.attempts) >= BROWSER_ATTEMPT_LIMIT,
    networkAttemptsExhausted: Number(counts.network_attempts) >= NETWORK_ATTEMPT_LIMIT,
    resetsAt,
  };
}

export async function reserveScan({ browserHash, ipHash }: ScanIdentity) {
  await ensureScanAttemptsTable();
  const now = Date.now();
  const { date } = scanWindow(now);
  const id = randomUUID();
  const result = await turso.execute({
    sql: `INSERT INTO scan_attempts (id, scan_date, browser_hash, ip_hash, expires_at)
      SELECT ?, ?, ?, ?, ?
      WHERE (SELECT COUNT(*) FROM scan_attempts WHERE scan_date = ? AND browser_hash = ?
        AND (status = 'success' OR (status = 'pending' AND expires_at > ?))) < ?
      AND (SELECT COUNT(*) FROM scan_attempts WHERE scan_date = ? AND browser_hash = ?) < ?
      AND (SELECT COUNT(*) FROM scan_attempts WHERE scan_date = ? AND ip_hash = ?) < ?`,
    args: [
      id, date, browserHash, ipHash, now + RESERVATION_MS,
      date, browserHash, now, DAILY_SCAN_LIMIT,
      date, browserHash, BROWSER_ATTEMPT_LIMIT,
      date, ipHash, NETWORK_ATTEMPT_LIMIT,
    ],
  });
  await pruneOldAttempts(now);
  return result.rowsAffected === 1 ? id : null;
}

export async function settleScan(id: string, status: 'success' | 'failed') {
  const result = await turso.execute({
    sql: `UPDATE scan_attempts SET status = ?
      WHERE id = ? AND status = 'pending' AND (? = 'failed' OR expires_at > ?)`,
    args: [status, id, status, Date.now()],
  });
  return result.rowsAffected === 1;
}
