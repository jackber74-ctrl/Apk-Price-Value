// Fórmulas de costos y precios. Siguen la lógica de la "Plantilla de costos, precios y
// contabilidad – Colombia 2026": el margen se calcula sobre el precio de venta, no sobre el costo.

export type Settings = {
  business_name: string;
  iva_responsable: boolean;
  iva_rate: number;
  margin: number;
  commission: number;
  round_to: number;
  fixed_method: 'unidad' | 'minuto';
  min_wage: number;
  transport_aid: number;
  hours_month: number;
  productive_pct: number;
  exonerated: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  business_name: 'Mi emprendimiento',
  iva_responsable: false,
  iva_rate: 0.19,
  margin: 0.3,
  commission: 0.03,
  round_to: 500,
  fixed_method: 'unidad',
  min_wage: 1750905,
  transport_aid: 249095,
  hours_month: 210,
  productive_pct: 0.85,
  exonerated: false,
};

export const FREQUENCY_MONTHS: Record<string, number> = {
  Mensual: 1,
  Bimestral: 2,
  Trimestral: 3,
  Semestral: 6,
  Anual: 12,
  Quincenal: 0.5,
  Semanal: 12 / 52,
};

export const ARL_RATES: Record<string, number> = {
  I: 0.00522,
  II: 0.01044,
  III: 0.02436,
  IV: 0.0435,
  V: 0.0696,
};

const n = (v: unknown) => {
  const x = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(x) ? x : 0;
};

/** Redondea hacia arriba al múltiplo indicado (como CEILING en Excel). */
export function roundUp(value: number, multiple: number) {
  if (!Number.isFinite(value)) return 0;
  if (multiple <= 0) return Math.round(value);
  return Math.ceil(value / multiple - 1e-9) * multiple;
}

export function monthlyAmount(amount: number, frequency: string) {
  return n(amount) / (FREQUENCY_MONTHS[frequency] ?? 1);
}

// ---------- Insumos ----------
export type Supply = { price: number; qty: number; iva_pct: number; waste_pct: number };

/** Costo neto de la presentación: si eres responsable de IVA lo descuentas; si no, es parte del costo. */
export function supplyNetCost(s: Supply, ivaResponsable: boolean) {
  const price = n(s.price);
  return ivaResponsable ? price / (1 + n(s.iva_pct)) : price;
}

/** Costo por unidad de medida, ya con la merma. */
export function supplyUnitCost(s: Supply, ivaResponsable: boolean) {
  const qty = n(s.qty);
  const waste = n(s.waste_pct);
  if (qty <= 0 || waste >= 1) return 0;
  return supplyNetCost(s, ivaResponsable) / (qty * (1 - waste));
}

// ---------- Mano de obra ----------
export type Worker = { contract: string; direct: boolean; salary: number; arl_class: string; hours?: number | null };

export function workerMonthlyCost(w: Worker, cfg: Settings) {
  const salary = n(w.salary);
  const hours = n(w.hours) > 0 ? n(w.hours) : cfg.hours_month * cfg.productive_pct;
  if (w.contract !== 'Contrato laboral') {
    return { total: salary, perMinute: hours > 0 ? salary / (hours * 60) : 0, hours, extra: 0 };
  }
  const aux = salary <= 2 * cfg.min_wage ? cfg.transport_aid : 0;
  const exempt = cfg.exonerated && salary < 10 * cfg.min_wage;
  const health = exempt ? 0 : salary * 0.085;
  const pension = salary * 0.12;
  const arl = salary * (ARL_RATES[w.arl_class] ?? ARL_RATES.I);
  const caja = salary * 0.04;
  const icbfSena = exempt ? 0 : salary * 0.05;
  const prima = (salary + aux) / 12;
  const cesantias = (salary + aux) / 12;
  const intereses = cesantias * 0.12;
  const vacaciones = salary / 24;
  const total = salary + aux + health + pension + arl + caja + icbfSena + prima + cesantias + intereses + vacaciones;
  return { total, perMinute: hours > 0 ? total / (hours * 60) : 0, hours, extra: salary > 0 ? total / salary - 1 : 0 };
}

// ---------- Equipos ----------
export type Equipment = { cost: number; life_years: number; residual: number; maint_year: number; charge: string; hours_month: number };

export function equipmentMonthly(e: Equipment) {
  const life = n(e.life_years);
  const dep = life > 0 ? (n(e.cost) - n(e.residual)) / (life * 12) : 0;
  const monthly = dep + n(e.maint_year) / 12;
  const perMinute = e.charge === 'Por minutos de uso' && n(e.hours_month) > 0 ? monthly / (n(e.hours_month) * 60) : 0;
  return { dep, monthly, perMinute };
}

// ---------- Precio sugerido ----------
export type PriceInput = {
  unitCost: number; // costo total por unidad (variables + fijos asignados)
  margin: number; // 0.30 = 30 % sobre el precio
  commission: number; // comisión de pagos o plataformas
  ivaRate: number; // 0 si no cobras IVA
  roundTo: number;
  marginMode?: 'precio' | 'costo'; // 'costo' = markup sobre el costo
};

export type PriceResult = {
  ok: boolean;
  message?: string;
  priceNoTax: number;
  tax: number;
  priceWithTax: number;
  finalPrice: number; // redondeado, con impuesto
  profit: number; // utilidad por unidad con el precio final
  realMargin: number;
};

export function suggestedPrice(p: PriceInput): PriceResult {
  const cost = Math.max(0, n(p.unitCost));
  const m = n(p.margin);
  const c = n(p.commission);
  const iva = n(p.ivaRate);
  let priceNoTax: number;
  if (p.marginMode === 'costo') {
    if (1 - c <= 0) return fail('La comisión no puede ser 100 % o más.');
    priceNoTax = (cost * (1 + m)) / (1 - c);
  } else {
    if (1 - m - c <= 0) return fail('El margen más la comisión debe ser menor a 100 %.');
    priceNoTax = cost / (1 - m - c);
  }
  const priceWithTax = priceNoTax * (1 + iva);
  const finalPrice = roundUp(priceWithTax, n(p.roundTo));
  const finalNoTax = finalPrice / (1 + iva);
  const profit = finalNoTax * (1 - c) - cost;
  return {
    ok: true,
    priceNoTax,
    tax: priceWithTax - priceNoTax,
    priceWithTax,
    finalPrice,
    profit,
    realMargin: finalNoTax > 0 ? profit / finalNoTax : 0,
  };
}

function fail(message: string): PriceResult {
  return { ok: false, message, priceNoTax: 0, tax: 0, priceWithTax: 0, finalPrice: 0, profit: 0, realMargin: 0 };
}

/** Unidades que debes vender al mes para cubrir los gastos fijos. */
export function breakEvenUnits(fixedMonthly: number, priceNoTax: number, variableCost: number, commission: number) {
  const contribution = priceNoTax * (1 - commission) - variableCost;
  if (contribution <= 0) return Infinity;
  return Math.ceil(fixedMonthly / contribution);
}

export function diagnose(profit: number, realMargin: number, targetMargin: number, competitorRatio?: number | null) {
  if (profit < 0) return '⚠ Pierdes dinero';
  if (realMargin < targetMargin - 0.05) return 'Revisa: margen por debajo del deseado';
  if (competitorRatio != null && competitorRatio > 0.2) return 'Ojo: más de 20 % sobre la competencia';
  return '✓ Precio sano';
}

// ---------- Modo avanzado: costo completo de un producto ----------
export type ProductCalcInput = {
  materials: number;
  otherVar: number;
  labor: number;
  equipment: number;
  minutes: number;
  units: number;
};

export function allocateFixed(
  method: 'unidad' | 'minuto',
  fixedTotal: number,
  product: { units: number; minutes: number },
  totals: { units: number; minutesTotal: number },
) {
  if (method === 'minuto') {
    return totals.minutesTotal > 0 ? (fixedTotal * product.minutes) / totals.minutesTotal : 0;
  }
  return totals.units > 0 ? fixedTotal / totals.units : 0;
}
