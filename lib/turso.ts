import { createClient } from '@libsql/client';

export const hasTursoConfiguration = Boolean(process.env.TURSO_DATABASE_URL);

export const turso = createClient({
  url: process.env.TURSO_DATABASE_URL ?? 'file::memory:',
  authToken: process.env.TURSO_AUTH_TOKEN,
});
