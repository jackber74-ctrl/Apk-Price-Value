import { createHmac } from 'crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { rapydPlanId, requestHeaders, sign, validWebhook, explainRapyd } from '../src/lib/rapyd';

process.env.RAPYD_ACCESS_KEY = 'rak_test';
process.env.RAPYD_SECRET_KEY = 'rsk_test';

describe('firma de Rapyd', () => {
  it('es base64 del HMAC en hexadecimal, como el ejemplo oficial', () => {
    const hex = createHmac('sha256', 's').update('abc').digest('hex');
    expect(sign('abc', 's')).toBe(Buffer.from(hex).toString('base64'));
  });

  it('firma la petición con método en minúsculas, ruta, salt, hora, claves y cuerpo', () => {
    const h = requestHeaders('POST', '/v1/checkout', '{"a":1}', 1_700_000_000_000, 'salt1234');
    expect(h.timestamp).toBe('1700000000');
    expect(h.signature).toBe(sign('post/v1/checkout' + 'salt1234' + '1700000000' + 'rak_test' + 'rsk_test' + '{"a":1}', 'rsk_test'));
  });

  it('acepta un aviso firmado con la URL registrada y rechaza uno alterado', () => {
    const url = 'https://app.test/api/billing/rapyd/webhook';
    const body = '{"type":"PAYMENT_SUCCEEDED","data":{"id":"payment_1"}}';
    const headers = new Headers({ salt: 'abcd1234', timestamp: '1700000000' });
    headers.set('signature', sign(url + 'abcd1234' + '1700000000' + 'rak_test' + 'rsk_test' + body, 'rsk_test'));
    expect(validWebhook(headers, body, ['https://otra.test/x', url])).toBe(true);
    expect(validWebhook(headers, body.replace('payment_1', 'payment_2'), [url])).toBe(false);
    expect(validWebhook(new Headers(), body, [url])).toBe(false);
  });

  it('da ids de plan válidos y explica claves malas', () => {
    expect(rapydPlanId('pro', 'annual', 28000, 'COP')).toBe('apv_pro_annual_28000_cop');
    expect(rapydPlanId('pro', 'monthly', 2.5, 'USD')).toMatch(/^[a-z0-9_]+$/);
    expect(explainRapyd(401)).toContain('RAPYD_ACCESS_KEY');
  });
});

// Flujo completo contra Postgres con la API de Rapyd simulada.
const DB = !!process.env.DATABASE_URL;
describe.skipIf(!DB)('Rapyd: pago único y cobro automático', () => {
  let uid = 0;
  let plans = 0;
  const rejectPlan = new Set<string>();
  const calls: { method: string; path: string; body: Record<string, unknown> }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: (t: string, p?: unknown[]) => Promise<any[]>;

  beforeAll(async () => {
    query = (await import('../src/lib/db')).query;
    process.env.RAPYD_SANDBOX = '1';
    process.env.PAY_CURRENCY = 'COP';
    await query("DELETE FROM rapyd_refs WHERE code LIKE 'p%:sandbox%'");
    const [u] = await query("INSERT INTO users(email,name,password_hash) VALUES('rapyd@test.co','Ana Pérez','x') RETURNING id");
    uid = u.id;
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      const path = url.replace('https://sandboxapi.rapyd.net', '');
      const body = init.body ? JSON.parse(String(init.body)) : {};
      const h = init.headers as Record<string, string>;
      expect(h.signature).toBe(requestHeaders(String(init.method), path, String(init.body ?? ''), Number(h.timestamp) * 1000, h.salt).signature);
      calls.push({ method: String(init.method), path, body });
      const ok = (data: unknown) => new Response(JSON.stringify({ status: { status: 'SUCCESS' }, data }), { status: 200 });
      const notFound = () => new Response(JSON.stringify({ status: { status: 'ERROR', error_code: 'NOT_FOUND' } }), { status: 404 });
      if (path === '/v1/checkout') return ok({ id: 'checkout_1', redirect_url: 'https://sandboxcheckout.rapyd.net/?token=checkout_1' });
      if (init.method === 'GET') return notFound();
      if (path === '/v1/products') return ok({ id: 'product_abc' });
      if (path === '/v1/plans') return ok({ id: `plan_${++plans}` }); // Rapyd asigna su propio id
      if (path === '/v1/checkout/subscriptions' && rejectPlan.has(body.subscription_items[0].plan))
        return new Response(JSON.stringify({ status: { status: 'ERROR', error_code: 'ERROR_GET_PLAN', message: 'The request tried to retrieve a plan, but the plan was not found.' } }), { status: 400 });
      if (path === '/v1/customers') return ok({ id: 'cus_1' });
      if (path === '/v1/checkout/subscriptions') return ok({ id: 'hp_sub_1', redirect_url: 'https://sandboxcheckout.rapyd.net/?token=hp_sub_1' });
      if (init.method === 'DELETE') return ok({ id: path.split('/').pop(), status: 'canceled' });
      return notFound();
    });
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await query('DELETE FROM users WHERE id=$1', [uid]);
    await query("DELETE FROM rapyd_refs WHERE code LIKE 'p%:sandbox%'");
  });

  it('pago único: crea la página y el aviso activa el plan una sola vez', async () => {
    const { createCheckout, handleEvent } = await import('../src/lib/rapyd');
    const url = await createCheckout({ uid, plan: 'pro', period: 'monthly', base: 'https://app.test', description: 'Plan Pro' });
    expect(url).toContain('checkout_1');
    const sent = calls.find((c) => c.path === '/v1/checkout')!.body;
    expect(sent).toMatchObject({ currency: 'COP', country: 'CO', merchant_reference_id: `${uid}:pro:monthly` });

    const evt = { type: 'PAYMENT_SUCCEEDED', data: { id: 'payment_1', status: 'CLO', amount: sent.amount, currency_code: 'COP', merchant_reference_id: `${uid}:pro:monthly` } };
    expect(await handleEvent(evt)).toBe(true);
    expect(await handleEvent(evt)).toBe(false); // aviso repetido
    const [u] = await query('SELECT plan, plan_period FROM users WHERE id=$1', [uid]);
    expect(u).toMatchObject({ plan: 'pro', plan_period: 'monthly' });
    expect(await handleEvent({ type: 'PAYMENT_SUCCEEDED', data: { ...evt.data, id: 'payment_2', amount: 1 } })).toBe(false); // monto menor
  });

  it('cobro automático: suscribe, activa con el primer cobro, renueva y cancela', async () => {
    const { createSubscriptionPage, handleEvent, cancelRapyd } = await import('../src/lib/rapyd');
    const url = await createSubscriptionPage({ uid, plan: 'max', period: 'annual', base: 'https://app.test' });
    expect(url).toContain('hp_sub_1');
    const page = calls.find((c) => c.path === '/v1/checkout/subscriptions')!.body;
    expect(page).toMatchObject({ customer: 'cus_1', billing: 'pay_automatically', subscription_items: [{ plan: 'plan_1', quantity: 1 }] });
    const plan = calls.find((c) => c.path === '/v1/plans')!.body;
    expect(plan).toMatchObject({ product: 'product_abc', interval: 'year', interval_count: 1, currency: 'COP' });
    const [sub] = await query("SELECT status, amount FROM subscriptions WHERE external_id='hp_sub_1'");
    expect(sub.status).toBe('pending');

    // El aviso del pago llega antes que el de la factura: suma una vez y deja la suscripción pendiente.
    const amount = Number(sub.amount);
    expect(await handleEvent({ type: 'PAYMENT_SUCCEEDED', data: { id: 'payment_3', status: 'CLO', invoice: 'invoice_1', customer_token: 'cus_1', amount, currency_code: 'COP' } })).toBe(true);
    expect(await handleEvent({ type: 'INVOICE_PAYMENT_SUCCEEDED', data: { id: 'invoice_1', status: 'paid', customer: 'cus_1', subscription: 'sub_1', total: amount, currency: 'COP' } })).toBe(false);
    const [active] = await query("SELECT status FROM subscriptions WHERE external_id='sub_1'");
    expect(active.status).toBe('active');
    const [u1] = await query('SELECT plan, plan_expires_at FROM users WHERE id=$1', [uid]);
    expect(u1.plan).toBe('max');

    // Renovación del año siguiente.
    expect(await handleEvent({ type: 'INVOICE_PAYMENT_SUCCEEDED', data: { id: 'invoice_2', status: 'paid', customer: 'cus_1', subscription: 'sub_1', total: amount, currency: 'COP' } })).toBe(true);
    const [u2] = await query('SELECT plan_expires_at FROM users WHERE id=$1', [uid]);
    expect(new Date(u2.plan_expires_at).getFullYear()).toBe(new Date(u1.plan_expires_at).getFullYear() + 1);

    expect(await cancelRapyd(uid)).toBe(1);
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/v1/payments/subscriptions/sub_1')).toBe(true);
  });

  it('reusa el plan guardado y lo crea de nuevo si Rapyd ya no lo encuentra', async () => {
    const { createSubscriptionPage } = await import('../src/lib/rapyd');
    const before = calls.filter((c) => c.path === '/v1/plans').length;
    await createSubscriptionPage({ uid, plan: 'max', period: 'annual', base: 'https://app.test' });
    expect(calls.filter((c) => c.path === '/v1/plans').length).toBe(before); // mismo plan, sin crear otro
    rejectPlan.add('plan_1');
    await createSubscriptionPage({ uid, plan: 'max', period: 'annual', base: 'https://app.test' });
    const last = calls.filter((c) => c.path === '/v1/checkout/subscriptions').pop()!.body;
    expect(last.subscription_items).toEqual([{ plan: 'plan_2', quantity: 1 }]);
    expect(calls.filter((c) => c.path === '/v1/products').length).toBe(1);
  });
});
