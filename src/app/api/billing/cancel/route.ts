import { NextResponse } from 'next/server';
import { requireUser, jsonError } from '@/lib/auth';
import { PayuError, cancelSubscription } from '@/lib/payu-recurring';

/** Cancela el cobro automático. El plan sigue hasta su fecha de vencimiento. */
export async function POST() {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  try {
    const n = await cancelSubscription(uid);
    return NextResponse.json({ ok: true, canceled: n });
  } catch (e) {
    return jsonError(`No se pudo cancelar en PayU: ${e instanceof PayuError ? e.message : 'error inesperado'}`, 502);
  }
}
