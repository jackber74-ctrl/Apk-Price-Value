import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS, breakEvenUnits, equipmentMonthly, monthlyAmount, roundUp, suggestedPrice, supplyUnitCost, workerMonthlyCost,
} from '../src/lib/pricing';
import { computeProducts } from '../src/lib/advanced';
import { parseCop } from '../src/lib/format';

describe('precio sugerido', () => {
  it('calcula el margen sobre el precio, como la plantilla', () => {
    // costo 10.000, margen 30 %, comisión 3 % -> 10.000 / 0,67 = 14.925,37 -> redondeo a 500 = 15.000
    const r = suggestedPrice({ unitCost: 10000, margin: 0.3, commission: 0.03, ivaRate: 0, roundTo: 500 });
    expect(r.priceNoTax).toBeCloseTo(14925.37, 1);
    expect(r.finalPrice).toBe(15000);
    expect(r.profit).toBeCloseTo(15000 * 0.97 - 10000, 5);
  });

  it('agrega IVA y redondea hacia arriba', () => {
    const r = suggestedPrice({ unitCost: 10000, margin: 0.3, commission: 0, ivaRate: 0.19, roundTo: 500 });
    expect(r.priceWithTax).toBeCloseTo((10000 / 0.7) * 1.19, 3);
    expect(r.finalPrice).toBe(17000);
  });

  it('permite margen sobre el costo (markup)', () => {
    const r = suggestedPrice({ unitCost: 10000, margin: 0.3, commission: 0, ivaRate: 0, roundTo: 0, marginMode: 'costo' });
    expect(r.finalPrice).toBe(13000);
  });

  it('avisa si margen + comisión llegan a 100 %', () => {
    expect(suggestedPrice({ unitCost: 1, margin: 0.9, commission: 0.1, ivaRate: 0, roundTo: 0 }).ok).toBe(false);
  });

  it('redondea igual que CEILING', () => {
    expect(roundUp(43120, 500)).toBe(43500);
    expect(roundUp(43500, 500)).toBe(43500);
    expect(roundUp(43120.4, 0)).toBe(43120);
  });
});

describe('costos', () => {
  it('costo por unidad de insumo con merma', () => {
    // bolsa 1000 g a 4.300 con 2 % de merma
    expect(supplyUnitCost({ price: 4300, qty: 1000, iva_pct: 0, waste_pct: 0.02 }, false)).toBeCloseTo(4.3878, 3);
  });

  it('descuenta el IVA solo si eres responsable', () => {
    const s = { price: 1190, qty: 1, iva_pct: 0.19, waste_pct: 0 };
    expect(supplyUnitCost(s, true)).toBeCloseTo(1000, 5);
    expect(supplyUnitCost(s, false)).toBe(1190);
  });

  it('gastos por frecuencia', () => {
    expect(monthlyAmount(1200000, 'Anual')).toBe(100000);
    expect(monthlyAmount(300000, 'Trimestral')).toBe(100000);
  });

  it('costo de un trabajador con salario mínimo 2026', () => {
    const w = workerMonthlyCost({ contract: 'Contrato laboral', direct: true, salary: 1750905, arl_class: 'I' }, DEFAULT_SETTINGS);
    const s = 1750905;
    const aux = 249095;
    const expected = s + aux + s * 0.085 + s * 0.12 + s * 0.00522 + s * 0.04 + s * 0.05 + ((s + aux) / 12) * 2 + ((s + aux) / 12) * 0.12 + s / 24;
    expect(w.total).toBeCloseTo(expected, 2);
    expect(w.hours).toBeCloseTo(178.5, 5);
  });

  it('prestación de servicios no suma prestaciones', () => {
    const w = workerMonthlyCost({ contract: 'Prestación de servicios', direct: true, salary: 2000000, arl_class: 'I' }, DEFAULT_SETTINGS);
    expect(w.total).toBe(2000000);
  });

  it('depreciación de equipos', () => {
    const e = equipmentMonthly({ cost: 1200000, life_years: 5, residual: 0, maint_year: 120000, charge: 'Por minutos de uso', hours_month: 50 });
    expect(e.dep).toBe(20000);
    expect(e.monthly).toBe(30000);
    expect(e.perMinute).toBe(10);
  });

  it('punto de equilibrio', () => {
    expect(breakEvenUnits(1000000, 20000, 10000, 0)).toBe(100);
    expect(breakEvenUnits(1000000, 10000, 10000, 0)).toBe(Infinity);
  });
});

describe('modo avanzado', () => {
  it('reparte los gastos fijos por unidad y calcula el precio', () => {
    const res = computeProducts({
      settings: { ...DEFAULT_SETTINGS, commission: 0, round_to: 0 },
      supplies: [{ id: 1, name: 'Esencia', unit: 'ml', qty: 100, price: 50000, iva_pct: 0, waste_pct: 0, supplier_id: null, url: '', price_date: '', presentation: '', category: '' }],
      workers: [],
      equipment: [],
      fixed: [{ id: 1, name: 'Arriendo', amount: 100000, frequency: 'Mensual', mandatory: true, category: '' }],
      products: [
        { id: 1, name: 'Perfume', kind: 'Producto', category: '', units_month: 10, other_var_cost: 2000, margin: null, commission: null, iva_pct: null, current_price: null, competitor_price: null },
      ],
      recipes: [{ id: 1, product_id: 1, supply_id: 1, qty: 30 }],
      steps: [],
    });
    expect(res[0].materials).toBe(15000);
    expect(res[0].fixedShare).toBe(10000);
    expect(res[0].total).toBe(27000);
    expect(res[0].price.finalPrice).toBe(Math.round(27000 / 0.7));
  });
});

describe('lectura de precios', () => {
  it('entiende formatos colombianos', () => {
    expect(parseCop('$ 43.500')).toBe(43500);
    expect(parseCop('COP 1.250.000,50')).toBe(1250000.5);
    expect(parseCop('')).toBe(null);
  });
});

import { estimateTotals, nextNumber } from '../src/lib/estimate';

describe('cotizador', () => {
  const items = [
    { id: 'a', name: 'A', desc: '', kind: 'Producto' as const, qty: 2, price: 10000 },
    { id: 'b', name: 'B', desc: '', kind: 'Servicio' as const, qty: 1, price: 30000 },
  ];
  it('suma líneas, descuento e IVA', () => {
    const t = estimateTotals(items, 10, 19);
    expect(t.subtotal).toBe(50000);
    expect(t.discount).toBe(5000);
    expect(t.base).toBe(45000);
    expect(t.iva).toBeCloseTo(8550);
    expect(t.total).toBeCloseTo(53550);
  });
  it('ignora descuentos fuera de rango', () => {
    expect(estimateTotals(items, 150, 0).total).toBe(0);
    expect(estimateTotals(items, -5, 0).total).toBe(50000);
  });
  it('genera el siguiente consecutivo', () => {
    expect(nextNumber([])).toBe('COT-0001');
    expect(nextNumber(['COT-0003', 'COT-0009', ''])).toBe('COT-0010');
  });
});

import { dominantColor, isLogo, readableOn, tint } from '../src/lib/brand';

describe('marca', () => {
  const px = (r: number, g: number, b: number, a = 255, n = 10) => Array.from({ length: n }, () => [r, g, b, a]).flat();
  it('toma el color con más presencia e ignora blanco, gris y transparente', () => {
    const data = [...px(255, 255, 255, 255, 500), ...px(120, 120, 120, 255, 300), ...px(200, 30, 30, 0, 300), ...px(30, 60, 200, 255, 20), ...px(220, 40, 40, 255, 5)];
    expect(dominantColor(data)).toBe('#1e3cc8');
  });
  it('si no hay color devuelve el de la app', () => {
    expect(dominantColor(px(255, 255, 255, 255, 50))).toBe('#0f766e');
  });
  it('elige texto legible y aclara colores', () => {
    expect(readableOn('#111111')).toBe('#ffffff');
    expect(readableOn('#fde047')).toBe('#111827');
    expect(tint('#000000', 0.9)).toBe('#e6e6e6');
  });
  it('solo acepta imágenes en data URL', () => {
    expect(isLogo('data:image/png;base64,AAAA')).toBe(true);
    expect(isLogo('data:image/svg+xml;base64,AAAA')).toBe(false);
    expect(isLogo('https://x.co/a.png')).toBe(false);
  });
});

import { PRICES, bestSaving, effectivePlan, planHas, pricing } from '../src/lib/plans';

describe('planes', () => {
  it('tiene los precios pedidos', () => {
    expect(PRICES.pro).toEqual({ monthly: 1, semester: 4, annual: 7 });
    expect(PRICES.plus).toEqual({ monthly: 2, semester: 7, annual: 10 });
    expect(PRICES.max).toEqual({ monthly: 3, semester: 10, annual: 14 });
  });
  it('calcula el ahorro frente a pagar mes a mes', () => {
    expect(pricing('pro', 'semester')).toMatchObject({ full: 6, saved: 2, pct: 33 });
    expect(pricing('pro', 'annual')).toMatchObject({ full: 12, saved: 5, pct: 42 });
    expect(pricing('plus', 'semester')).toMatchObject({ saved: 5, pct: 42 });
    expect(pricing('plus', 'annual')).toMatchObject({ saved: 14, pct: 58 });
    expect(pricing('max', 'semester')).toMatchObject({ saved: 8, pct: 44 });
    expect(pricing('max', 'annual')).toMatchObject({ saved: 22, pct: 61 });
    expect(pricing('max', 'monthly')).toMatchObject({ saved: 0, pct: 0 });
    expect(bestSaving('semester')).toBe(44);
    expect(bestSaving('annual')).toBe(61);
  });
  it('cada plan incluye lo del anterior', () => {
    expect(planHas('free', 'save')).toBe(false);
    expect(planHas('pro', 'save')).toBe(true);
    expect(planHas('pro', 'search')).toBe(false);
    expect(planHas('plus', 'search')).toBe(true);
    expect(planHas('plus', 'advanced')).toBe(false);
    expect(planHas('max', 'advanced')).toBe(true);
  });
  it('de por vida es máximo y un plan vencido vuelve a Free', () => {
    const now = new Date('2026-11-05T00:00:00Z');
    expect(effectivePlan({ plan: 'max', plan_lifetime: true, plan_expires_at: null }, now)).toBe('max');
    expect(effectivePlan({ plan: 'pro', plan_lifetime: false, plan_expires_at: '2026-12-01T00:00:00Z' }, now)).toBe('pro');
    expect(effectivePlan({ plan: 'pro', plan_lifetime: false, plan_expires_at: '2026-10-01T00:00:00Z' }, now)).toBe('free');
    expect(effectivePlan({ plan: 'pro', plan_lifetime: false, plan_expires_at: null }, now)).toBe('free');
    expect(effectivePlan(undefined, now)).toBe('free');
  });
});
