import { NextResponse } from 'next/server';
import { requireUser, jsonError } from '@/lib/auth';
import { isPeriod, isPlanId, planLevel } from '@/lib/plans';
import { getPlan } from '@/lib/plan-server';
import { PayuError, cardType, luhn, recurringEnabled, subscribe } from '@/lib/payu-recurring';

/** Suscripción con cobro automático. Los datos de la tarjeta se pasan a PayU y no se guardan ni se registran aquí. */
export async function POST(req: Request) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  if (!recurringEnabled()) return jsonError('El cobro automático todavía no está activo.', 503);
  const body = await req.json().catch(() => ({}));
  const { plan, period, card } = body ?? {};
  if (!isPlanId(plan) || plan === 'free' || !isPeriod(period)) return jsonError('Plan o periodo no válido.');

  const { plan: current, row } = await getPlan(uid);
  if (row?.plan_lifetime) return jsonError('Ya tienes el plan de por vida con todo incluido.', 409);
  if (planLevel(current) > planLevel(plan)) return jsonError('Tu plan actual ya incluye este.', 409);

  const c = {
    name: String(card?.name ?? '').trim().slice(0, 120),
    document: String(card?.document ?? '').replace(/[^\dA-Za-z]/g, '').slice(0, 20),
    number: String(card?.number ?? '').replace(/\D/g, ''),
    expMonth: String(card?.expMonth ?? '').padStart(2, '0'),
    expYear: String(card?.expYear ?? ''),
  };
  if (c.name.length < 3) return jsonError('Escribe el nombre como aparece en la tarjeta.');
  if (c.document.length < 5) return jsonError('Escribe el número de documento del titular.');
  if (!luhn(c.number) || !cardType(c.number)) return jsonError('El número de tarjeta no es válido (Visa, Mastercard, Amex o Diners).');
  const m = Number(c.expMonth);
  const y = Number(c.expYear.length === 2 ? `20${c.expYear}` : c.expYear);
  const now = new Date();
  if (!(m >= 1 && m <= 12) || y < now.getFullYear() || (y === now.getFullYear() && m < now.getMonth() + 1))
    return jsonError('La fecha de vencimiento no es válida.');
  c.expYear = String(y);

  try {
    await subscribe(uid, plan, period, c);
  } catch (e) {
    const msg = e instanceof PayuError ? e.message : 'Error inesperado.';
    console.error('PayU suscripción falló', msg); // nunca se registran datos de la tarjeta
    return jsonError(`PayU no pudo crear la suscripción: ${msg}`, 502);
  }
  const after = await getPlan(uid);
  return NextResponse.json({ ok: true, active: after.plan === plan });
}
