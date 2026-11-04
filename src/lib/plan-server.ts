import { NextResponse } from 'next/server';
import { query } from './db';
import { FEATURE_MIN, PLANS, effectivePlan, planHas, type Feature, type PlanRow } from './plans';

export async function getPlan(uid: number) {
  const [row] = await query<PlanRow & { plan_period: string | null }>(
    'SELECT plan, plan_period, plan_expires_at, plan_lifetime FROM users WHERE id = $1',
    [uid],
  );
  return { plan: effectivePlan(row), row };
}

/** Devuelve una respuesta 402 si el plan de la persona no incluye la función; si la incluye, null. */
export async function requireFeature(uid: number, feature: Feature | undefined): Promise<NextResponse | null> {
  if (!feature) return null;
  const { plan } = await getPlan(uid);
  if (planHas(plan, feature)) return null;
  return NextResponse.json(
    { error: `Esta función es del plan ${PLANS[FEATURE_MIN[feature]].name} o superior.`, upgrade: FEATURE_MIN[feature] },
    { status: 402 },
  );
}
