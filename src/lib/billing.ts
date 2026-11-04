import { createHmac, timingSafeEqual } from 'crypto';
import { query } from './db';
import { PERIOD_MONTHS, PRICES, isPeriod, isPlanId, type Period, type PlanId } from './plans';

export type PaidPlan = Exclude<PlanId, 'free'>;

export const billingEnabled = () => !!process.env.MP_ACCESS_TOKEN?.trim();
export const currency = () => (process.env.MP_CURRENCY?.trim().toUpperCase() || 'COP');

/** Monto a cobrar. Los precios están en USD; en otra moneda se multiplican por MP_USD_RATE y se redondean al peso. */
export function chargeAmount(plan: PaidPlan, period: Period) {
  const usd = PRICES[plan][period];
  if (currency() === 'USD') return usd;
  const rate = Number(process.env.MP_USD_RATE) || 4000;
  return Math.round(usd * rate);
}

export const makeReference = (uid: number, plan: PaidPlan, period: Period) => `${uid}:${plan}:${period}`;

export function parseReference(ref: unknown): { uid: number; plan: PaidPlan; period: Period } | null {
  const [u, plan, period] = String(ref ?? '').split(':');
  const uid = Number(u);
  if (!Number.isInteger(uid) || uid <= 0 || !isPlanId(plan) || plan === 'free' || !isPeriod(period)) return null;
  return { uid, plan, period };
}

/** Nueva fecha de vencimiento: si renueva el mismo plan aún vigente se suma al final; si no, cuenta desde hoy. */
export function nextExpiry(
  current: { plan: string | null; plan_expires_at: string | Date | null },
  plan: PaidPlan,
  period: Period,
  now = new Date(),
) {
  const prev = current.plan_expires_at ? new Date(current.plan_expires_at) : null;
  const start = current.plan === plan && prev && prev.getTime() > now.getTime() ? prev : now;
  const end = new Date(start);
  end.setMonth(end.getMonth() + PERIOD_MONTHS[period]);
  return end;
}

/** Verifica la firma x-signature de Mercado Pago. Sin MP_WEBHOOK_SECRET no se exige. */
export function validSignature(req: Request, dataId: string) {
  const secret = process.env.MP_WEBHOOK_SECRET?.trim();
  if (!secret) return true;
  const header = req.headers.get('x-signature') ?? '';
  const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=') as [string, string]));
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${req.headers.get('x-request-id') ?? ''};ts:${parts.ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type MpPayment = {
  id: number | string;
  status: string;
  external_reference?: string;
  transaction_amount?: number;
  currency_id?: string;
};

/** Activa el plan por un pago aprobado. Devuelve false si ya estaba registrado o no corresponde. */
export async function applyPayment(p: MpPayment) {
  if (p.status !== 'approved') return false;
  const ref = parseReference(p.external_reference);
  if (!ref) return false;
  const expected = chargeAmount(ref.plan, ref.period);
  if (p.currency_id !== currency() || Number(p.transaction_amount) + 0.01 < expected) return false;

  const ins = await query<{ id: number }>(
    `INSERT INTO payments (user_id, payment_id, plan, period, amount, currency)
     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (payment_id) DO NOTHING RETURNING id`,
    [ref.uid, String(p.id), ref.plan, ref.period, p.transaction_amount, p.currency_id],
  );
  if (!ins.length) return false;

  const [row] = await query<{ plan: string | null; plan_expires_at: string | null; plan_lifetime: boolean }>(
    'SELECT plan, plan_expires_at, plan_lifetime FROM users WHERE id = $1',
    [ref.uid],
  );
  if (!row || row.plan_lifetime) return true; // el plan de por vida ya lo incluye todo
  const end = nextExpiry(row, ref.plan, ref.period);
  await query('UPDATE users SET plan=$1, plan_period=$2, plan_expires_at=$3 WHERE id=$4', [ref.plan, ref.period, end, ref.uid]);
  return true;
}
