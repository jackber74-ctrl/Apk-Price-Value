import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { RESOURCES } from '@/lib/resources';

/** Copia de todos los datos de la persona en un archivo JSON (derecho de acceso, Ley 1581 de 2012). */
export async function GET() {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;

  const [user] = await query(
    'SELECT id, email, name, created_at, accepted_terms_at, terms_version, brand_color, biz_nit, biz_phone, biz_email, biz_address FROM users WHERE id = $1',
    [uid],
  );
  const data: Record<string, unknown> = {
    exportado_el: new Date().toISOString(),
    cuenta: user,
    metodos_de_acceso: await query('SELECT provider, email, created_at FROM identities WHERE user_id = $1', [uid]),
    configuracion: await query('SELECT * FROM settings WHERE user_id = $1', [uid]),
  };
  for (const [name, res] of Object.entries(RESOURCES)) {
    data[name] = await query(`SELECT * FROM ${res.table} WHERE user_id = $1 ORDER BY id`, [uid]);
  }

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="mis-datos-apk-price-value.json"',
      'Cache-Control': 'no-store',
    },
  });
}
