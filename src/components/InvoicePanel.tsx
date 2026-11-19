'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, update } from '@/lib/client';
import { money } from '@/lib/format';
import { DOC_TYPES, PAYMENT_METHODS, buyerProblems, digits, invoiceTotals, nitDV, type Buyer } from '@/lib/einvoice';
import type { EstimateItem } from '@/lib/estimate';

export type InvoiceRow = {
  id: number; estimate_id: number | null; sandbox: boolean; status: string; number: string; cufe: string;
  qr_url: string; public_url: string; total: number; error: string; created_at: string;
};
export type FullCustomer = Buyer & { id: number; notes: string };
type Settings = { ready: boolean; sandbox: boolean; iva_responsable: boolean; numbering_range_id: string };
type Est = { id?: number; items: EstimateItem[]; discount_pct: number; iva_pct: number; number: string; notes: string };

const inDays = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

/** «Facturar»: completa los datos del comprador y emite la factura electrónica de la cotización. */
export default function InvoicePanel({
  estimate, customer, invoices, onCustomer, onIssued, saveFirst, onClose,
}: {
  estimate: Est;
  customer: FullCustomer | undefined;
  invoices: InvoiceRow[];
  onCustomer: (c: FullCustomer) => void;
  onIssued: (inv: InvoiceRow) => void;
  saveFirst: () => Promise<boolean>;
  onClose: () => void;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [buyer, setBuyer] = useState<FullCustomer | undefined>(customer);
  const [cityQ, setCityQ] = useState('');
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState<'1' | '2'>('1');
  const [method, setMethod] = useState('10');
  const [due, setDue] = useState(inDays(30));
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ settings: Settings }>('/api/einvoice/settings').then((d) => setSettings(d.settings)).catch((e) => setMsg({ text: e.message, bad: true }));
  }, []);
  useEffect(() => setBuyer(customer), [customer]);

  const issued = invoices.filter((i) => i.status === 'issued');
  const real = issued.find((i) => !i.sandbox);
  const lastError = invoices.find((i) => i.status === 'error');

  if (!settings) return <section className="card no-print"><p className="muted">Cargando facturación…</p></section>;

  const head = (
    <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
      <h2 style={{ margin: 0 }}>Facturar {settings.sandbox && <span className="badge warn">Ambiente de pruebas</span>}</h2>
      <button type="button" className="ghost shrink" onClick={onClose}>Cerrar</button>
    </div>
  );

  const issuedList = issued.length > 0 && (
    <div style={{ marginTop: 12 }}>
      {issued.map((i) => (
        <div key={i.id} className="card tight">
          <div className="kv"><span>Factura</span><strong>{i.number} {i.sandbox && <span className="badge warn">Prueba</span>}</strong></div>
          <div className="kv"><span>Total</span><strong>{money(Number(i.total))}</strong></div>
          <div className="kv"><span>Emitida</span><strong>{new Date(i.created_at).toLocaleString('es-CO')}</strong></div>
          {i.cufe && <div className="small muted" style={{ wordBreak: 'break-all' }}>CUFE: {i.cufe}</div>}
          <div className="row" style={{ marginTop: 8 }}>
            <a className="btn shrink" href={`/api/einvoice/${i.id}/pdf`}>Descargar PDF</a>
            {i.qr_url && <a className="btn ghost shrink" href={i.qr_url} target="_blank" rel="noreferrer">Ver en la DIAN</a>}
            {i.public_url && <a className="btn ghost shrink" href={i.public_url} target="_blank" rel="noreferrer">Ver en Factus</a>}
          </div>
        </div>
      ))}
    </div>
  );

  if (!settings.ready) {
    return (
      <section className="card no-print">
        {head}
        <p>Para emitir facturas electrónicas legales necesitas conectar tu proveedor tecnológico (Factus) una sola vez.</p>
        <Link href="/app/cuenta" className="btn">Ir a Mi cuenta → Facturación electrónica</Link>
      </section>
    );
  }

  if (real) {
    return (
      <section className="card no-print">
        {head}
        <p className="muted small">Esta cotización ya tiene factura electrónica. Para corregirla se hace una nota crédito en Factus.</p>
        {issuedList}
      </section>
    );
  }

  const b = buyer;
  const problems = buyerProblems(b);
  const totals = invoiceTotals(estimate, settings);
  const ivaBlocked = !settings.iva_responsable && Number(estimate.iva_pct) > 0;
  const setB = (p: Partial<FullCustomer>) => setBuyer((x) => (x ? { ...x, ...p } : x));

  async function saveBuyer() {
    if (!b) return false;
    try {
      const row = await update<FullCustomer>('customers', b.id, b);
      onCustomer(row);
      return true;
    } catch (e) {
      setMsg({ text: (e as Error).message, bad: true });
      return false;
    }
  }

  async function findCity() {
    try {
      const d = await api<{ municipalities: { id: string; name: string }[] }>(`/api/einvoice/municipalities?q=${encodeURIComponent(cityQ)}`);
      setCities(d.municipalities);
      if (!d.municipalities.length) setMsg({ text: 'No se encontró ese municipio.', bad: true });
    } catch (e) {
      setMsg({ text: (e as Error).message, bad: true });
    }
  }

  async function issue() {
    if (!b || problems.length || ivaBlocked) return;
    const what = settings!.sandbox ? 'una factura de PRUEBA' : 'una factura electrónica REAL ante la DIAN';
    if (!window.confirm(`Vas a emitir ${what} a ${b.name} por ${money(totals.total)}. Una factura emitida no se puede borrar (solo anular con nota crédito). ¿Continuar?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      if (!(await saveFirst()) || !(await saveBuyer())) return;
      const d = await api<{ invoice: InvoiceRow }>('/api/einvoice', {
        method: 'POST',
        body: { estimate_id: estimate.id, payment_form: form, payment_method: method, due_date: form === '2' ? due : undefined },
      });
      onIssued(d.invoice);
      setMsg({ text: `Factura ${d.invoice.number} emitida y enviada a la DIAN. Al cliente le llega por correo.` });
    } catch (e) {
      setMsg({ text: (e as Error).message, bad: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card no-print">
      {head}
      {msg && <div className={`alert ${msg.bad ? 'bad' : ''}`} style={{ marginTop: 10 }}>{msg.text}</div>}
      {!msg && lastError && !issued.length && <div className="alert bad" style={{ marginTop: 10 }}>Último intento: {lastError.error}</div>}

      {!b ? (
        <p className="muted">Elige o crea un cliente en la parte de arriba de la cotización para poder facturarle.</p>
      ) : (
        <>
          <h3>Datos del comprador</h3>
          <div className="row">
            <div className="field">
              <label htmlFor="b-name">Nombre o razón social</label>
              <input id="b-name" value={b.name} onChange={(e) => setB({ name: e.target.value })} />
            </div>
            <div className="field shrink">
              <label htmlFor="b-pt">Tipo de persona</label>
              <select id="b-pt" value={b.person_type || 'natural'} onChange={(e) => setB({ person_type: e.target.value })}>
                <option value="natural">Natural</option>
                <option value="juridica">Jurídica (empresa)</option>
              </select>
            </div>
          </div>
          <div className="row">
            <div className="field shrink">
              <label htmlFor="b-dt">Tipo de documento</label>
              <select id="b-dt" value={b.doc_type || 'CC'} onChange={(e) => setB({ doc_type: e.target.value })}>
                {Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="b-doc">Número {b.doc_type === 'NIT' && digits(b.doc).length > 3 && <span className="muted">(DV {nitDV(b.doc)})</span>}</label>
              <input id="b-doc" value={b.doc} onChange={(e) => setB({ doc: e.target.value })} placeholder={b.doc_type === 'NIT' ? 'Sin dígito de verificación' : ''} />
            </div>
            <div className="field shrink">
              <label htmlFor="b-iva">Responsable de IVA</label>
              <select id="b-iva" value={b.iva_responsable ? 'si' : 'no'} onChange={(e) => setB({ iva_responsable: e.target.value === 'si' })}>
                <option value="no">No</option>
                <option value="si">Sí</option>
              </select>
            </div>
          </div>
          <div className="row">
            <div className="field"><label htmlFor="b-em">Correo (ahí le llega la factura)</label><input id="b-em" type="email" value={b.email} onChange={(e) => setB({ email: e.target.value })} /></div>
            <div className="field"><label htmlFor="b-ph">Teléfono</label><input id="b-ph" value={b.phone} onChange={(e) => setB({ phone: e.target.value })} /></div>
          </div>
          <div className="field"><label htmlFor="b-ad">Dirección</label><input id="b-ad" value={b.address} onChange={(e) => setB({ address: e.target.value })} /></div>
          <div className="row">
            <div className="field">
              <label htmlFor="b-city">Municipio {b.city && <span className="muted">· {b.city}</span>}</label>
              <input
                id="b-city"
                value={cityQ}
                placeholder={b.city ? 'Buscar otro municipio' : 'Escribe el municipio, ej.: Medellín'}
                onChange={(e) => setCityQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); findCity(); } }}
              />
            </div>
            <div className="field shrink"><label>&nbsp;</label><button type="button" className="ghost" onClick={findCity} disabled={cityQ.trim().length < 3}>Buscar</button></div>
          </div>
          {cities.length > 0 && (
            <div className="field">
              <select aria-label="Elige el municipio" value="" onChange={(e) => {
                const m = cities.find((x) => x.id === e.target.value);
                if (m) { setB({ municipality_id: m.id, city: m.name }); setCities([]); setCityQ(''); }
              }}>
                <option value="">— Elige el municipio ({cities.length}) —</option>
                {cities.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}

          <h3>Pago</h3>
          <div className="row">
            <div className="field shrink">
              <label htmlFor="p-form">Forma de pago</label>
              <select id="p-form" value={form} onChange={(e) => setForm(e.target.value as '1' | '2')}>
                <option value="1">Contado</option>
                <option value="2">Crédito</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="p-met">Medio de pago</label>
              <select id="p-met" value={method} onChange={(e) => setMethod(e.target.value)}>
                {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {form === '2' && (
              <div className="field shrink"><label htmlFor="p-due">Vence</label><input id="p-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
            )}
          </div>

          <h3>Resumen</h3>
          <div className="kv"><span>Subtotal</span><strong>{money(totals.subtotal)}</strong></div>
          {totals.discount > 0 && <div className="kv"><span>Descuento</span><strong>− {money(totals.discount)}</strong></div>}
          <div className="kv"><span>IVA</span><strong>{settings.iva_responsable ? money(totals.iva) : 'No aplica (no responsable)'}</strong></div>
          <div className="kv"><span>Total a facturar</span><strong className="result-big" style={{ fontSize: '1.3rem' }}>{money(totals.total)}</strong></div>

          {ivaBlocked && <div className="alert bad">La cotización suma IVA, pero en tu configuración no eres responsable de IVA. Pon el IVA en 0 o cambia la configuración en Mi cuenta.</div>}
          {problems.length > 0 && <div className="alert">Falta para facturar: {problems.join(', ')}.</div>}
          {!settings.numbering_range_id && <div className="alert">Elige tu resolución de numeración en Mi cuenta → Facturación electrónica.</div>}

          <div className="row" style={{ marginTop: 10 }}>
            <button type="button" className="shrink" disabled={busy || problems.length > 0 || ivaBlocked || !settings.numbering_range_id} onClick={issue}>
              {busy ? 'Emitiendo…' : settings.sandbox ? 'Emitir factura de prueba' : 'Emitir factura electrónica'}
            </button>
            <button type="button" className="ghost shrink" disabled={busy} onClick={async () => { if (await saveBuyer()) setMsg({ text: 'Datos del cliente guardados.' }); }}>
              Guardar datos del cliente
            </button>
          </div>
        </>
      )}
      {issuedList}
    </section>
  );
}
