import { NextResponse } from 'next/server';
import { requireUser, jsonError } from '@/lib/auth';
import { isPeriod, isPlanId, PERIOD_LABEL, PLANS, planLevel } from '@/lib/plans';
import { billingEnabled, mpToken, chargeAmount, currency, makeReference } from '@/lib/billing';
import { baseUrl } from '@/lib/oauth';
import { getPlan } from '@/lib/plan-server';
import { query } from '@/lib/db';

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
  const [user] = await query<{ email: string; name: string }>('SELECT email, name FROM users WHERE id = $1', [uid]);
  const [first, ...rest] = (user?.name ?? '').trim().split(/\s+/);
  const test = mpToken().startsWith('TEST-');
  const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: { Authorization: `Bearer ${mpToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{
        id: `${plan}-${period}`,
        title: `Apk Price Value · Plan ${PLANS[plan as keyof typeof PLANS].name} ${PERIOD_LABEL[period as keyof typeof PERIOD_LABEL].toLowerCase()}`,
        quantity: 1,
        currency_id: currency(),
        unit_price: chargeAmount(plan, period),
        category_id: 'services',
        description: 'Suscripción a Apk Price Value',
      }],
      // Los datos del comprador ayudan a que Mercado Pago apruebe el pago (sobre todo PSE y tarjetas).
      // En modo de prueba no se envían: el comprador debe ser un usuario de prueba distinto.
      ...(test || !user ? {} : { payer: { email: user.email, ...(first ? { name: first, surname: rest.join(' ') } : {}) } }),
      statement_descriptor: 'APKPRICEVALUE',
      binary_mode: false,
      external_reference: makeReference(uid, plan, period),
      back_urls: { success: `${base}/planes?pago=ok`, pending: `${base}/planes?pago=pendiente`, failure: `${base}/planes?pago=error` },
      auto_return: 'approved',
      notification_url: `${base}/api/billing/webhook`,
    }),
  }).catch(() => null);

  const data = await res?.json().catch(() => ({}));
  const url = test ? data?.sandbox_init_point || data?.init_point : data?.init_point;
  if (!res || !res.ok || !url) {
    console.error('Mercado Pago preferencia falló', res?.status, JSON.stringify(data)?.slice(0, 500));
    const why = explain(res?.status, data);
    return NextResponse.json({ error: `No pudimos iniciar el pago con Mercado Pago. ${why}` }, { status: 502 });
  }
  return NextResponse.json({ url });
}

/** Traduce el error de Mercado Pago a algo que el dueño pueda corregir. */
function explain(status: number | undefined, data: { message?: string; error?: string } | undefined) {
  if (!status) return 'No se pudo conectar con Mercado Pago; intenta de nuevo en un momento.';
  if (status === 401 || status === 403) return 'Mercado Pago rechazó la clave (MP_ACCESS_TOKEN). Usa el Access Token de producción de tu aplicación y vuelve a desplegar.';
  const msg = data?.message || data?.error;
  if (/currency/i.test(msg ?? '')) return `La moneda ${currency()} no es válida para tu cuenta (MP_CURRENCY). ${msg}`;
  return msg ? `Mercado Pago dice: ${msg}` : `Mercado Pago respondió ${status}.`;
}
