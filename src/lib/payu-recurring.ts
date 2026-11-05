import { query } from './db';
import { applyPayment, chargeAmount, currency, makeReference, type PaidPlan } from './billing';
import { PERIOD_MONTHS, PLANS, type Period } from './plans';
import { payuConfig, payuTest } from './payu';

/**
 * PayU Pagos recurrentes (API v4.9). La tarjeta la guarda PayU (token); la app nunca guarda el número.
 * Docs: https://developers.payulatam.com/latam/es/docs/services/recurrent-payments.html
 * Requiere que PayU habilite el producto en la cuenta y PAYU_API_LOGIN.
 */

const SANDBOX_LOGIN = 'pRRXKOl8ikMmt9u'; // credencial pública del sandbox de PayU

export const recurringEnabled = () =>
  process.env.PAYU_RECURRING === '1' && (payuTest() || !!process.env.PAYU_API_LOGIN?.trim());

const apiBase = () =>
  payuTest() ? 'https://sandbox.api.payulatam.com/payments-api/rest/v4.9' : 'https://api.payulatam.com/payments-api/rest/v4.9';

export class PayuError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { apiKey } = payuConfig();
  const login = process.env.PAYU_API_LOGIN?.trim() || (payuTest() ? SANDBOX_LOGIN : '');
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${login}:${apiKey}`).toString('base64')}`,
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      'Accept-Language': 'es',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
  if (!res) throw new PayuError('No se pudo conectar con PayU.');
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new PayuError(data?.description || data?.message || `PayU respondió ${res.status}`, res.status);
  return data as T;
}

/** Tipo de tarjeta por sus primeros dígitos (lo pide PayU al guardarla). */
export function cardType(number: string) {
  const n = number.replace(/\D/g, '');
  if (/^4/.test(n)) return 'VISA';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'MASTERCARD';
  if (/^3[47]/.test(n)) return 'AMEX';
  if (/^3(0[0-5]|[68])/.test(n)) return 'DINERS';
  return '';
}

/** Verifica el número con el algoritmo de Luhn antes de mandarlo a PayU. */
export function luhn(number: string) {
  const d = number.replace(/\D/g, '');
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let x = Number(d[d.length - 1 - i]);
    if (i % 2) { x *= 2; if (x > 9) x -= 9; }
    sum += x;
  }
  return sum % 10 === 0;
}

export const planCode = (plan: PaidPlan, period: Period, amount: number, cur: string) => `apv-${plan}-${period}-${amount}-${cur}`.toLowerCase();

/** Crea en PayU el plan (mensual, semestral o anual) si todavía no existe. */
async function ensurePlan(plan: PaidPlan, period: Period) {
  const amount = chargeAmount(plan, period);
  const cur = currency();
  const code = planCode(plan, period, amount, cur);
  try {
    await call('GET', `/plans/${code}`);
  } catch (e) {
    if (!(e instanceof PayuError) || e.status !== 404) throw e;
    await call('POST', '/plans', {
      accountId: payuConfig().accountId,
      planCode: code,
      description: `Apk Price Value ${PLANS[plan].name} cada ${PERIOD_MONTHS[period]} mes(es)`,
      interval: 'MONTH',
      intervalCount: PERIOD_MONTHS[period],
      maxPaymentsAllowed: 1000,
      maxPaymentAttempts: 3,
      paymentAttemptsDelay: 1,
      maxPendingPayments: 1,
      trialDays: 0,
      additionalValues: [
        { name: 'PLAN_VALUE', value: amount, currency: cur },
        { name: 'PLAN_TAX', value: 0, currency: cur },
        { name: 'PLAN_TAX_RETURN_BASE', value: 0, currency: cur },
      ],
    });
  }
  return { code, amount, cur };
}

export type CardInput = { name: string; document: string; number: string; expMonth: string; expYear: string };

/** Suscribe a la persona: crea cliente y tarjeta en PayU, crea la suscripción con cobro inmediato y la guarda. */
export async function subscribe(uid: number, plan: PaidPlan, period: Period, card: CardInput) {
  const [user] = await query<{ email: string; name: string }>('SELECT email, name FROM users WHERE id = $1', [uid]);
  if (!user) throw new PayuError('Usuario no encontrado.');
  const { code, amount, cur } = await ensurePlan(plan, period);
  const customer = await call<{ id: string }>('POST', '/customers', { fullName: user.name || card.name, email: user.email });
  const number = card.number.replace(/\D/g, '');
  const cc = await call<{ token: string }>('POST', `/customers/${customer.id}/creditCards`, {
    name: card.name,
    document: card.document,
    number,
    expMonth: card.expMonth,
    expYear: card.expYear,
    type: cardType(number),
  });
  const sub = await call<{ id: string }>('POST', '/subscriptions', {
    quantity: 1,
    installments: 1,
    trialDays: 0,
    immediatePayment: true,
    customer: { id: customer.id, creditCards: [{ token: cc.token }] },
    plan: { planCode: code },
  });
  await query(
    `INSERT INTO subscriptions (user_id, external_id, customer_id, plan, period, amount, currency, card_last4)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [uid, sub.id, customer.id, plan, period, amount, cur, number.slice(-4)],
  );
  // La nueva suscripción reemplaza a la anterior: se cancela en PayU para no cobrar dos veces.
  const old = await query<{ external_id: string }>(`SELECT external_id FROM subscriptions WHERE user_id=$1 AND status='active' AND external_id<>$2`, [uid, sub.id]);
  for (const o of old) {
    await call('DELETE', `/subscriptions/${o.external_id}`).catch((e) => console.error('PayU cancelar anterior', o.external_id, e?.message));
    await query(`UPDATE subscriptions SET status='replaced', canceled_at=now() WHERE external_id=$1`, [o.external_id]);
  }
  await syncBills(sub.id);
  return sub.id;
}

type Bill = { id: string; state: string; amount?: number; currency?: string };

/** Revisa los cobros de una suscripción en PayU y activa o extiende el plan por cada cobro pagado (una sola vez). */
export async function syncBills(subscriptionId: string) {
  const [s] = await query<{ user_id: number; plan: PaidPlan; period: Period; amount: string; currency: string }>(
    'SELECT user_id, plan, period, amount, currency FROM subscriptions WHERE external_id = $1',
    [subscriptionId],
  );
  if (!s) return 0;
  const data = await call<{ recurringBillList?: Bill[] }>('GET', `/recurringBill?subscriptionId=${encodeURIComponent(subscriptionId)}`);
  let applied = 0;
  for (const b of data.recurringBillList ?? []) {
    if (b.state !== 'PAID') continue;
    const ok = await applyPayment(
      {
        id: `bill:${b.id}`,
        status: 'approved',
        external_reference: makeReference(s.user_id, s.plan, s.period),
        transaction_amount: Number(b.amount ?? s.amount),
        currency_id: (b.currency || s.currency).toUpperCase(),
      },
      'payu',
      Number(s.amount),
    );
    if (ok) applied++;
  }
  return applied;
}

/** Cancela el cobro automático. El plan sigue vigente hasta su fecha. */
export async function cancelSubscription(uid: number) {
  const subs = await query<{ external_id: string }>(`SELECT external_id FROM subscriptions WHERE user_id=$1 AND status='active'`, [uid]);
  for (const s of subs) {
    await call('DELETE', `/subscriptions/${s.external_id}`);
    await query(`UPDATE subscriptions SET status='canceled', canceled_at=now() WHERE external_id=$1`, [s.external_id]);
  }
  return subs.length;
}

/** Revisa todas las suscripciones activas (lo corre el cron diario). */
export async function syncAll() {
  const subs = await query<{ external_id: string }>(`SELECT external_id FROM subscriptions WHERE status='active'`);
  let applied = 0;
  for (const s of subs) applied += await syncBills(s.external_id).catch((e) => (console.error('PayU sync', s.external_id, e?.message), 0));
  return { subscriptions: subs.length, applied };
}
