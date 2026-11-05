import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { recurringEnabled } from '@/lib/payu-recurring';
import { currency, usdRate } from '@/lib/billing';

/** Suscripción automática activa de la persona (si tiene) y si el cobro automático está disponible. */
export async function GET() {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const [sub] = await query<{ plan: string; period: string; card_last4: string; amount: string; currency: string; created_at: string }>(
    `SELECT plan, period, card_last4, amount, currency, created_at FROM subscriptions WHERE user_id=$1 AND status='active' ORDER BY id DESC LIMIT 1`,
    [uid],
  );
  return NextResponse.json({ available: recurringEnabled(), subscription: sub ?? null, currency: currency(), rate: usdRate() });
}
