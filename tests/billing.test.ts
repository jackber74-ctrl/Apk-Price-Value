import { describe, expect, it, beforeEach } from 'vitest';
import { chargeAmount, makeReference, nextExpiry, parseReference } from '../src/lib/billing';

describe('cobros', () => {
  beforeEach(() => { process.env.MP_CURRENCY = 'COP'; });
  it('convierte USD a pesos a 3.700', () => {
    expect(chargeAmount('pro', 'monthly')).toBe(3700);
    expect(chargeAmount('max', 'annual')).toBe(51800);
  });
  it('en USD cobra el precio tal cual', () => {
    process.env.MP_CURRENCY = 'USD';
    expect(chargeAmount('plus', 'semester')).toBe(7);
  });
  it('referencia ida y vuelta y rechaza basura', () => {
    expect(parseReference(makeReference(5, 'plus', 'annual'))).toEqual({ uid: 5, plan: 'plus', period: 'annual' });
    expect(parseReference('5:free:annual')).toBeNull();
    expect(parseReference('x:pro:monthly')).toBeNull();
    expect(parseReference(undefined)).toBeNull();
  });
  it('renovar suma al vencimiento; vencido o distinto plan cuenta desde hoy', () => {
    const now = new Date('2026-01-10T00:00:00Z');
    const vigente = { plan: 'pro', plan_expires_at: '2026-03-10T00:00:00Z' };
    expect(nextExpiry(vigente, 'pro', 'semester', now).toISOString().slice(0, 10)).toBe('2026-09-10');
    expect(nextExpiry(vigente, 'plus', 'monthly', now).toISOString().slice(0, 10)).toBe('2026-02-10');
    expect(nextExpiry({ plan: 'pro', plan_expires_at: '2025-12-01T00:00:00Z' }, 'pro', 'monthly', now).toISOString().slice(0, 10)).toBe('2026-02-10');
  });
});
