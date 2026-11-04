import { NextResponse } from 'next/server';
import { OAUTH_COOKIE, OAUTH_COOKIE_PATH, PROVIDERS, baseUrl, callbackUrl, isProvider, verifyState } from '@/lib/oauth';
import { resolveUser } from '@/lib/oauth-users';
import { COOKIE, cookieOptions, signSession } from '@/lib/session';

function cookieValue(req: Request, name: string) {
  const header = req.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const url = new URL(req.url);
  const back = (code: string) => {
    const res = NextResponse.redirect(new URL(`/login?error=${code}`, baseUrl(req)));
    res.cookies.set(OAUTH_COOKIE, '', { path: OAUTH_COOKIE_PATH, maxAge: 0 });
    return res;
  };

  if (!isProvider(provider)) return back('provider');
  if (url.searchParams.get('error')) return back('cancelled');

  const saved = await verifyState(cookieValue(req, OAUTH_COOKIE));
  const code = url.searchParams.get('code');
  if (!saved || saved.provider !== provider || saved.state !== url.searchParams.get('state') || !code) return back('state');

  const creds = PROVIDERS[provider].creds();
  if (!creds) return back('provider');

  try {
    const profile = await PROVIDERS[provider].fetchProfile({ code, redirectUri: callbackUrl(req, provider), creds });
    const userId = await resolveUser(provider, profile);
    const res = NextResponse.redirect(new URL(saved.next, baseUrl(req)));
    res.cookies.set(COOKIE, await signSession(userId), cookieOptions);
    res.cookies.set(OAUTH_COOKIE, '', { path: OAUTH_COOKIE_PATH, maxAge: 0 });
    return res;
  } catch (e) {
    console.error('[oauth]', provider, (e as Error).message);
    return back('failed');
  }
}
