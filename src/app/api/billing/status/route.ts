import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { billingEnabled, currency } from '@/lib/billing';

/** Dice si el cobro está bien configurado, sin mostrar ningún valor secreto. Solo para quien inició sesión. */
export async function GET(req: Request) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const has = (k: string) => !!process.env[k]?.trim();
  return NextResponse.json({
    MP_ACCESS_TOKEN: billingEnabled(),
    tokenTipo: process.env.MP_ACCESS_TOKEN?.trim().startsWith('TEST-') ? 'prueba' : billingEnabled() ? 'produccion' : null,
    MP_WEBHOOK_SECRET: has('MP_WEBHOOK_SECRET'),
    MP_CURRENCY: currency(),
    MP_USD_RATE: Number(process.env.MP_USD_RATE) || 4000,
    APP_URL: has('APP_URL'),
    webhook: `${(process.env.APP_URL?.trim().replace(/\/+$/, '') || new URL(req.url).origin)}/api/billing/webhook`,
  });
}
