// Crea o actualiza las tablas. Si no hay DATABASE_URL, no hace nada (útil en builds de prueba).
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.log('[migrate] DATABASE_URL no está definida, se omite la migración.');
  process.exit(0);
}
const sql = fs.readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8');
const client = new pg.Client({ connectionString: url, ssl: url.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined });
await client.connect();
await client.query(sql);
await client.end();
console.log('[migrate] Esquema aplicado.');
