import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { cardType, luhn, planCode } from '../src/lib/payu-recurring';

describe('tarjetas', () => {
  it('reconoce el tipo y valida con Luhn', () => {
    expect(cardType('4111 1111 1111 1111')).toBe('VISA');
    expect(cardType('5500000000000004')).toBe('MASTERCARD');
    expect(cardType('378282246310005')).toBe('AMEX');
    expect(luhn('4111111111111111')).toBe(true);
    expect(luhn('4111111111111112')).toBe(false);
    expect(planCode('pro', 'annual', 28000, 'COP')).toBe('apv-pro-annual-28000-cop');
  });
});

// Flujo completo contra Postgres con la API de PayU simulada.
const DB = !!process.env.DATABASE_URL;
describe.skipIf(!DB)('suscripción automática', () => {
  let uid = 0;
  const calls: string[] = [];
  let bills: { id: string; state: string; amount: number; currency: string }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: (t: string, p?: unknown[]) => Promise<any[]>;

  beforeAll(async () => {
    query = (await import('../src/lib/db')).query;
    process.env.PAYU_TEST = '1';
    process.env.PAYU_RECURRING = '1';
    process.env.PAY_CURRENCY = 'COP';
    process.env.USD_RATE = '4000';
    const [u] = await query("INSERT INTO users(email,name,password_hash) VALUES('rec@test.co','Ana Pérez','x') RETURNING id");
    uid = u.id;
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      const path = url.replace(/^.*v4\.9/, '');
      calls.push(`${init.method} ${path}`);
      const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
      if (init.method === 'GET' && path.startsWith('/plans/')) return json(404, { description: 'not found' });
      if (path === '/plans') return json(201, {});
      if (path === '/customers') return json(201, { id: 'cus-1' });
      if (path.endsWith('/creditCards')) {
        expect(JSON.parse(String(init.body)).type).toBe('VISA');
        return json(201, { token: 'tok-1' });
      }
      if (path === '/subscriptions') {
        bills = [{ id: 'b1', state: 'PAID', amount: 28000, currency: 'COP' }];
        return json(201, { id: 'sub-1' });
      }
      if (path.startsWith('/recurringBill')) return json(200, { recurringBillList: bills });
      if (init.method === 'DELETE') return json(200, {});
      return json(500, { description: 'inesperado' });
    });
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    await query("DELETE FROM payments WHERE payment_id LIKE 'payu:bill:%'");
    await query("DELETE FROM users WHERE email='rec@test.co'");
  });

  it('cobra, activa el plan, renueva una vez por cobro y cancela', async () => {
    const { subscribe, syncBills, cancelSubscription } = await import('../src/lib/payu-recurring');
    await subscribe(uid, 'pro', 'annual', { name: 'Ana Perez', document: '1234567', number: '4111111111111111', expMonth: '08', expYear: '2030' });
    let [u] = await query('SELECT plan, plan_expires_at FROM users WHERE id=$1', [uid]);
    expect(u.plan).toBe('pro');
    const first = new Date(u.plan_expires_at).getTime();

    expect(await syncBills('sub-1')).toBe(0); // mismo cobro, no suma dos veces
    bills.push({ id: 'b2', state: 'PAID', amount: 28000, currency: 'COP' }); // renovación del año siguiente
    expect(await syncBills('sub-1')).toBe(1);
    [u] = await query('SELECT plan_expires_at FROM users WHERE id=$1', [uid]);
    expect(new Date(u.plan_expires_at).getTime()).toBeGreaterThan(first + 300 * 86400000);

    const [s] = await query("SELECT card_last4 FROM subscriptions WHERE external_id='sub-1'");
    expect(s.card_last4).toBe('1111');
    expect(await cancelSubscription(uid)).toBe(1);
    expect(calls).toContain('DELETE /subscriptions/sub-1');
  });
});
