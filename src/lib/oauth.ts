// Inicio de sesión con Google, Facebook y TikTok (flujo OAuth 2.0 de código de autorización).
// Cada proveedor solo aparece si sus claves están en las variables de entorno.
import { SignJWT, jwtVerify } from 'jose';
import { sessionKey } from './session';

export type ProviderId = 'google' | 'facebook' | 'tiktok';

export type Profile = {
  id: string;
  name: string;
  email: string | null;
  /** Solo es true cuando el proveedor garantiza que el correo es de la persona (Google). */
  emailVerified: boolean;
};

type Creds = { id: string; secret: string };

type ProviderDef = {
  label: string;
  creds: () => Creds | null;
  authorizeUrl: (c: { clientId: string; redirectUri: string; state: string }) => string;
  fetchProfile: (c: { code: string; redirectUri: string; creds: Creds }) => Promise<Profile>;
};

const FB_VERSION = 'v23.0';

/** Error del proveedor con su código corto (por ejemplo invalid_client o redirect_uri_mismatch). */
export class ProviderError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

async function json(res: Response, what: string) {
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    const raw = typeof data?.error === 'string' ? data.error : data?.error?.type ?? data?.error?.message ?? '';
    const code = String(raw).toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 40) || `http_${res.status}`;
    throw new ProviderError(`${what}: respuesta ${res.status} (${code}) ${data?.error_description ?? ''}`.trim(), code);
  }
  return data as Record<string, any>;
}

function envCreds(idKey: string, secretKey: string): Creds | null {
  const id = process.env[idKey]?.trim();
  const secret = process.env[secretKey]?.trim();
  return id && secret ? { id, secret } : null;
}

export const PROVIDERS: Record<ProviderId, ProviderDef> = {
  google: {
    label: 'Google',
    creds: () => envCreds('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'),
    authorizeUrl: ({ clientId, redirectUri, state }) =>
      'https://accounts.google.com/o/oauth2/v2/auth?' +
      new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        prompt: 'select_account',
      }),
    async fetchProfile({ code, redirectUri, creds }) {
      const token = await json(
        await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: creds.id,
            client_secret: creds.secret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        }),
        'Google token',
      );
      const me = await json(
        await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
          headers: { Authorization: `Bearer ${token.access_token}` },
        }),
        'Google perfil',
      );
      if (!me.sub) throw new Error('Google no devolvió el identificador.');
      return {
        id: String(me.sub),
        name: String(me.name ?? ''),
        email: me.email ? String(me.email) : null,
        emailVerified: me.email_verified === true,
      };
    },
  },

  facebook: {
    label: 'Facebook',
    creds: () => envCreds('FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'),
    authorizeUrl: ({ clientId, redirectUri, state }) =>
      `https://www.facebook.com/${FB_VERSION}/dialog/oauth?` +
      new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'public_profile,email',
        state,
      }),
    async fetchProfile({ code, redirectUri, creds }) {
      const token = await json(
        await fetch(
          `https://graph.facebook.com/${FB_VERSION}/oauth/access_token?` +
            new URLSearchParams({ client_id: creds.id, client_secret: creds.secret, redirect_uri: redirectUri, code }),
        ),
        'Facebook token',
      );
      const me = await json(
        await fetch(
          `https://graph.facebook.com/${FB_VERSION}/me?` +
            new URLSearchParams({ fields: 'id,name,email', access_token: String(token.access_token) }),
        ),
        'Facebook perfil',
      );
      if (!me.id) throw new Error('Facebook no devolvió el identificador.');
      // El correo de Facebook no se usa para unir cuentas, por eso emailVerified es false.
      return { id: String(me.id), name: String(me.name ?? ''), email: me.email ? String(me.email) : null, emailVerified: false };
    },
  },

  tiktok: {
    label: 'TikTok',
    creds: () => envCreds('TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'),
    authorizeUrl: ({ clientId, redirectUri, state }) =>
      'https://www.tiktok.com/v2/auth/authorize/?' +
      new URLSearchParams({
        client_key: clientId,
        scope: 'user.info.basic',
        response_type: 'code',
        redirect_uri: redirectUri,
        state,
      }),
    async fetchProfile({ code, redirectUri, creds }) {
      const token = await json(
        await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
          body: new URLSearchParams({
            client_key: creds.id,
            client_secret: creds.secret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
          }),
        }),
        'TikTok token',
      );
      const info = await json(
        await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name', {
          headers: { Authorization: `Bearer ${token.access_token}` },
        }),
        'TikTok perfil',
      );
      const user = info.data?.user;
      const id = user?.open_id ?? token.open_id;
      if (!id) throw new Error('TikTok no devolvió el identificador.');
      // TikTok no comparte el correo.
      return { id: String(id), name: String(user?.display_name ?? ''), email: null, emailVerified: false };
    },
  },
};

export function isProvider(id: string): id is ProviderId {
  return id === 'google' || id === 'facebook' || id === 'tiktok';
}

export function enabledProviders() {
  return (Object.keys(PROVIDERS) as ProviderId[]).filter((id) => PROVIDERS[id].creds());
}

/** Dirección pública de la app. Debe coincidir con la que registras en cada proveedor. */
export function baseUrl(req: Request) {
  const fixed = process.env.APP_URL?.trim().replace(/\/+$/, '');
  if (fixed && /^https?:\/\//.test(fixed)) return fixed;
  return new URL(req.url).origin;
}

export const callbackUrl = (req: Request, provider: ProviderId) => `${baseUrl(req)}/api/auth/oauth/${provider}/callback`;

/** Solo permite volver a páginas internas de la app. */
export function safeNext(value: string | null | undefined) {
  return value && /^\/app(\/[\w\-./]*)?$/.test(value) ? value : '/app/calculadora';
}

// El "state" viaja en una cookie firmada para comprobar que el regreso del proveedor es el que iniciamos.
export const OAUTH_COOKIE = 'apv_oauth';
export const OAUTH_COOKIE_PATH = '/api/auth/oauth';

export async function signState(payload: { provider: ProviderId; state: string; next: string }) {
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('10m').sign(sessionKey());
}

export async function verifyState(token?: string | null) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey());
    return payload as unknown as { provider: ProviderId; state: string; next: string };
  } catch {
    return null;
  }
}
