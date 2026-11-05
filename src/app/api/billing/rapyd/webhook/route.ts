import { NextResponse } from 'next/server';
import { handleEvent, validWebhook } from '@/lib/rapyd';

/**
 * Avisos de Rapyd (pagos y cobros de suscripción). Se registra en el panel de Rapyd → Developers → Webhooks.
 * Responde 200 rápido; si algo falla responde 500 para que Rapyd reintente.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const url = new URL(req.url);
  const app = process.env.APP_URL?.trim().replace(/\/+$/, '');
  // Rapyd firma con la URL exacta que se registró en su panel.
  const urls = [
    process.env.RAPYD_WEBHOOK_URL?.trim() ?? '',
    url.href,
    `${url.origin}${url.pathname}`,
    app ? `${app}${url.pathname}` : '',
    `https://${req.headers.get('host')}${url.pathname}`,
  ].filter(Boolean);
  if (!validWebhook(req.headers, raw, urls)) {
    console.error('Rapyd webhook con firma no válida');
    return NextResponse.json({ error: 'firma no válida' }, { status: 401 });
  }
  let evt;
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'JSON no válido' }, { status: 400 });
  }
  try {
    const applied = await handleEvent(evt);
    return NextResponse.json({ ok: true, applied });
  } catch (e) {
    console.error('Rapyd webhook', evt?.type, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'error' }, { status: 500 });
  }
}
