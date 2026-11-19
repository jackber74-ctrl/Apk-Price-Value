import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { requireFeature } from '@/lib/plan-server';
import { credsFor, providerError } from '@/lib/einvoice-server';
import { numberingRanges } from '@/lib/factus';

/** Prueba la conexión y trae las resoluciones de numeración de la cuenta de Factus. */
export async function GET() {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const denied = await requireFeature(uid, 'save');
  if (denied) return denied;
  const r = await credsFor(uid);
  if (r instanceof NextResponse) return r;
  try {
    return NextResponse.json({ ranges: await numberingRanges(r.c) });
  } catch (e) {
    return providerError(e);
  }
}
