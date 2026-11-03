// Sesión firmada en una cookie httpOnly. Funciona también en el middleware (edge).
import { SignJWT, jwtVerify } from 'jose';

export const COOKIE = 'apv_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 días

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('AUTH_SECRET debe tener al menos 32 caracteres.');
  return new TextEncoder().encode(secret);
}

export async function signSession(userId: number) {
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
}

export async function verifySession(token?: string | null): Promise<number | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return typeof payload.uid === 'number' ? payload.uid : null;
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: MAX_AGE,
};
