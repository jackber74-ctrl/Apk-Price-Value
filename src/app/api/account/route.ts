import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireUser, jsonError } from '@/lib/auth';
import { COOKIE } from '@/lib/session';

export async function GET() {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const [user] = await query(
    'SELECT id, email, name, created_at, accepted_terms_at, terms_version, (password_hash IS NOT NULL) AS has_password FROM users WHERE id = $1',
    [uid],
  );
  const identities = await query('SELECT provider FROM identities WHERE user_id = $1 ORDER BY provider', [uid]);
  return NextResponse.json({ user, providers: identities.map((i) => (i as { provider: string }).provider) });
}

/** Elimina la cuenta y todos sus datos (las tablas se borran en cascada). */
export async function DELETE(req: Request) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const body = await req.json().catch(() => ({}));
  if (body.confirm !== 'ELIMINAR') return jsonError('Escribe ELIMINAR para confirmar.');
  await query('DELETE FROM users WHERE id = $1', [uid]);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
