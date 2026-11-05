'use client';
import Link from 'next/link';
import { PLANS } from '@/lib/plans';
import { usePlan } from '@/lib/use-plan';

const DAYS = 7;

/** Aviso dentro de la app cuando el plan de pago vence pronto o ya venció, con enlace para renovar. */
export default function RenewBanner() {
  const plan = usePlan();
  if (!plan.loaded || plan.lifetime || !plan.expires) return null;
  const left = Math.ceil((new Date(plan.expires).getTime() - Date.now()) / 86_400_000);
  if (left > DAYS) return null;
  const fecha = new Date(plan.expires).toLocaleDateString('es-CO');
  return (
    <div className="alert" style={{ margin: '12px auto', maxWidth: 1040 }}>
      {left > 0
        ? <>Tu plan vence el <strong>{fecha}</strong> ({left === 1 ? 'mañana' : `en ${left} días`}). </>
        : <>Tu plan venció el <strong>{fecha}</strong> y volviste a Free. </>}
      <Link href="/planes">Renovar ahora</Link>
    </div>
  );
}
