import { NextResponse } from 'next/server';
import { requireUser, jsonError } from '@/lib/auth';
import { PayuError, cancelSubscription } from '@/lib/payu-recurring';
import { RapydError, cancelRapyd } from '@/lib/rapyd';
import { query } from '@/lib/db';

/** Cancela el cobro automático (en la pasarela donde esté). El plan sigue hasta su fecha de vencimiento. */
export async function POST() {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const rows = await query<{ provider: string }>(`SELECT DISTINCT provider FROM subscriptions WHERE user_id=$1 AND status IN ('active','pending')`, [uid]);
  let n = 0;
  try {
    if (rows.some((r) => r.provider === 'rapyd')) n += await cancelRapyd(uid);
    if (rows.some((r) => r.provider === 'payu')) n += await cancelSubscription(uid);
    return NextResponse.json({ ok: true, canceled: n });
  } catch (e) {
    const why = e instanceof PayuError || e instanceof RapydError ? e.message : 'error inesperado';
    return jsonError(`No se pudo cancelar el cobro automático: ${why}`, 502);
  }
}
