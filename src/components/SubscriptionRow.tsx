'use client';
import { useEffect, useState } from 'react';
import { PERIOD_LABEL, PLANS, type Period, type PlanId } from '@/lib/plans';

type Sub = { plan: PlanId; period: Period; card_last4: string | null } | null;

/** Muestra el cobro automático activo en Mi cuenta y permite cancelarlo. */
export default function SubscriptionRow() {
  const [sub, setSub] = useState<Sub>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/billing/subscription', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSub(d?.subscription ?? null))
      .catch(() => {});
  }, []);

  async function cancel() {
    if (!window.confirm('¿Cancelar el cobro automático? Tu plan sigue activo hasta su fecha de vencimiento.')) return;
    setBusy(true);
    const res = await fetch('/api/billing/cancel', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setSub(null); setMsg('Cobro automático cancelado. Tu plan sigue hasta su fecha.'); }
    else setMsg(data.error ?? 'No se pudo cancelar.');
  }

  if (!sub && !msg) return null;
  return (
    <div className="kv">
      <span>Cobro automático</span>
      <strong>
        {sub ? (
          <>
            {PLANS[sub.plan]?.name} {PERIOD_LABEL[sub.period]?.toLowerCase()} · {sub.card_last4 ? `tarjeta ···· ${sub.card_last4}` : 'con tarjeta'}{' '}
            <button type="button" className="link" onClick={cancel} disabled={busy}>{busy ? 'Cancelando…' : 'Cancelar'}</button>
          </>
        ) : msg}
      </strong>
    </div>
  );
}
