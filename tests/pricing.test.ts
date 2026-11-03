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
