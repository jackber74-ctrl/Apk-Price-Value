import { createHash, timingSafeEqual } from 'crypto';

/**
 * PayU Latam WebCheckout. La app arma un formulario firmado y lleva a la persona a la página de pago de PayU
 * (tarjetas, PSE, Nequi, Efecty…). PayU avisa el resultado a /api/billing/payu/confirmacion.
 * Docs: https://developers.payulatam.com/latam/es/docs/integrations/webcheckout-integration.html
 */

// Credenciales públicas de la cuenta de pruebas de PayU para Colombia (las publica PayU en su documentación).
const SANDBOX = { merchantId: '508029', accountId: '512321', apiKey: '4Vj8eK4rloUd272L48hsrarnUA' };

export const payuTest = () => process.env.PAYU_TEST === '1';

export function payuConfig() {
  const env = (k: string) => process.env[k]?.trim() || '';
  const merchantId = env('PAYU_MERCHANT_ID') || (payuTest() ? SANDBOX.merchantId : '');
  const accountId = env('PAYU_ACCOUNT_ID') || (payuTest() ? SANDBOX.accountId : '');
  const apiKey = env('PAYU_API_KEY') || (payuTest() ? SANDBOX.apiKey : '');
  const action = payuTest()
    ? 'https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/'
    : 'https://checkout.payulatam.com/ppp-web-gateway-payu/';
  return { merchantId, accountId, apiKey, action };
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const md5 = (s: string) => createHash('md5').update(s).digest('hex');

/** Firma del formulario: ApiKey~merchantId~referenceCode~amount~currency (SHA256). */
export function checkoutSignature(apiKey: string, merchantId: string, reference: string, amount: string, currency: string) {
  return sha256(`${apiKey}~${merchantId}~${reference}~${amount}~${currency}`);
}

/** PayU firma la confirmación con el valor a un decimal si el segundo decimal es 0 (150.00 → 150.0, 150.25 → 150.25). */
export function confirmationValue(value: string) {
  const fixed = Number(value).toFixed(2);
  return fixed.endsWith('0') ? Number(value).toFixed(1) : fixed;
}

/** Comprueba la firma que PayU manda en la confirmación (acepta MD5, SHA1 o SHA256 según la cuenta). */
export function validConfirmation(f: Record<string, string>, apiKey: string) {
  const base = `${apiKey}~${f.merchant_id}~${f.reference_sale}~${confirmationValue(f.value)}~${f.currency}~${f.state_pol}`;
  const sign = (f.sign || '').toLowerCase();
  const sha1 = createHash('sha1').update(base).digest('hex');
  return [md5(base), sha1, sha256(base)].some((h) => h.length === sign.length && timingSafeEqual(Buffer.from(h), Buffer.from(sign)));
}

/** Estado de la transacción en PayU: 4 aprobada, 6 rechazada, 5 expirada, 7 pendiente. */
export const PAYU_APPROVED = '4';
export const PAYU_PENDING = '7';
