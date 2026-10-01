import { turso } from '@/lib/turso';

const DAILY_SCAN_LIMIT = 2;

const CREATE_SCAN_LIMITS_TABLE = `
  CREATE TABLE IF NOT EXISTS scan_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    scan_date TEXT NOT NULL,
    scan_count INTEGER NOT NULL DEFAULT 0,
    UNIQUE (device_id, ip_hash, scan_date)
  )
`;

let schemaReady: Promise<void> | null = null;

async function ensureScanLimitsTable(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const table = await turso.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'scan_limits'",
      );

      if (table.rows.length === 0) {
        await turso.execute(CREATE_SCAN_LIMITS_TABLE);
        return;
      }

      const columns = await turso.execute('PRAGMA table_info(scan_limits)');
      const columnNames = new Set(
        columns.rows.map((row) => String((row as Record<string, unknown>).name)),
      );

      // Rebuild the original client-device table so existing limits survive the upgrade.
      if (!columnNames.has('id') || !columnNames.has('ip_hash')) {
        await turso.execute('ALTER TABLE scan_limits RENAME TO scan_limits_legacy');
        await turso.execute(CREATE_SCAN_LIMITS_TABLE);
        await turso.execute(`
          INSERT INTO scan_limits (device_id, ip_hash, scan_date, scan_count)
          SELECT device_id, 'legacy', scan_date, scan_count
          FROM scan_limits_legacy
        `);
        await turso.execute('DROP TABLE scan_limits_legacy');
      }
    })();
  }
  await schemaReady;
}

export async function checkScanLimit(
  deviceId: string,
  ipHash: string,
): Promise<{ allowed: boolean; remaining: number }> {
  await ensureScanLimitsTable();

  const result = await turso.execute({
    sql: `
      INSERT INTO scan_limits (device_id, ip_hash, scan_date, scan_count)
      SELECT ?, ?, CURRENT_DATE, 1
      WHERE COALESCE((
        SELECT SUM(scan_count)
        FROM scan_limits
        WHERE scan_date = CURRENT_DATE AND (device_id = ? OR ip_hash = ?)
      ), 0) < ?
      ON CONFLICT (device_id, ip_hash, scan_date) DO UPDATE
      SET scan_count = scan_count + 1
      WHERE COALESCE((
        SELECT SUM(scan_count)
        FROM scan_limits
        WHERE scan_date = CURRENT_DATE AND (device_id = ? OR ip_hash = ?)
      ), 0) < ?
      RETURNING scan_count
    `,
    args: [
      deviceId,
      ipHash,
      deviceId,
      ipHash,
      DAILY_SCAN_LIMIT,
      deviceId,
      ipHash,
      DAILY_SCAN_LIMIT,
    ],
  });

  if (result.rows.length === 0) {
    return { allowed: false, remaining: 0 };
  }

  const total = await turso.execute({
    sql: `
      SELECT COALESCE(SUM(scan_count), 0) AS scan_count
      FROM scan_limits
      WHERE scan_date = CURRENT_DATE AND (device_id = ? OR ip_hash = ?)
    `,
    args: [deviceId, ipHash],
  });
  const scanCount = Number(
    (total.rows[0] as Record<string, unknown> | undefined)?.scan_count,
  );

  return {
    allowed: true,
    remaining: Number.isFinite(scanCount)
      ? Math.max(0, DAILY_SCAN_LIMIT - scanCount)
      : 0,
  };
}
