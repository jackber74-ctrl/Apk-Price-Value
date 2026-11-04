import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { OAUTH_COOKIE, OAUTH_COOKIE_PATH, PROVIDERS, baseUrl, callbackUrl, isProvider, safeNext, signState } from '@/lib/oauth';

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const fail = (code: string) => NextResponse.redirect(new URL(`/login?error=${code}`, baseUrl(req)));
  if (!isProvider(provider)) return fail('provider');
  const creds = PROVIDERS[provider].creds();
  if (!creds) return fail('provider');

  const state = randomBytes(24).toString('base64url');
  const next = safeNext(new URL(req.url).searchParams.get('next'));
  const target = PROVIDERS[provider].authorizeUrl({ clientId: creds.id, redirectUri: callbackUrl(req, provider), state });

  const res = NextResponse.redirect(target);
  res.cookies.set(OAUTH_COOKIE, await signState({ provider, state, next }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: OAUTH_COOKIE_PATH,
    maxAge: 600,
  });
  return res;
}
