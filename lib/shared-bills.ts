import { createHash, randomBytes } from 'node:crypto';
import type { SharedBill } from '@/app/lib/sharedBill';
import { hasTursoConfiguration, turso } from '@/lib/turso';

const BILL_LIFETIME_MS = 3 * 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60_000;
const EXPIRY_BYTES = 6;
const TOKEN_BYTES = EXPIRY_BYTES + 16;

let schemaReady: Promise<void> | undefined;
let nextCleanupAt = 0;

function ensureSchema(): Promise<void> {
  schemaReady ??= turso.batch([
    `CREATE TABLE IF NOT EXISTS shared_bills (
      token_hash TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL,
      payload TEXT NOT NULL
    )`,
    'CREATE INDEX IF NOT EXISTS shared_bills_expiry ON shared_bills(expires_at)',
  ], 'write').then(() => undefined).catch((error: unknown) => {
    schemaReady = undefined;
    throw error;
  });
  return schemaReady;
}

function tokenHash(id: string): string {
  return createHash('sha256').update(id).digest('hex');
}

async function cleanExpiredBills(): Promise<void> {
  const now = Date.now();
  if (now < nextCleanupAt) return;
  nextCleanupAt = now + CLEANUP_INTERVAL_MS;
  try {
    await turso.execute({ sql: 'DELETE FROM shared_bills WHERE expires_at <= ?', args: [now] });
  } catch {
    console.error('[SHARED BILL CLEANUP FAILED]');
  }
}

export async function saveSharedBill(bill: SharedBill): Promise<string> {
  await ensureSchema();
  await cleanExpiredBills();
  const expiresAt = Date.now() + BILL_LIFETIME_MS;
  const token = randomBytes(TOKEN_BYTES);
  token.writeUIntBE(expiresAt, 0, EXPIRY_BYTES);
  const id = token.toString('base64url');
  await turso.execute({
    sql: 'INSERT INTO shared_bills (token_hash, expires_at, payload) VALUES (?, ?, ?)',
    args: [tokenHash(id), expiresAt, JSON.stringify(bill)],
  });
  return id;
}

type BillLookup = { status: 'found'; bill: SharedBill } | { status: 'expired' | 'missing' | 'unavailable' };

export async function getSharedBill(id: string): Promise<BillLookup> {
  if (!/^[A-Za-z0-9_-]{30}$/.test(id)) return { status: 'missing' };
  const token = Buffer.from(id, 'base64url');
  if (token.length !== TOKEN_BYTES || token.toString('base64url') !== id) return { status: 'missing' };

  const expiresAt = token.readUIntBE(0, EXPIRY_BYTES);
  if (!hasTursoConfiguration) return { status: 'unavailable' };
  try {
    await ensureSchema();
    await cleanExpiredBills();
    if (expiresAt <= Date.now()) return { status: 'expired' };

    const { rows } = await turso.execute({
      sql: 'SELECT payload FROM shared_bills WHERE token_hash = ? AND expires_at > ?',
      args: [tokenHash(id), Date.now()],
    });
    if (expiresAt <= Date.now()) return { status: 'expired' };
    const payload = rows[0]?.payload;
    if (typeof payload !== 'string') return { status: 'missing' };
    return { status: 'found', bill: JSON.parse(payload) as SharedBill };
  } catch {
    console.error('[SHARED BILL LOOKUP FAILED]');
    return { status: 'unavailable' };
  }
}
