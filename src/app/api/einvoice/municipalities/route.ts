import { NextResponse } from 'next/server';
import { requireUser, jsonError } from '@/lib/auth';
import { requireFeature } from '@/lib/plan-server';
import { credsFor, providerError } from '@/lib/einvoice-server';
import { municipalities } from '@/lib/factus';

export async function GET(req: Request) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const denied = await requireFeature(uid, 'save');
  if (denied) return denied;
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 60);
  if (q.length < 3) return jsonError('Escribe al menos 3 letras del municipio.');
  const r = await credsFor(uid);
  if (r instanceof NextResponse) return r;
  try {
    return NextResponse.json({ municipalities: await municipalities(r.c, q) });
  } catch (e) {
    return providerError(e);
  }
}
