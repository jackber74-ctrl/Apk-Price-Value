'use client';
import Link from 'next/link';
import { FEATURE_MIN, PLANS, type Feature } from '@/lib/plans';
import { usePlan } from '@/lib/use-plan';

/** Muestra el contenido solo si el plan lo incluye; si no, explica qué plan lo habilita. */
export default function PlanGate({ feature, title, children }: { feature: Feature; title?: string; children: React.ReactNode }) {
  const plan = usePlan();
  if (!plan.loaded) return <p className="muted">Cargando…</p>;
  if (plan.can(feature)) return <>{children}</>;
  const needed = PLANS[FEATURE_MIN[feature]];
  return (
    <section className="card" style={{ textAlign: 'center', maxWidth: 560, margin: '24px auto' }}>
      <h2>🔒 {title ?? 'Función de pago'}</h2>
      <p className="muted">
        Esta función viene con el plan <strong>{needed.name}</strong> o uno superior. Tu plan actual es <strong>{PLANS[plan.plan].name}</strong>.
      </p>
      <Link className="btn" href="/planes">Ver planes</Link>
    </section>
  );
}

/** Aviso corto para invitar a mejorar el plan dentro de una pantalla. */
export function Upsell({ feature, children }: { feature: Feature; children: React.ReactNode }) {
  const needed = PLANS[FEATURE_MIN[feature]];
  return (
    <p className="muted small" style={{ margin: '8px 0' }}>
      🔒 {children} <Link href="/planes">Disponible desde el plan {needed.name}</Link>.
    </p>
  );
}
