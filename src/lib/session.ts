// Sesión firmada en una cookie httpOnly. Funciona también en el middleware (edge).
import { SignJWT, jwtVerify } from 'jose';

export const COOKIE = 'apv_session';
// La sesión no caduca mientras se use: dura 400 días (el máximo que aceptan los
// navegadores) y se renueva sola en cada visita (ver middleware). Solo termina al
// cerrar sesión o tras 400 días sin abrir la app.
export const MAX_AGE = 60 * 60 * 24 * 400;
/** Renueva el token si se emitió hace más de esto (evita reescribir la cookie en cada petición). */
const RENEW_AFTER = 60 * 60 * 24;

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('AUTH_SECRET debe tener al menos 32 caracteres.');
  return new TextEncoder().encode(secret);
}

export const sessionKey = key;

export async function signSession(userId: number) {
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
}

async function readSession(token?: string | null): Promise<{ uid: number; iat: number } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (typeof payload.uid !== 'number') return null;
    return { uid: payload.uid, iat: typeof payload.iat === 'number' ? payload.iat : 0 };
  } catch {
    return null;
  }
}

export async function verifySession(token?: string | null): Promise<number | null> {
  return (await readSession(token))?.uid ?? null;
}

/** Valida la sesión y, si conviene, devuelve un token nuevo para alargarla (renovación deslizante). */
export async function checkSession(token?: string | null, now = Date.now()): Promise<{ uid: number; renewed: string | null } | null> {
  const s = await readSession(token);
  if (!s) return null;
  const age = Math.floor(now / 1000) - s.iat;
  return { uid: s.uid, renewed: age > RENEW_AFTER ? await signSession(s.uid) : null };
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: MAX_AGE,
};
