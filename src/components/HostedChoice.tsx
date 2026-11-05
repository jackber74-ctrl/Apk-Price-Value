'use client';
import { useState } from 'react';
import { PERIOD_LABEL, PLANS, type Period, type PlanId } from '@/lib/plans';

/** Elige entre suscribirse (se renueva sola en la página segura de la pasarela) o pagar una sola vez. */
export default function HostedChoice({
  plan, period, price, onClose, onPayOnce,
}: { plan: Exclude<PlanId, 'free'>; period: Period; price: string; onClose: () => void; onPayOnce: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function subscribe() {
    setBusy(true);
    setErr('');
    const res = await fetch('/api/billing/rapyd/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, period }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (res?.ok && data?.url) return void (window.location.href = data.url);
    setBusy(false);
    setErr(data?.error ?? 'No pudimos iniciar el cobro automático. Intenta de nuevo o paga una sola vez.');
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Forma de pago" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card sheet">
        <h2 style={{ marginTop: 0 }}>Plan {PLANS[plan].name} {PERIOD_LABEL[period].toLowerCase()}</h2>
        <p className="muted small">{price}</p>
        {err && <div className="alert bad">{err}</div>}
        <div className="actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
          <button type="button" onClick={subscribe} disabled={busy}>{busy ? 'Abriendo…' : 'Suscribirme (se renueva sola)'}</button>
          <button type="button" className="ghost" onClick={onPayOnce} disabled={busy}>Pagar una sola vez</button>
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          🔒 Pones tu tarjeta en la página segura de Rapyd; la app no ve ni guarda sus datos. Puedes cancelar el cobro automático cuando quieras en Mi cuenta.
        </p>
      </div>
    </div>
  );
}
