import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { query } from './db';
import { applyPayment, chargeAmount, currency, makeReference, parseReference, type PaidPlan } from './billing';
import type { Period } from './plans';

/**
 * Rapyd: pago único con su página de pago (Checkout) y cobro automático con su página de suscripción.
 * Los datos de la tarjeta se escriben en la página de Rapyd; la app nunca los ve.
 */

const keys = () => ({ access: process.env.RAPYD_ACCESS_KEY?.trim() ?? '', secret: process.env.RAPYD_SECRET_KEY?.trim() ?? '' });
export const rapydSandbox = () => process.env.RAPYD_SANDBOX === '1';
export const rapydBase = () => (rapydSandbox() ? 'https://sandboxapi.rapyd.net' : 'https://api.rapyd.net');
export const rapydCountry = () => (process.env.RAPYD_COUNTRY?.trim() || 'CO').toUpperCase();
/** El cobro automático está activo salvo que se apague con RAPYD_RECURRING=0. */
export const rapydRecurring = () => !!(keys().access && keys().secret) && process.env.RAPYD_RECURRING !== '0';

export class RapydError extends Error {
  constructor(message: string, public status: number, public code = '') {
    super(message);
    this.name = 'RapydError';
  }
}

/** Firma de Rapyd: base64 del HMAC-SHA256 en hexadecimal (así lo hace su ejemplo oficial en Node). */
export function sign(parts: string, secret: string) {
  const hex = createHmac('sha256', secret).update(parts).digest('hex');
  return Buffer.from(hex).toString('base64');
}

export function requestHeaders(method: string, path: string, body: string, now = Date.now(), salt = randomBytes(6).toString('hex')) {
  const { access, secret } = keys();
  const timestamp = String(Math.floor(now / 1000));
  return {
    access_key: access,
    salt,
    timestamp,
    signature: sign(method.toLowerCase() + path + salt + timestamp + access + secret + body, secret),
    idempotency: `${timestamp}${salt}`,
    'Content-Type': 'application/json',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

async function call<T = Json>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: Json): Promise<T> {
  const text = body ? JSON.stringify(body) : '';
  const raw = text === '{}' ? '' : text;
  const res = await fetch(rapydBase() + path, { method, headers: requestHeaders(method, path, raw), body: raw || undefined, cache: 'no-store' }).catch(
    () => null,
  );
  if (!res) throw new RapydError('No se pudo conectar con Rapyd; intenta de nuevo en un momento.', 0);
  const out = await res.text();
  let data: Json = {};
  try {
    data = out ? JSON.parse(out) : {};
  } catch {
    console.error('Rapyd respuesta no JSON', method, path.split('?')[0], res.status, out.slice(0, 300));
    throw new RapydError(`Rapyd respondió ${res.status} en un formato inesperado.`, res.status);
  }
  const st = data?.status ?? {};
  if (!res.ok || st.status === 'ERROR') {
    console.error('Rapyd API', method, path.split('?')[0], res.status, st.error_code, st.message);
    throw new RapydError(explainRapyd(res.status, st.error_code, st.message), res.status, st.error_code ?? '');
  }
  return data.data as T;
}

/** Traduce los errores comunes de Rapyd a algo que el dueño pueda corregir. */
export function explainRapyd(status: number, code?: string, message?: string) {
  if (status === 401 || /UNAUTHENTICATED|UNAUTHORIZED|ACCESS_KEY|SIGNATURE/i.test(code ?? ''))
    return 'Rapyd rechazó las claves. Revisa RAPYD_ACCESS_KEY y RAPYD_SECRET_KEY en Vercel, y que RAPYD_SANDBOX=1 si son claves de prueba (o sin él si son de producción).';
  const why = message || code;
  return why ? `Rapyd dice: ${why}` : `Rapyd respondió ${status}.`;
}

/** Rapyd recomienda enviar montos con decimales como texto para no alterar la firma. */
const amountValue = (n: number) => (Number.isInteger(n) ? n : n.toFixed(2));

/** Pago único: crea la página de pago y devuelve su dirección. */
export async function createCheckout(o: { uid: number; plan: PaidPlan; period: Period; base: string; description: string }) {
  const data = await call<{ id: string; redirect_url: string }>('POST', '/v1/checkout', {
    amount: amountValue(chargeAmount(o.plan, o.period)),
    currency: currency(),
    country: rapydCountry(),
    merchant_reference_id: makeReference(o.uid, o.plan, o.period),
    complete_checkout_url: `${o.base}/planes?pago=ok`,
    cancel_checkout_url: `${o.base}/planes?pago=error`,
    language: 'es',
    description: o.description.slice(0, 200),
    metadata: { uid: o.uid, plan: o.plan, period: o.period },
  });
  if (!data?.redirect_url) throw new RapydError('Rapyd no devolvió la página de pago.', 502);
  return data.redirect_url;
}

const INTERVAL: Record<Period, { interval: string; interval_count: number }> = {
  monthly: { interval: 'month', interval_count: 1 },
  semester: { interval: 'month', interval_count: 6 },
  annual: { interval: 'year', interval_count: 1 },
};

/** Id fijo por plan, periodo, moneda y monto: si cambia el precio o la tasa se crea un plan nuevo. */
export const rapydPlanId = (plan: PaidPlan, period: Period, amount: number, cur: string) =>
  `apv_${plan}_${period}_${String(amount).replace('.', '_')}_${cur.toLowerCase()}`;
const PRODUCT_ID = 'apv_suscripcion';

async function exists(path: string) {
  try {
    await call('GET', path);
    return true;
  } catch (e) {
    if (e instanceof RapydError && e.status !== 0 && e.status !== 401) return false;
    throw e;
  }
}

async function ensureProduct() {
  if (await exists(`/v1/products/${PRODUCT_ID}`)) return;
  const base = { id: PRODUCT_ID, name: 'Apk Price Value', description: 'Suscripción a Apk Price Value', active: true };
  // La documentación dice «services» pero algunos mensajes de error piden «service»; se prueban ambos.
  try {
    await call('POST', '/v1/products', { ...base, type: 'services' });
  } catch {
    await call('POST', '/v1/products', { ...base, type: 'service' });
  }
}

export async function ensurePlan(plan: PaidPlan, period: Period) {
  const amount = chargeAmount(plan, period);
  const cur = currency();
  const id = rapydPlanId(plan, period, amount, cur);
  if (await exists(`/v1/plans/${id}`)) return { id, amount, currency: cur };
  await ensureProduct();
  await call('POST', '/v1/plans', {
    id,
    product: PRODUCT_ID,
    nickname: `${plan} ${period}`,
    amount: amountValue(amount),
    currency: cur,
    billing_scheme: 'per_unit',
    usage_type: 'licensed',
    ...INTERVAL[period],
  });
  return { id, amount, currency: cur };
}

async function ensureCustomer(uid: number) {
  const [u] = await query<{ email: string; name: string; rapyd_customer: string | null }>(
    'SELECT email, name, rapyd_customer FROM users WHERE id=$1',
    [uid],
  );
  if (!u) throw new RapydError('Usuario no encontrado.', 404);
  if (u.rapyd_customer) return u.rapyd_customer;
  const c = await call<{ id: string }>('POST', '/v1/customers', { name: u.name || u.email, email: u.email, metadata: { uid } });
  await query('UPDATE users SET rapyd_customer=$1 WHERE id=$2', [c.id, uid]);
  return c.id;
}

/** Cobro automático: crea la página de suscripción de Rapyd y devuelve su dirección. */
export async function createSubscriptionPage(o: { uid: number; plan: PaidPlan; period: Period; base: string }) {
  const customer = await ensureCustomer(o.uid);
  const p = await ensurePlan(o.plan, o.period);
  const page = await call<{ id: string; redirect_url: string }>('POST', '/v1/checkout/subscriptions', {
    customer,
    country: rapydCountry(),
    billing: 'pay_automatically',
    subscription_items: [{ plan: p.id, quantity: 1 }],
    complete_payment_url: `${o.base}/planes?pago=ok`,
    error_payment_url: `${o.base}/planes?pago=error`,
    merchant_reference_id: makeReference(o.uid, o.plan, o.period),
    metadata: { uid: o.uid, plan: o.plan, period: o.period },
    language: 'es',
    merchant_main_button: 'subscribe',
  });
  if (!page?.redirect_url) throw new RapydError('Rapyd no devolvió la página de suscripción.', 502);
  // Queda pendiente hasta que Rapyd avise el primer cobro pagado.
  await query(
    `INSERT INTO subscriptions (user_id, provider, external_id, customer_id, plan, period, amount, currency, status)
     VALUES ($1,'rapyd',$2,$3,$4,$5,$6,$7,'pending') ON CONFLICT (external_id) DO NOTHING`,
    [o.uid, page.id, customer, o.plan, o.period, p.amount, p.currency],
  );
  return page.redirect_url;
}

/** Cancela en Rapyd las suscripciones activas de la persona. El plan sigue hasta su vencimiento. */
export async function cancelRapyd(uid: number) {
  const subs = await query<{ id: number; external_id: string }>(
    `SELECT id, external_id FROM subscriptions WHERE user_id=$1 AND provider='rapyd' AND status='active'`,
    [uid],
  );
  for (const s of subs) {
    if (s.external_id.startsWith('sub_')) await call('DELETE', `/v1/payments/subscriptions/${s.external_id}`);
    await query(`UPDATE subscriptions SET status='canceled', canceled_at=now() WHERE id=$1`, [s.id]);
  }
  await query(`UPDATE subscriptions SET status='abandoned' WHERE user_id=$1 AND provider='rapyd' AND status='pending'`, [uid]);
  return subs.length;
}

// ---------- Webhooks ----------

/**
 * Verifica la firma del aviso: BASE64(HMAC(url + salt + timestamp + access_key + secret_key + body)).
 * Se prueban las variantes razonables de URL, cuerpo y codificación; todas exigen la clave secreta.
 */
export function validWebhook(headers: Headers, rawBody: string, urls: string[]) {
  const { access, secret } = keys();
  const salt = headers.get('salt') ?? '';
  const timestamp = headers.get('timestamp') ?? '';
  const got = headers.get('signature') ?? '';
  if (!access || !secret || !salt || !timestamp || !got) return false;
  const bodies = new Set([rawBody]);
  try {
    bodies.add(JSON.stringify(JSON.parse(rawBody)));
  } catch {
    return false;
  }
  const b = Buffer.from(got);
  for (const url of new Set(urls)) {
    for (const body of bodies) {
      const msg = url + salt + timestamp + access + secret + body;
      const raw = createHmac('sha256', secret).update(msg).digest();
      for (const cand of [Buffer.from(raw.toString('hex')).toString('base64'), raw.toString('base64')]) {
        const a = Buffer.from(cand);
        if (a.length === b.length && timingSafeEqual(a, b)) return true;
      }
    }
  }
  return false;
}

type Invoice = { id: string; customer?: string; subscription?: string; amount: number; currency: string };

/** Un cobro de suscripción pagado: activa la suscripción (si estaba pendiente) y suma el periodo una sola vez. */
export async function applyInvoice(inv: Invoice) {
  const [row] = await query<{ id: number; user_id: number; plan: PaidPlan; period: Period; amount: string; status: string; external_id: string }>(
    `SELECT id, user_id, plan, period, amount, status, external_id FROM subscriptions
     WHERE provider='rapyd' AND (external_id=$1 OR (customer_id=$2 AND status='pending'))
     ORDER BY (external_id=$1) DESC, id DESC LIMIT 1`,
    [inv.subscription ?? '', inv.customer ?? ''],
  );
  if (!row) return false;
  // Se activa cuando llega el id de la suscripción (sub_); el aviso del pago solo suma el periodo.
  if (inv.subscription && row.status !== 'active' && row.status !== 'canceled') {
    const ext = inv.subscription;
    // Si la persona cambió de plan, la suscripción anterior se cancela en Rapyd.
    const old = await query<{ id: number; external_id: string }>(
      `SELECT id, external_id FROM subscriptions WHERE user_id=$1 AND provider='rapyd' AND status='active' AND id<>$2`,
      [row.user_id, row.id],
    );
    for (const o of old) {
      await call('DELETE', `/v1/payments/subscriptions/${o.external_id}`).catch((e) => console.error('Rapyd cancelar anterior', o.external_id, e?.message));
      await query(`UPDATE subscriptions SET status='replaced', canceled_at=now() WHERE id=$1`, [o.id]);
    }
    await query(`UPDATE subscriptions SET status='active', external_id=$1 WHERE id=$2`, [ext, row.id]);
  }
  return applyPayment(
    {
      id: `inv:${inv.id}`,
      status: 'approved',
      external_reference: makeReference(row.user_id, row.plan, row.period),
      transaction_amount: Number(inv.amount),
      currency_id: String(inv.currency ?? '').toUpperCase(),
    },
    'rapyd',
    Number(row.amount),
  );
}

/** Procesa un aviso de Rapyd ya verificado. Devuelve true si activó o extendió un plan. */
export async function handleEvent(evt: Json) {
  const type = String(evt?.type ?? '');
  const d = evt?.data ?? {};
  if (type === 'INVOICE_PAYMENT_SUCCEEDED' || type === 'INVOICE_PAID') {
    if (d.status && d.status !== 'paid') return false;
    return applyInvoice({ id: d.id, customer: d.customer, subscription: d.subscription, amount: d.total ?? d.amount, currency: d.currency });
  }
  if (type === 'PAYMENT_SUCCEEDED' || type === 'PAYMENT_COMPLETED') {
    if (d.status !== 'CLO') return false; // CLO = pago cerrado y cobrado
    if (d.invoice) return applyInvoice({ id: d.invoice, customer: d.customer_token ?? d.customer, subscription: d.subscription, amount: d.amount, currency: d.currency_code });
    if (!parseReference(d.merchant_reference_id)) return false;
    return applyPayment(
      { id: d.id, status: 'approved', external_reference: d.merchant_reference_id, transaction_amount: Number(d.amount), currency_id: String(d.currency_code ?? '').toUpperCase() },
      'rapyd',
    );
  }
  return false;
}
