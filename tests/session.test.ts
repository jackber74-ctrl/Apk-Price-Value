import { describe, it, expect, beforeAll } from 'vitest';
import { checkSession, cookieOptions, signSession, verifySession, MAX_AGE } from '../src/lib/session';

beforeAll(() => {
  process.env.AUTH_SECRET ??= 'x'.repeat(40);
});

describe('sesión persistente', () => {
  it('dura ~400 días y mantiene flags seguros', () => {
    expect(MAX_AGE).toBe(60 * 60 * 24 * 400);
    expect(cookieOptions.maxAge).toBe(MAX_AGE);
    expect(cookieOptions.httpOnly).toBe(true);
    expect(cookieOptions.sameSite).toBe('lax');
  });

  it('no renueva un token recién emitido', async () => {
    const t = await signSession(7);
    expect(await verifySession(t)).toBe(7);
    expect(await checkSession(t)).toEqual({ uid: 7, renewed: null });
  });

  it('renueva un token de más de un día', async () => {
    const t = await signSession(7);
    const r = await checkSession(t, Date.now() + 2 * 86_400_000);
    expect(r?.uid).toBe(7);
    expect(r?.renewed).toBeTruthy();
    expect(await verifySession(r!.renewed)).toBe(7);
  });

  it('rechaza tokens inválidos o vacíos', async () => {
    expect(await checkSession('basura')).toBeNull();
    expect(await checkSession('')).toBeNull();
  });
});
