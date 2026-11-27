import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, checkSession, cookieOptions } from './lib/session';

export async function middleware(req: NextRequest) {
  const session = await checkSession(req.cookies.get(COOKIE)?.value);
  const isApi = req.nextUrl.pathname.startsWith('/api/');
  if (!session) {
    if (isApi) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  // Renovación deslizante: mientras la persona use la app, la sesión no caduca.
  if (session.renewed) res.cookies.set(COOKIE, session.renewed, cookieOptions);
  return res;
}

// /api/auth y /api/account quedan fuera para no reescribir la cookie al cerrar sesión o borrar la cuenta.
export const config = { matcher: ['/app/:path*', '/api/((?!auth/|account).*)'] };
