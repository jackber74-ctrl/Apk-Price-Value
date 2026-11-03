// Cálculo completo del modo avanzado (equivale a la hoja "Productos y Precios" de la plantilla).
import {
  allocateFixed, diagnose, equipmentMonthly, monthlyAmount, suggestedPrice, supplyUnitCost, workerMonthlyCost,
  breakEvenUnits, type Equipment, type Settings, type Supply, type Worker,
} from './pricing';

export type SupplyRow = Supply & { id: number; name: string; unit: string; supplier_id: number | null; url: string; price_date: string; presentation: string; category: string };
export type WorkerRow = Worker & { id: number; name: string };
export type EquipmentRow = Equipment & { id: number; name: string };
export type FixedRow = { id: number; name: string; amount: number; frequency: string; mandatory: boolean; category: string };
export type ProductRow = {
  id: number; name: string; kind: string; category: string; units_month: number; other_var_cost: number;
  margin: number | null; commission: number | null; iva_pct: number | null; current_price: number | null; competitor_price: number | null;
};
export type RecipeRow = { id: number; product_id: number; supply_id: number; qty: number };
export type StepRow = { id: number; product_id: number; step: string; worker_id: number | null; minutes: number; equipment_id: number | null; equip_minutes: number };

export type AdvancedData = {
  settings: Settings;
  supplies: SupplyRow[];
  workers: WorkerRow[];
  equipment: EquipmentRow[];
  fixed: FixedRow[];
  products: ProductRow[];
  recipes: RecipeRow[];
  steps: StepRow[];
};

export function fixedTotals(d: AdvancedData) {
  const table = d.fixed.reduce((a, f) => a + monthlyAmount(f.amount, f.frequency), 0);
  const indirectLabor = d.workers.filter((w) => !w.direct).reduce((a, w) => a + workerMonthlyCost(w, d.settings).total, 0);
  const equipAsFixed = d.equipment.filter((e) => e.charge !== 'Por minutos de uso').reduce((a, e) => a + equipmentMonthly(e).monthly, 0);
  return { table, indirectLabor, equipAsFixed, total: table + indirectLabor + equipAsFixed };
}

export function computeProducts(d: AdvancedData) {
  const cfg = d.settings;
  const supplyCost = new Map(d.supplies.map((s) => [s.id, supplyUnitCost(s, cfg.iva_responsable)]));
  const workerMin = new Map(d.workers.map((w) => [w.id, workerMonthlyCost(w, cfg).perMinute]));
  const equipMin = new Map(d.equipment.map((e) => [e.id, equipmentMonthly(e).perMinute]));
  const fx = fixedTotals(d);

  const base = d.products.map((p) => {
    const materials = d.recipes.filter((r) => r.product_id === p.id).reduce((a, r) => a + (supplyCost.get(r.supply_id) ?? 0) * r.qty, 0);
    const steps = d.steps.filter((s) => s.product_id === p.id);
    const minutes = steps.reduce((a, s) => a + s.minutes, 0);
    const labor = steps.reduce((a, s) => a + (s.worker_id ? (workerMin.get(s.worker_id) ?? 0) * s.minutes : 0), 0);
    const equip = steps.reduce((a, s) => a + (s.equipment_id ? (equipMin.get(s.equipment_id) ?? 0) * s.equip_minutes : 0), 0);
    const direct = materials + (p.other_var_cost || 0) + labor + equip;
    return { p, materials, minutes, labor, equip, direct };
  });

  const totals = {
    units: base.reduce((a, b) => a + (b.p.units_month || 0), 0),
    minutesTotal: base.reduce((a, b) => a + (b.p.units_month || 0) * b.minutes, 0),
  };

  return base.map((b) => {
    const p = b.p;
    const fixedShare = allocateFixed(cfg.fixed_method, fx.total, { units: p.units_month, minutes: b.minutes }, totals);
    const total = b.direct + fixedShare;
    const margin = p.margin ?? cfg.margin;
    const commission = p.commission ?? cfg.commission;
    const iva = cfg.iva_responsable ? (p.iva_pct ?? cfg.iva_rate) : 0;
    const price = suggestedPrice({ unitCost: total, margin, commission, ivaRate: iva, roundTo: cfg.round_to });
    const inUse = p.current_price ?? price.finalPrice;
    const inUseNoTax = inUse / (1 + iva);
    const profit = inUseNoTax * (1 - commission) - total;
    const realMargin = inUseNoTax > 0 ? profit / inUseNoTax : 0;
    const contribution = inUseNoTax * (1 - commission) - b.direct;
    const compRatio = p.competitor_price ? inUse / p.competitor_price - 1 : null;
    return {
      ...b,
      fixedShare,
      total,
      margin,
      commission,
      iva,
      price,
      inUse,
      profit,
      realMargin,
      contribution,
      compRatio,
      monthlySales: inUseNoTax * (p.units_month || 0),
      monthlyProfit: profit * (p.units_month || 0),
      breakEven: breakEvenUnits(fx.total, inUseNoTax, b.direct, commission),
      diagnosis: price.ok ? diagnose(profit, realMargin, margin, compRatio) : (price.message ?? 'Revisa los datos'),
    };
  });
}
