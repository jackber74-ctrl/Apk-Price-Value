import { NextResponse } from 'next/server';
import { baseUrl } from '@/lib/oauth';
import { PAYU_APPROVED, PAYU_PENDING } from '@/lib/payu';

/** Página de respuesta: PayU devuelve aquí a la persona. Solo informa; el plan lo activa la confirmación. */
export async function GET(req: Request) {
  const state = new URL(req.url).searchParams.get('transactionState');
  const pago = state === PAYU_APPROVED ? 'ok' : state === PAYU_PENDING ? 'pendiente' : 'error';
  return NextResponse.redirect(`${baseUrl(req)}/planes?pago=${pago}`, 303);
}
export const POST = GET;
