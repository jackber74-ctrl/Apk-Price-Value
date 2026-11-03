import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { signSession, COOKIE, cookieOptions } from '@/lib/session';
import { jsonError } from '@/lib/auth';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const [user] = await query<{ id: number; password_hash: string }>(
    'SELECT id, password_hash FROM users WHERE email = $1',
    [email],
  );
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return jsonError('Correo o contraseña incorrectos.', 401);
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await signSession(user.id), cookieOptions);
  return res;
}
