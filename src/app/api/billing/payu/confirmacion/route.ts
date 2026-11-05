import { NextResponse } from 'next/server';
import { applyPayment, currency } from '@/lib/billing';
import { PAYU_APPROVED, payuConfig, validConfirmation } from '@/lib/payu';

/**
 * Página de confirmación de PayU (servidor a servidor). PayU la llama por cada cambio de estado del pago.
 * Solo un aviso con firma válida y estado aprobado activa el plan; el registro en payments evita sumarlo dos veces.
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Formato no válido.' }, { status: 400 });
  const f = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  const { merchantId, apiKey } = payuConfig();
  if (!apiKey || f.merchant_id !== merchantId || !validConfirmation(f, apiKey)) {
    console.error('PayU confirmación con firma no válida', f.reference_sale);
    return NextResponse.json({ error: 'Firma no válida.' }, { status: 401 });
  }
  if (f.state_pol === PAYU_APPROVED) {
    await applyPayment(
      {
        id: f.transaction_id || f.reference_pol,
        status: 'approved',
        external_reference: f.reference_sale,
        transaction_amount: Number(f.value),
        currency_id: (f.currency || currency()).toUpperCase(),
      },
      'payu',
    );
  }
  return NextResponse.json({ ok: true });
}
