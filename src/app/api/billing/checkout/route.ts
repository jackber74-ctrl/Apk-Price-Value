import { NextResponse } from 'next/server';
import { requireUser, jsonError } from '@/lib/auth';
import { isPeriod, isPlanId, PERIOD_LABEL, PLANS, planLevel } from '@/lib/plans';
import { billingEnabled, chargeAmount, currency, makeReference } from '@/lib/billing';
import { baseUrl } from '@/lib/oauth';
import { getPlan } from '@/lib/plan-server';

/** Crea una preferencia de Checkout Pro en Mercado Pago y devuelve { url } para llevar a la persona a pagar. */
export async function POST(req: Request) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const body = await req.json().catch(() => ({}));
  if (!isPlanId(body.plan) || body.plan === 'free' || !isPeriod(body.period)) return jsonError('Plan o periodo no válido.');
  if (!billingEnabled()) return jsonError('Los pagos se activan muy pronto. Vuelve a intentarlo en unos días.', 503);

  const { plan: current, row } = await getPlan(uid);
  if (row?.plan_lifetime) return jsonError('Ya tienes el plan de por vida con todo incluido.', 409);
  if (planLevel(current) > planLevel(body.plan)) return jsonError('Tu plan actual ya incluye este.', 409);

  const base = baseUrl(req);
  const { plan, period } = body;
  const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{
        id: `${plan}-${period}`,
        title: `Apk Price Value · Plan ${PLANS[plan as keyof typeof PLANS].name} ${PERIOD_LABEL[period as keyof typeof PERIOD_LABEL].toLowerCase()}`,
        quantity: 1,
        currency_id: currency(),
        unit_price: chargeAmount(plan, period),
      }],
      external_reference: makeReference(uid, plan, period),
      back_urls: { success: `${base}/planes?pago=ok`, pending: `${base}/planes?pago=pendiente`, failure: `${base}/planes?pago=error` },
      auto_return: 'approved',
      notification_url: `${base}/api/billing/webhook`,
    }),
  }).catch(() => null);

  const data = await res?.json().catch(() => ({}));
  if (!res || !res.ok || !data?.init_point) {
    console.error('Mercado Pago preferencia falló', res?.status, JSON.stringify(data)?.slice(0, 300));
    return jsonError('No pudimos iniciar el pago con Mercado Pago. Intenta de nuevo en un momento.', 502);
  }
  return NextResponse.json({ url: data.init_point });
}
