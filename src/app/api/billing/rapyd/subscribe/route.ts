import { NextResponse } from 'next/server';
import { requireUser, jsonError } from '@/lib/auth';
import { isPeriod, isPlanId, planLevel } from '@/lib/plans';
import { provider } from '@/lib/billing';
import { RapydError, createSubscriptionPage, rapydRecurring } from '@/lib/rapyd';
import { baseUrl } from '@/lib/oauth';
import { getPlan } from '@/lib/plan-server';

/** Cobro automático con Rapyd: devuelve { url } de su página de suscripción, donde la persona pone su tarjeta. */
export async function POST(req: Request) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const body = await req.json().catch(() => ({}));
  if (!isPlanId(body.plan) || body.plan === 'free' || !isPeriod(body.period)) return jsonError('Plan o periodo no válido.');
  if (provider() !== 'rapyd' || !rapydRecurring()) return jsonError('El cobro automático todavía no está activo.', 503);

  const { plan: current, row } = await getPlan(uid);
  if (row?.plan_lifetime) return jsonError('Ya tienes el plan de por vida con todo incluido.', 409);
  if (planLevel(current) > planLevel(body.plan)) return jsonError('Tu plan actual ya incluye este.', 409);

  try {
    return NextResponse.json({ url: await createSubscriptionPage({ uid, plan: body.plan, period: body.period, base: baseUrl(req) }) });
  } catch (e) {
    const why = e instanceof RapydError ? e.message : 'Error inesperado en el servidor; revisa los registros de Vercel.';
    if (!(e instanceof RapydError)) console.error('Rapyd suscripción', e instanceof Error ? e.message : e);
    return jsonError(`No pudimos iniciar el cobro automático con Rapyd. ${why}`, 502);
  }
}
