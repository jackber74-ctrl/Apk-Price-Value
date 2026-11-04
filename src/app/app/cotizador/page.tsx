'use client';
import PlanGate from '@/components/PlanGate';
import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import CrudTable from '@/components/CrudTable';
import { api, create, list, remove, update } from '@/lib/client';
import { money } from '@/lib/format';
import EstimateDoc, { type DocProfile } from '@/components/EstimateDoc';
import { STATUSES, estimateTotals, nextNumber, type EstimateItem } from '@/lib/estimate';

type Customer = { id: number; name: string; doc: string; email: string; phone: string; address: string; notes: string };
type Calc = { id: number; name: string; price: number; data: { kind?: 'Producto' | 'Servicio'; competitor?: string } };
type Estimate = {
  id: number; customer_id: number | null; number: string; title: string; status: string; issue_date: string;
  valid_days: number; items: EstimateItem[]; discount_pct: number; iva_pct: number; notes: string; total: number;
};
type Draft = Omit<Estimate, 'id'> & { id?: number };

const uid = () => Math.random().toString(36).slice(2, 9);
const num = (s: string | number) => {
  const x = parseFloat(String(s).replace(',', '.'));
  return Number.isFinite(x) ? x : 0;
};
const today = () => new Date().toISOString().slice(0, 10);
const blankItem = (): EstimateItem => ({ id: uid(), name: '', desc: '', kind: 'Producto', qty: 1, price: 0, quote_id: null });

function Cotizador() {
  const router = useRouter();
  const params = useSearchParams();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [calcs, setCalcs] = useState<Calc[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState('');
  const [profile, setProfile] = useState<DocProfile | null>(null);
  const [newCustomer, setNewCustomer] = useState<string | null>(null);

  const newDraft = useCallback(
    (all: Estimate[], items: EstimateItem[] = []): Draft => ({
      customer_id: null, number: nextNumber(all.map((e) => e.number)), title: '', status: 'Borrador', issue_date: today(),
      valid_days: 15, items, discount_pct: 0, iva_pct: 0, notes: '', total: 0,
    }),
    [],
  );

  useEffect(() => {
    Promise.all([list<Estimate>('estimates'), list<Customer>('customers'), list<Calc>('quotes'), api<{ profile: DocProfile }>('/api/account/profile').catch(() => null)])
      .then(([e, c, q, pr]) => {
        setProfile(pr?.profile ?? null);
        setEstimates(e);
        setCustomers(c);
        setCalcs(q);
        const add = Number(params.get('agregar'));
        const open = Number(params.get('id'));
        if (add) {
          const calc = q.find((x) => x.id === add);
          if (calc) {
            setDraft(newDraft(e, [{ id: uid(), name: calc.name, desc: '', kind: calc.data?.kind ?? 'Producto', qty: 1, price: Number(calc.price), quote_id: calc.id }]));
            setMsg(`Se agregó «${calc.name}» a una cotización nueva. Puedes añadir más líneas antes de guardar.`);
          }
        } else if (open) {
          const found = e.find((x) => x.id === open);
          if (found) setDraft(found);
        }
      })
      .catch((e) => setMsg(e.message))
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => (draft ? estimateTotals(draft.items, draft.discount_pct, draft.iva_pct) : null), [draft]);
  const patch = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const setItem = (id: string, p: Partial<EstimateItem>) =>
    setDraft((d) => (d ? { ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...p } : i)) } : d));

  function addFromCalc(idStr: string) {
    const c = calcs.find((x) => x.id === Number(idStr));
    if (!c) return;
    setDraft((d) =>
      d ? { ...d, items: [...d.items, { id: uid(), name: c.name, desc: '', kind: c.data?.kind ?? 'Producto', qty: 1, price: Number(c.price), quote_id: c.id }] } : d,
    );
  }

  async function save() {
    if (!draft || !totals) return;
    const body = { ...draft, total: totals.total };
    try {
      if (draft.id) {
        const row = await update<Estimate>('estimates', draft.id, body);
        setEstimates((p) => p.map((e) => (e.id === row.id ? row : e)));
        setDraft(row);
      } else {
        const row = await create<Estimate>('estimates', body);
        setEstimates((p) => [row, ...p]);
        setDraft(row);
      }
      setMsg('Cotización guardada en tu cuenta.');
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function del(id: number) {
    if (!window.confirm('¿Eliminar esta cotización? No se puede deshacer.')) return;
    await remove('estimates', id);
    setEstimates((p) => p.filter((e) => e.id !== id));
    if (draft?.id === id) setDraft(null);
  }

  async function duplicate(e: Estimate) {
    setDraft({ ...e, id: undefined, number: nextNumber(estimates.map((x) => x.number)), status: 'Borrador', issue_date: today(), items: e.items.map((i) => ({ ...i, id: uid() })) });
    setMsg('Copia lista. Revísala y pulsa Guardar.');
  }

  async function saveCustomer() {
    const name = (newCustomer ?? '').trim();
    if (!name) return;
    try {
      const c = await create<Customer>('customers', { name });
      setCustomers((p) => [...p, c].sort((a, b) => a.name.localeCompare(b.name)));
      patch({ customer_id: c.id });
      setNewCustomer(null);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  if (!loaded) return <p className="muted">Cargando…</p>;
  const customerName = (id: number | null) => customers.find((c) => c.id === id)?.name ?? 'Sin cliente';

  if (draft && totals) {
    const customer = customers.find((c) => c.id === draft.customer_id);
    return (
      <>
        <div className="page-head no-print">
          <button type="button" className="ghost" onClick={() => { setDraft(null); router.replace('/app/cotizador'); }}>← Mis cotizaciones</button>
          <h1>{draft.id ? `Cotización ${draft.number}` : 'Nueva cotización'}</h1>
        </div>
        {msg && <div className="alert no-print">{msg}</div>}

        <section className="card no-print">
          <h2>Datos</h2>
          <div className="row">
            <div className="field">
              <label htmlFor="num">Número</label>
              <input id="num" value={draft.number} onChange={(e) => patch({ number: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="title">Título (opcional)</label>
              <input id="title" value={draft.title} onChange={(e) => patch({ title: e.target.value })} placeholder="Ej.: Detalles para evento" />
            </div>
            <div className="field shrink no-print">
              <label htmlFor="status">Estado</label>
              <select id="status" value={draft.status} onChange={(e) => patch({ status: e.target.value })}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="customer">Cliente</label>
              <select id="customer" value={draft.customer_id ?? ''} onChange={(e) => patch({ customer_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">— Sin cliente —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field shrink no-print">
              <label>&nbsp;</label>
              <button type="button" className="ghost" onClick={() => setNewCustomer('')}>+ Cliente nuevo</button>
            </div>
            <div className="field">
              <label htmlFor="date">Fecha</label>
              <input id="date" type="date" value={String(draft.issue_date).slice(0, 10)} onChange={(e) => patch({ issue_date: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="valid">Válida por (días)</label>
              <input id="valid" inputMode="numeric" value={draft.valid_days} onChange={(e) => patch({ valid_days: num(e.target.value) })} />
            </div>
          </div>
          {newCustomer !== null && (
            <div className="row no-print">
              <input aria-label="Nombre del cliente" autoFocus value={newCustomer} placeholder="Nombre del cliente" onChange={(e) => setNewCustomer(e.target.value)} />
              <button type="button" className="shrink" onClick={saveCustomer}>Guardar cliente</button>
              <button type="button" className="ghost shrink" onClick={() => setNewCustomer(null)}>Cancelar</button>
            </div>
          )}
          {customer && (customer.doc || customer.phone || customer.email) && (
            <p className="muted small" style={{ margin: 0 }}>{[customer.doc, customer.phone, customer.email].filter(Boolean).join(' · ')}</p>
          )}
        </section>

        <section className="card no-print">
          <h2>Productos y servicios</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Concepto</th><th>Tipo</th><th>Cant.</th><th>Precio unidad</th><th>Subtotal</th><th className="no-print"></th></tr>
              </thead>
              <tbody>
                {draft.items.map((i) => (
                  <Fragment key={i.id}>
                  <tr>
                    <td>
                      <input aria-label="Concepto" value={i.name} placeholder="Concepto" onChange={(e) => setItem(i.id, { name: e.target.value })} />
                    </td>
                    <td>
                      <select aria-label="Tipo" value={i.kind} onChange={(e) => setItem(i.id, { kind: e.target.value as EstimateItem['kind'] })}>
                        <option>Producto</option><option>Servicio</option>
                      </select>
                    </td>
                    <td><input aria-label="Cantidad" inputMode="decimal" style={{ width: 70 }} value={i.qty} onChange={(e) => setItem(i.id, { qty: num(e.target.value) })} /></td>
                    <td><input aria-label="Precio" inputMode="decimal" style={{ width: 120 }} value={i.price} onChange={(e) => setItem(i.id, { price: num(e.target.value) })} /></td>
                    <td className="num">{money(i.qty * i.price)}</td>
                    <td className="no-print">
                      {i.quote_id && calcs.some((c) => c.id === i.quote_id) && (
                        <Link href={`/app/calculadora?id=${i.quote_id}`} className="small">Ver en calculadora</Link>
                      )}{' '}
                      <button type="button" className="danger" aria-label="Quitar línea" onClick={() => patch({ items: draft.items.filter((x) => x.id !== i.id) })}>✕</button>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={6} style={{ paddingTop: 0 }}>
                      <input aria-label="Observación de la línea" value={i.desc} placeholder="Observación de esta línea (opcional, sale debajo del concepto)" onChange={(e) => setItem(i.id, { desc: e.target.value })} />
                    </td>
                  </tr>
                  </Fragment>
                ))}
                {draft.items.length === 0 && <tr><td colSpan={6} className="muted">Aún no hay líneas.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="row no-print" style={{ marginTop: 10 }}>
            <button type="button" className="ghost shrink" onClick={() => patch({ items: [...draft.items, blankItem()] })}>+ Línea en blanco</button>
            <select aria-label="Agregar desde mis cálculos" value="" onChange={(e) => addFromCalc(e.target.value)}>
              <option value="">+ Agregar desde mis cálculos guardados…</option>
              {calcs.map((c) => <option key={c.id} value={c.id}>{c.name} — {money(Number(c.price))}</option>)}
            </select>
            <Link href="/app/calculadora" className="btn ghost shrink">Calcular un precio nuevo</Link>
          </div>
        </section>

        <section className="card no-print">
          <div className="row">
            <div className="field">
              <label htmlFor="disc">Descuento (%)</label>
              <input id="disc" inputMode="decimal" value={draft.discount_pct} onChange={(e) => patch({ discount_pct: num(e.target.value) })} />
            </div>
            <div className="field">
              <label htmlFor="iva">IVA que se suma (%)</label>
              <input id="iva" inputMode="decimal" value={draft.iva_pct} onChange={(e) => patch({ iva_pct: num(e.target.value) })} />
            </div>
          </div>
          <p className="muted small no-print">Si los precios que pasaste desde la calculadora ya incluyen IVA, deja el IVA en 0.</p>
          <div className="kv"><span>Subtotal</span><strong>{money(totals.subtotal)}</strong></div>
          {totals.discount > 0 && <div className="kv"><span>Descuento</span><strong>− {money(totals.discount)}</strong></div>}
          {totals.iva > 0 && <div className="kv"><span>IVA</span><strong>{money(totals.iva)}</strong></div>}
          <div className="kv"><span>Total</span><strong className="result-big" style={{ fontSize: '1.5rem' }}>{money(totals.total)}</strong></div>
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="notes">Observaciones (salen al final de la cotización)</label>
            <textarea id="notes" rows={3} value={draft.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder="Forma de pago, tiempo de entrega…" />
          </div>
        </section>

        <EstimateDoc profile={profile} doc={draft} customer={customer} totals={totals} />
        <p className="muted small no-print">Así le llega a tu cliente. El logo y los colores se cambian en <Link href="/app/cuenta">Mi cuenta</Link>.</p>

        <div className="row no-print">
          <button type="button" onClick={save}>{draft.id ? 'Guardar cambios' : 'Guardar cotización'}</button>
          <button type="button" className="ghost" onClick={() => window.print()}>Imprimir / PDF</button>
          {draft.id && <button type="button" className="ghost" onClick={() => duplicate(draft as Estimate)}>Duplicar</button>}
          {draft.id && <button type="button" className="danger" onClick={() => del(draft.id!)}>Eliminar</button>}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <h1>Cotizador</h1>
        <p className="muted">Arma cotizaciones para tus clientes con los precios de tu calculadora. Todo queda guardado en tu cuenta para editarlo o reutilizarlo.</p>
      </div>
      {msg && <div className="alert">{msg}</div>}
      <div className="row" style={{ marginBottom: 12 }}>
        <button type="button" className="shrink" onClick={() => { setDraft(newDraft(estimates)); setMsg(''); }}>+ Nueva cotización</button>
      </div>

      <section className="card">
        <h2>Mis cotizaciones</h2>
        {estimates.length === 0 && <p className="muted small">Aún no tienes cotizaciones. Crea una nueva o envía un cálculo desde la calculadora.</p>}
        {estimates.map((e) => (
          <div className="check-row" key={e.id}>
            <button type="button" className="ghost grow" style={{ textAlign: 'left' }} onClick={() => { setDraft(e); setMsg(''); }}>
              <strong>{e.number}</strong> {e.title && `· ${e.title} `}<span className="muted small">· {customerName(e.customer_id)}</span>
            </button>
            <span className={`badge ${e.status === 'Rechazada' ? 'bad' : e.status === 'Aprobada' ? '' : 'warn'}`}>{e.status}</span>
            <span className="num">{money(Number(e.total))}</span>
            <button type="button" className="ghost" onClick={() => { setDraft(e); setMsg(''); }}>Editar</button>
            <button type="button" className="danger" aria-label="Eliminar" onClick={() => del(e.id)}>✕</button>
          </div>
        ))}
      </section>

      <h2 style={{ marginTop: 24 }}>Mis clientes</h2>
      <CrudTable<Customer>
        resource="customers"
        rows={customers}
        setRows={(fn) => setCustomers(fn)}
        blank={{ name: 'Nuevo cliente' }}
        addLabel="+ Agregar cliente"
        csvName="clientes.csv"
        cols={[
          { key: 'name', label: 'Nombre' },
          { key: 'doc', label: 'NIT / CC', width: 120 },
          { key: 'phone', label: 'Teléfono', width: 120 },
          { key: 'email', label: 'Correo' },
          { key: 'address', label: 'Dirección' },
        ]}
      />
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Cargando…</p>}>
      <PlanGate feature="save" title="Cotizador">
        <Cotizador />
      </PlanGate>
    </Suspense>
  );
}
