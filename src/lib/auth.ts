import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { COOKIE, verifySession } from './session';

export async function currentUserId() {
  const store = await cookies();
  return verifySession(store.get(COOKIE)?.value);
}

/** Devuelve el id del usuario o una respuesta 401 lista para retornar. */
export async function requireUser(): Promise<number | NextResponse> {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: 'Inicia sesión para continuar.' }, { status: 401 });
  return uid;
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
