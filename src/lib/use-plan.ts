'use client';
import { useEffect, useState } from 'react';
import { api } from './client';
import { planHas, type Feature, type Period, type PlanId } from './plans';

export type PlanState = { loaded: boolean; plan: PlanId; lifetime: boolean; period: Period | null; expires: string | null };

const INITIAL: PlanState = { loaded: false, plan: 'free', lifetime: false, period: null, expires: null };
let cache: Promise<PlanState> | null = null;

function fetchPlan() {
  cache ??= api<{ plan: PlanId; lifetime: boolean; period: Period | null; expires: string | null }>('/api/plan')
    .then((d) => ({ loaded: true, ...d }))
    .catch(() => {
      cache = null;
      return { ...INITIAL, loaded: true };
    });
  return cache;
}

/** Plan de la persona que inició sesión y qué funciones incluye. */
export function usePlan() {
  const [state, setState] = useState<PlanState>(INITIAL);
  useEffect(() => {
    let alive = true;
    fetchPlan().then((s) => alive && setState(s));
    return () => { alive = false; };
  }, []);
  return { ...state, can: (f: Feature) => planHas(state.plan, f) };
}
