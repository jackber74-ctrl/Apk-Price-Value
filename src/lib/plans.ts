// Planes, precios (USD) y qué incluye cada uno. Lo comparten el servidor (para bloquear) y las pantallas (para mostrar).

export type PlanId = 'free' | 'pro' | 'plus' | 'max';
export type Period = 'monthly' | 'semester' | 'annual';
/** save = guardar y cotizador · search = buscador de proveedores · advanced = modo avanzado completo */
export type Feature = 'save' | 'search' | 'advanced';

export const PLAN_ORDER: PlanId[] = ['free', 'pro', 'plus', 'max'];
export const PERIODS: Period[] = ['monthly', 'semester', 'annual'];
export const PERIOD_MONTHS: Record<Period, number> = { monthly: 1, semester: 6, annual: 12 };
export const PERIOD_LABEL: Record<Period, string> = { monthly: 'Mensual', semester: 'Semestral', annual: 'Anual' };
export const PERIOD_UNIT: Record<Period, string> = { monthly: 'mes', semester: 'semestre', annual: 'año' };

export type PlanInfo = { id: PlanId; name: string; tagline: string; includes: string[] };

export const PLANS: Record<PlanId, PlanInfo> = {
  free: {
    id: 'free', name: 'Free', tagline: 'Para sacar un precio rápido',
    includes: ['Calculadora básica de costo y precio de un producto o servicio', 'Sin guardar datos'],
  },
  pro: {
    id: 'pro', name: 'Pro', tagline: 'Guarda y cotiza',
    includes: ['Todo lo de Free', 'Cotizador con clientes y logo', 'Guardar cálculos, insumos y gastos fijos', 'Pasar de la calculadora al cotizador y viceversa'],
  },
  plus: {
    id: 'plus', name: 'Pro+', tagline: 'Encuentra proveedores',
    includes: ['Todo lo de Pro', 'Buscador de proveedores en línea', 'Guardar resultados como insumos y cotizaciones'],
  },
  max: {
    id: 'max', name: 'Pro+Plus', tagline: 'Todo incluido',
    includes: ['Todo lo de Pro+', 'Modo avanzado completo: recetas, mano de obra, equipos y punto de equilibrio', 'Comparador de proveedores y diagnóstico', 'Las actualizaciones futuras'],
  },
};

/** Precio en dólares por periodo completo. */
export const PRICES: Record<Exclude<PlanId, 'free'>, Record<Period, number>> = {
  pro: { monthly: 1, semester: 4, annual: 7 },
  plus: { monthly: 2, semester: 7, annual: 10 },
  max: { monthly: 3, semester: 10, annual: 14 },
};

export const FEATURE_MIN: Record<Feature, PlanId> = { save: 'pro', search: 'plus', advanced: 'max' };

export const planLevel = (p: PlanId) => PLAN_ORDER.indexOf(p);
export const planHas = (plan: PlanId, feature: Feature) => planLevel(plan) >= planLevel(FEATURE_MIN[feature]);
export const isPlanId = (v: unknown): v is PlanId => PLAN_ORDER.includes(v as PlanId);
export const isPeriod = (v: unknown): v is Period => PERIODS.includes(v as Period);

/** Lo que cuesta el periodo y cuánto se ahorra frente a pagar mes a mes. */
export function pricing(plan: Exclude<PlanId, 'free'>, period: Period) {
  const price = PRICES[plan][period];
  const full = PRICES[plan].monthly * PERIOD_MONTHS[period];
  const saved = full - price;
  return { price, full, saved, pct: full > 0 ? Math.round((saved / full) * 100) : 0, perMonth: price / PERIOD_MONTHS[period] };
}

/** Mayor ahorro porcentual que ofrece un periodo entre los planes de pago (para la barra del selector). */
export function bestSaving(period: Period) {
  return Math.max(...(Object.keys(PRICES) as Exclude<PlanId, 'free'>[]).map((p) => pricing(p, period).pct));
}

export type PlanRow = { plan: string | null; plan_lifetime: boolean | null; plan_expires_at: string | Date | null };

/** Plan que vale hoy: de por vida es el máximo; uno de pago vencido vuelve a Free. */
export function effectivePlan(row: PlanRow | undefined, now = new Date()): PlanId {
  if (!row) return 'free';
  if (row.plan_lifetime) return 'max';
  const plan = isPlanId(row.plan) ? row.plan : 'free';
  if (plan === 'free') return 'free';
  if (!row.plan_expires_at || new Date(row.plan_expires_at).getTime() < now.getTime()) return 'free';
  return plan;
}

/** Pesos colombianos por dólar. Los precios base están en USD y se muestran y cobran en COP con esta tasa fija. */
export const USD_COP = 3700;

/** Precio del periodo en pesos (redondeado al peso). */
export const priceCop = (plan: Exclude<PlanId, 'free'>, period: Period) => Math.round(PRICES[plan][period] * USD_COP);

/** Lo mismo que pricing() pero en pesos colombianos. */
export function pricingCop(plan: Exclude<PlanId, 'free'>, period: Period) {
  const p = pricing(plan, period);
  const price = priceCop(plan, period);
  const full = Math.round(p.full * USD_COP);
  return { price, full, saved: full - price, pct: p.pct, perMonth: price / PERIOD_MONTHS[period] };
}

/** $25.900 (separador de miles con punto, sin decimales). */
export const cop = (v: number) => `$${String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

export const usd = (v: number) => `US$${Number.isInteger(v) ? v : v.toFixed(2).replace('.', ',')}`;
