import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export async function GET() {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const [user] = await query('SELECT id, email, name FROM users WHERE id = $1', [uid]);
  return NextResponse.json({ user: user ?? null });
}
