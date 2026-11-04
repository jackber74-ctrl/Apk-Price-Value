import { NextResponse } from 'next/server';
import { applyPayment, validSignature, type MpPayment } from '@/lib/billing';

/**
 * Aviso de Mercado Pago. No se confía en lo que trae el aviso: se consulta el pago directamente a su API
 * con nuestra clave y solo si está aprobado y coincide plan, periodo y monto se activa el plan.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const type = url.searchParams.get('type') ?? url.searchParams.get('topic') ?? body.type ?? body.topic;
  const dataId = String(url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? body?.data?.id ?? '');
  if (type !== 'payment' || !dataId) return NextResponse.json({ ok: true });
  if (!validSignature(req, dataId)) return NextResponse.json({ error: 'Firma no válida.' }, { status: 401 });

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
  }).catch(() => null);
  // 5xx para que Mercado Pago reintente el aviso.
  if (!res || !res.ok) return NextResponse.json({ error: 'No se pudo consultar el pago.' }, { status: 502 });
  const payment = (await res.json()) as MpPayment;
  await applyPayment(payment);
  return NextResponse.json({ ok: true });
}
