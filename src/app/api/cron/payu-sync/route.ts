import { NextResponse } from 'next/server';
import { recurringEnabled, syncAll } from '@/lib/payu-recurring';

/** Revisión diaria (Vercel Cron) de los cobros automáticos en PayU, por si algún aviso no llegó. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  if (!recurringEnabled()) return NextResponse.json({ ok: true, skipped: true });
  return NextResponse.json({ ok: true, ...(await syncAll()) });
}
