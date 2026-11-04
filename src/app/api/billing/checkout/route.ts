import { NextResponse } from 'next/server';
import { requireUser, jsonError } from '@/lib/auth';
import { isPeriod, isPlanId } from '@/lib/plans';

/**
 * Inicia el pago de un plan. Todavía no hay una pasarela de pagos conectada, así que responde 503 con un aviso claro.
 * Cuando se elija la pasarela (Mercado Pago, Lemon Squeezy, Paddle…), aquí se crea la sesión de pago y se devuelve { url }.
 */
export async function POST(req: Request) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const body = await req.json().catch(() => ({}));
  if (!isPlanId(body.plan) || body.plan === 'free' || !isPeriod(body.period)) return jsonError('Plan o periodo no válido.');
  return jsonError('Los pagos se activan muy pronto. Vuelve a intentarlo en unos días.', 503);
}
