import { turso } from '@/lib/turso';

const CREATE_ANALYTICS_TABLE = `
  CREATE TABLE IF NOT EXISTS analytics_events (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    event_name TEXT,
    os_name TEXT,
    os_version TEXT,
    device_vendor TEXT,
    device_brand TEXT,
    device_type TEXT,
    screen_metrics TEXT,
    screen_resolution TEXT,
    metadata TEXT,
    created_at TEXT
  )
`;

const REQUIRED_COLUMNS = [
  ['id', 'TEXT'],
  ['session_id', 'TEXT'],
  ['event_name', 'TEXT'],
  ['os_name', 'TEXT'],
  ['os_version', 'TEXT'],
  ['device_vendor', 'TEXT'],
  ['device_brand', 'TEXT'],
  ['device_type', 'TEXT'],
  ['screen_metrics', 'TEXT'],
  ['screen_resolution', 'TEXT'],
  ['metadata', 'TEXT'],
  ['created_at', 'TEXT'],
] as const;

export async function ensureAnalyticsEventsTable(): Promise<void> {
  await turso.execute(CREATE_ANALYTICS_TABLE);
  const tableInfo = await turso.execute('PRAGMA table_info(analytics_events)');
  const existing = new Set(
    tableInfo.rows.map((row) => String((row as Record<string, unknown>).name ?? '')),
  );

  for (const [name, type] of REQUIRED_COLUMNS) {
    if (!existing.has(name)) {
      await turso.execute(`ALTER TABLE analytics_events ADD COLUMN ${name} ${type}`);
    }
  }
}
