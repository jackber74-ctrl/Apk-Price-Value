import { afterEach, beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-test-secret-test-secret-123';
});

const KEYS = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET', 'TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'];
afterEach(() => KEYS.forEach((k) => delete process.env[k]));

describe('proveedores de inicio de sesión', () => {
  it('solo aparecen los que tienen las dos claves', async () => {
    const { enabledProviders } = await import('../src/lib/oauth');
    expect(enabledProviders()).toEqual([]);
    process.env.GOOGLE_CLIENT_ID = 'id';
    expect(enabledProviders()).toEqual([]);
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
    process.env.TIKTOK_CLIENT_KEY = 'k';
    process.env.TIKTOK_CLIENT_SECRET = 's';
    expect(enabledProviders()).toEqual(['google', 'tiktok']);
  });

  it('arma la dirección de autorización de cada proveedor', async () => {
    const { PROVIDERS } = await import('../src/lib/oauth');
    const args = { clientId: 'CID', redirectUri: 'https://app.test/api/auth/oauth/x/callback', state: 'ST' };

    const g = new URL(PROVIDERS.google.authorizeUrl(args));
    expect(g.origin + g.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(g.searchParams.get('client_id')).toBe('CID');
    expect(g.searchParams.get('scope')).toBe('openid email profile');
    expect(g.searchParams.get('state')).toBe('ST');
    expect(g.searchParams.get('redirect_uri')).toBe(args.redirectUri);

    const f = new URL(PROVIDERS.facebook.authorizeUrl(args));
    expect(f.hostname).toBe('www.facebook.com');
    expect(f.searchParams.get('scope')).toBe('public_profile,email');

    const t = new URL(PROVIDERS.tiktok.authorizeUrl(args));
    expect(t.origin + t.pathname).toBe('https://www.tiktok.com/v2/auth/authorize/');
    expect(t.searchParams.get('client_key')).toBe('CID');
    expect(t.searchParams.get('scope')).toBe('user.info.basic');
  });

  it('solo vuelve a páginas internas de la app', async () => {
    const { safeNext } = await import('../src/lib/oauth');
    expect(safeNext('/app/avanzado/gastos')).toBe('/app/avanzado/gastos');
    expect(safeNext('https://malo.com')).toBe('/app/calculadora');
    expect(safeNext('//malo.com')).toBe('/app/calculadora');
    expect(safeNext('/appx')).toBe('/app/calculadora');
    expect(safeNext(null)).toBe('/app/calculadora');
  });

  it('firma el estado y rechaza uno alterado', async () => {
    const { signState, verifyState } = await import('../src/lib/oauth');
    const token = await signState({ provider: 'google', state: 'abc', next: '/app/calculadora' });
    expect(await verifyState(token)).toMatchObject({ provider: 'google', state: 'abc' });
    expect(await verifyState(token + 'x')).toBeNull();
    expect(await verifyState(null)).toBeNull();
  });
});
