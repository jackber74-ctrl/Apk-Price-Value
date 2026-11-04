import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireUser, jsonError } from '@/lib/auth';
import { isHex, isLogo } from '@/lib/brand';

const COLS = 'name, logo, brand_color, biz_nit, biz_phone, biz_email, biz_address';

export async function GET() {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const [profile] = await query(`SELECT ${COLS} FROM users WHERE id = $1`, [uid]);
  return NextResponse.json({ profile });
}

/** Guarda el logo y los datos del negocio que salen en las cotizaciones. */
export async function PUT(req: Request) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const logo = b.logo ? String(b.logo) : null;
  if (logo && !isLogo(logo)) return jsonError('El logo debe ser una imagen PNG, JPG o WebP de máximo 300 KB.');
  const color = b.brand_color ? String(b.brand_color) : null;
  if (color && !isHex(color)) return jsonError('El color no es válido.');
  const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
  const [profile] = await query(
    `UPDATE users SET name = $2, logo = $3, brand_color = $4, biz_nit = $5, biz_phone = $6, biz_email = $7, biz_address = $8
     WHERE id = $1 RETURNING ${COLS}`,
    [uid, text(b.name, 120), logo, color, text(b.biz_nit, 40), text(b.biz_phone, 40), text(b.biz_email, 120), text(b.biz_address, 200)],
  );
  return NextResponse.json({ profile });
}
