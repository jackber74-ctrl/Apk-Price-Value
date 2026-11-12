import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/auth';
import { checkReset, consumeReset } from '@/lib/password-reset';
import { COOKIE, cookieOptions, signSession } from '@/lib/session';

const EXPIRED = 'El enlace venció o ya se usó. Pide uno nuevo desde «¿Olvidaste tu contraseña?».';

/** Revisa si el enlace sirve antes de mostrar el formulario. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token') ?? '';
  return NextResponse.json({ valid: await checkReset(token) });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = String(body.token ?? '');
  const password = String(body.password ?? '');
  if (password.length < 8) return jsonError('La contraseña debe tener al menos 8 caracteres.');
  const userId = await consumeReset(token, password);
  if (!userId) return jsonError(EXPIRED, 400);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await signSession(userId), cookieOptions);
  return res;
}
