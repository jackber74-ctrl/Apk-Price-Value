import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { recurringEnabled } from '@/lib/payu-recurring';
import { currency, provider, usdRate } from '@/lib/billing';
import { rapydRecurring } from '@/lib/rapyd';

/** Suscripción automática activa de la persona (si tiene) y si el cobro automático está disponible. */
export async function GET() {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const [sub] = await query<{ plan: string; period: string; card_last4: string; amount: string; currency: string; created_at: string }>(
    `SELECT plan, period, card_last4, amount, currency, created_at FROM subscriptions WHERE user_id=$1 AND status='active' ORDER BY id DESC LIMIT 1`,
    [uid],
  );
    // mode: 'card' = formulario de tarjeta en la app (PayU); 'hosted' = página de suscripción de la pasarela (Rapyd).
  const gw = provider();
  const mode = gw === 'rapyd' ? (rapydRecurring() ? 'hosted' : null) : gw === 'payu' && recurringEnabled() ? 'card' : null;
  return NextResponse.json({ available: !!mode, mode, subscription: sub ?? null, currency: currency(), rate: usdRate() });
}
