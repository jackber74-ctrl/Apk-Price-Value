'use client';
import Link from 'next/link';
import CardForm from '@/components/CardForm';
import HostedChoice from '@/components/HostedChoice';
import { useEffect, useState } from 'react';
import {
  PERIODS, PERIOD_LABEL, PERIOD_UNIT, PLANS, PLAN_ORDER, PRICES, bestSaving, planLevel, pricing, usd,
  type Period, type PlanId,
} from '@/lib/plans';

type Me = { plan: PlanId; lifetime: boolean; period: Period | null; expires: string | null };

/** Envía el formulario firmado de PayU en la misma ventana (sirve igual en el navegador y en la app instalada). */
function submitForm({ action, fields }: { action: string; fields: Record<string, string> }) {
  const f = document.createElement('form');
  f.method = 'POST';
  f.action = action;
  for (const [name, value] of Object.entries(fields)) {
    const i = document.createElement('input');
    i.type = 'hidden';
    i.name = name;
    i.value = value;
    f.appendChild(i);
  }
  document.body.appendChild(f);
  f.submit();
}

export default function Planes() {
  const [period, setPeriod] = useState<Period>('annual');
  const [me, setMe] = useState<Me | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [mode, setMode] = useState<'card' | 'hosted' | null>(null);
  const [hostedFor, setHostedFor] = useState<Exclude<PlanId, 'free'> | null>(null);
  const [fx, setFx] = useState<{ currency: string; rate: number } | null>(null);
  const [cardFor, setCardFor] = useState<Exclude<PlanId, 'free'> | null>(null);

  const loadMe = () =>
    fetch('/api/plan', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => {});

  useEffect(() => {
    const pago = new URLSearchParams(window.location.search).get('pago');
    if (pago === 'ok') setMsg('¡Gracias! Estamos confirmando tu pago; tu plan se activa en unos segundos. Si no cambia, recarga la página.');
    else if (pago === 'pendiente') setMsg('Tu pago quedó pendiente. Cuando la pasarela lo confirme, tu plan se activa solo.');
    else if (pago === 'error') setMsg('El pago no se completó. Puedes intentarlo de nuevo.');
    loadMe();
    fetch('/api/billing/subscription', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setMode(d?.mode ?? (d?.available ? 'card' : null)); if (d?.currency) setFx({ currency: d.currency, rate: d.rate }); })
      .catch(() => {});
  }, []);

  function choose(plan: Exclude<PlanId, 'free'>) {
    if (!me) return void (window.location.href = `/registro`);
    if (mode === 'card') return setCardFor(plan);
    if (mode === 'hosted') return setHostedFor(plan);
    void payOnce(plan);
  }

  async function payOnce(plan: Exclude<PlanId, 'free'>) {
    setCardFor(null);
    setHostedFor(null);
    setBusy(plan);
    setMsg('');
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, period }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.form) return void submitForm(data.form);
      if (res.ok && data.url) window.location.href = data.url;
      else setMsg(data.error ?? 'No pudimos iniciar el pago. Intenta de nuevo.');
    } finally {
      setBusy('');
    }
  }

  const priceText = (plan: Exclude<PlanId, 'free'>) =>
    fx && fx.currency !== 'USD'
      ? `$${Math.round(pricing(plan, period).price * fx.rate).toLocaleString('es-CO')} ${fx.currency} (${usd(pricing(plan, period).price)})`
      : usd(pricing(plan, period).price);

  return (
    <main className="hero" style={{ marginTop: '5vh', maxWidth: 1040 }}>
      <Link href={me ? '/app/calculadora' : '/'} className="brand">Apk <span>Price Value</span></Link>
      <h1 style={{ marginTop: 16 }}>Elige tu plan</h1>
      <p className="muted">Empieza gratis y mejora cuando lo necesites. Pagando por más tiempo ahorras.</p>

      {me?.lifetime && <div className="alert">Tienes el plan <strong>{PLANS.max.name}</strong> de por vida, con todo incluido y las actualizaciones futuras. 🎉</div>}
      {me && !me.lifetime && me.plan !== 'free' && (
        <div className="alert">
          Tu plan actual es <strong>{PLANS[me.plan].name}</strong>
          {me.expires ? `, vigente hasta el ${new Date(me.expires).toLocaleDateString('es-CO')}` : ''}.
        </div>
      )}
      {cardFor && (
        <CardForm
          plan={cardFor}
          period={period}
          price={priceText(cardFor)}
          onClose={() => setCardFor(null)}
          onPayOnce={() => payOnce(cardFor)}
          onDone={(active) => {
            setCardFor(null);
            setMsg(active ? '¡Listo! Tu suscripción quedó activa y se renovará sola.' : 'Suscripción creada. Estamos confirmando el primer cobro; tu plan se activa en unos minutos.');
            loadMe();
          }}
        />
      )}
      {hostedFor && (
        <HostedChoice plan={hostedFor} period={period} price={priceText(hostedFor)} onClose={() => setHostedFor(null)} onPayOnce={() => payOnce(hostedFor)} />
      )}
      {msg && <div className={`alert ${msg.startsWith('¡Gracias') || msg.startsWith('Tu pago quedó') || msg.startsWith('¡Listo') || msg.startsWith('Suscripción creada') ? '' : 'bad'}`}>{msg}</div>}

      <div className="chips period-bar" role="tablist" aria-label="Periodo de pago">
        {PERIODS.map((p) => (
          <button key={p} type="button" role="tab" aria-selected={period === p} className={`chip ${period === p ? 'on' : ''}`} onClick={() => setPeriod(p)}>
            {PERIOD_LABEL[p]}
            {p !== 'monthly' && <span className="save-pill">Ahorra hasta {bestSaving(p)} %</span>}
          </button>
        ))}
      </div>

      <div className="plans">
        {PLAN_ORDER.map((id) => {
          const plan = PLANS[id];
          const paid = id !== 'free';
          const p = paid ? pricing(id, period) : null;
          const current = !!me && (me.lifetime ? id === 'max' : me.plan === id);
          const popular = id === 'plus';
          return (
            <section key={id} className={`card plan ${popular ? 'popular' : ''}`}>
              {popular && <span className="badge plan-flag">Más elegido</span>}
              <h2>{plan.name}</h2>
              <p className="muted small" style={{ margin: 0 }}>{plan.tagline}</p>
              <div className="plan-price">
                {p ? (
                  <>
                    <strong>{usd(p.price)}</strong>
                    <span className="muted"> / {PERIOD_UNIT[period]}</span>
                  </>
                ) : (
                  <strong>Gratis</strong>
                )}
              </div>
              {p && period !== 'monthly' ? (
                <p className="small" style={{ margin: '0 0 4px' }}>
                  <span className="badge">Ahorras {p.pct} % · {usd(p.saved)}</span>
                  <span className="muted"> en vez de <s>{usd(p.full)}</s></span>
                </p>
              ) : (
                <p className="small muted" style={{ margin: '0 0 4px' }}>{p ? `Mes a mes, ${usd(PRICES[id as Exclude<PlanId, 'free'>].monthly)}` : 'Sin costo'}</p>
              )}
              {p && period !== 'monthly' && <p className="small muted" style={{ margin: '0 0 8px' }}>Equivale a {usd(p.perMonth)} al mes</p>}
              <ul className="plan-list">
                {plan.includes.map((t) => <li key={t}>{t}</li>)}
              </ul>
              {current && paid && !me?.lifetime ? (
                <button type="button" onClick={() => choose(id as Exclude<PlanId, 'free'>)} disabled={busy === id}>
                  {busy === id ? 'Un momento…' : 'Renovar (se suma a tu fecha)'}
                </button>
              ) : current ? (
                <button type="button" className="ghost" disabled>{me?.lifetime ? 'Tu plan de por vida' : 'Tu plan actual'}</button>
              ) : !paid ? (
                <Link className="btn ghost" href={me ? '/app/calculadora' : '/registro'}>{me ? 'Usar Free' : 'Empezar gratis'}</Link>
              ) : me && !me.lifetime && planLevel(me.plan) > planLevel(id) ? (
                <button type="button" className="ghost" disabled>Incluido en tu plan</button>
              ) : me?.lifetime ? (
                <button type="button" className="ghost" disabled>Ya lo tienes</button>
              ) : (
                <button type="button" onClick={() => choose(id as Exclude<PlanId, 'free'>)} disabled={busy === id}>
                  {busy === id ? 'Un momento…' : `Elegir ${plan.name}`}
                </button>
              )}
            </section>
          );
        })}
      </div>

      <p className="muted small" style={{ marginTop: 18 }}>
        Los precios están en dólares estadounidenses (USD). El ahorro se calcula frente a pagar mes a mes. Puedes cambiar de plan cuando quieras.
        Al pagar aceptas los <Link href="/terminos">Términos y condiciones</Link>.
      </p>
    </main>
  );
}
