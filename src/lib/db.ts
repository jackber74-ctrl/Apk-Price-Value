import { Pool, types } from 'pg';

// NUMERIC llega como número y DATE como texto 'AAAA-MM-DD'.
types.setTypeParser(1700, (v) => parseFloat(v));
types.setTypeParser(1082, (v) => v);

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function makePool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta la variable DATABASE_URL.');
  return new Pool({
    connectionString: url,
    ssl: url.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
    max: 5,
  });
}

export function pool() {
  if (!globalThis.__pgPool) globalThis.__pgPool = makePool();
  return globalThis.__pgPool;
}

export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
  const res = await pool().query(text, params);
  return res.rows as T[];
}
