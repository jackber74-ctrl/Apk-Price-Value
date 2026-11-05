import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { billingEnabled, currency, mpEnabled, provider, usdRate } from '@/lib/billing';
import { payuTest } from '@/lib/payu';

/** Dice si el cobro está bien configurado, sin mostrar ningún valor secreto. Solo para quien inició sesión. */
export async function GET(req: Request) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const has = (k: string) => !!process.env[k]?.trim();
  const base = process.env.APP_URL?.trim().replace(/\/+$/, '') || new URL(req.url).origin;
  return NextResponse.json({
    pasarela: provider(),
    cobroActivo: billingEnabled(),
    payu: {
      modo: payuTest() ? 'prueba' : 'produccion',
      PAYU_MERCHANT_ID: has('PAYU_MERCHANT_ID'),
      PAYU_ACCOUNT_ID: has('PAYU_ACCOUNT_ID'),
      PAYU_API_KEY: has('PAYU_API_KEY'),
      PAYU_RECURRING: process.env.PAYU_RECURRING === '1',
      PAYU_API_LOGIN: has('PAYU_API_LOGIN'),
      CRON_SECRET: has('CRON_SECRET'),
      confirmacion: `${base}/api/billing/payu/confirmacion`,
      respuesta: `${base}/api/billing/payu/respuesta`,
    },
    mercadoPago: { MP_ACCESS_TOKEN: mpEnabled(), webhook: `${base}/api/billing/webhook` },
    moneda: currency(),
    USD_RATE: usdRate(),
    APP_URL: has('APP_URL'),
  });
}
