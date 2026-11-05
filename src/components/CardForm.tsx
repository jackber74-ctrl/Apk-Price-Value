'use client';
import { useState } from 'react';
import { PERIOD_LABEL, PLANS, type Period, type PlanId } from '@/lib/plans';

type Props = {
  plan: Exclude<PlanId, 'free'>;
  period: Period;
  price: string;
  onClose: () => void;
  onDone: (active: boolean) => void;
  onPayOnce: () => void;
};

/** Formulario de tarjeta para el cobro automático con PayU. Los datos van directo a PayU por la app y no se guardan. */
export default function CardForm({ plan, period, price, onClose, onDone, onPayOnce }: Props) {
  const [f, setF] = useState({ name: '', document: '', number: '', exp: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const [expMonth, expYear] = f.exp.split('/').map((x) => x.trim());
    setBusy(true);
    try {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, period, card: { name: f.name, document: f.document, number: f.number, expMonth, expYear } }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) onDone(!!data.active);
      else setErr(data.error ?? 'No se pudo completar la suscripción.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Suscripción con tarjeta" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="card sheet" onSubmit={submit}>
        <h2 style={{ marginTop: 0 }}>Plan {PLANS[plan].name} · {PERIOD_LABEL[period]}</h2>
        <p className="muted small">
          Se cobra <strong>{price}</strong> ahora y se renueva solo cada periodo con la misma tarjeta. Puedes cancelar cuando quieras en Mi cuenta.
        </p>
        {err && <div className="alert bad">{err}</div>}
        <label>Nombre en la tarjeta<input required autoComplete="cc-name" value={f.name} onChange={set('name')} /></label>
        <label>Documento del titular<input required inputMode="numeric" value={f.document} onChange={set('document')} /></label>
        <label>Número de tarjeta<input required inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" value={f.number} onChange={set('number')} /></label>
        <label>Vence (MM/AAAA)<input required autoComplete="cc-exp" placeholder="08/2029" value={f.exp} onChange={set('exp')} /></label>
        <div className="actions" style={{ justifyContent: 'flex-start' }}>
          <button type="submit" disabled={busy}>{busy ? 'Procesando…' : `Suscribirme y pagar ${price}`}</button>
          <button type="button" className="ghost" onClick={onClose}>Cancelar</button>
        </div>
        <p className="small" style={{ marginBottom: 0 }}>
          <button type="button" className="link" onClick={onPayOnce}>Prefiero pagar una sola vez (PSE, Nequi, Efecty o tarjeta)</button>
        </p>
        <p className="muted small" style={{ marginBottom: 0 }}>🔒 Pagos procesados por PayU. La app no guarda los datos de tu tarjeta.</p>
      </form>
    </div>
  );
}
