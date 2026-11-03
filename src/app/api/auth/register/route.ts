import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { signSession, COOKIE, cookieOptions } from '@/lib/session';
import { jsonError } from '@/lib/auth';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? '').trim().toLowerCase();
  const name = String(body.name ?? '').trim().slice(0, 120);
  const password = String(body.password ?? '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError('Escribe un correo válido.');
  if (password.length < 8) return jsonError('La contraseña debe tener al menos 8 caracteres.');
  const exists = await query('SELECT 1 FROM users WHERE email = $1', [email]);
  if (exists.length) return jsonError('Ya existe una cuenta con ese correo.', 409);
  const hash = await bcrypt.hash(password, 10);
  const [user] = await query<{ id: number }>(
    'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id',
    [email, name, hash],
  );
  await query('INSERT INTO settings (user_id, business_name) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
    user.id,
    name || 'Mi emprendimiento',
  ]);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await signSession(user.id), cookieOptions);
  return res;
}
