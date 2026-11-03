import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, verifySession } from './lib/session';

export async function middleware(req: NextRequest) {
  const uid = await verifySession(req.cookies.get(COOKIE)?.value);
  if (!uid) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/app/:path*'] };
