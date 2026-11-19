'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';

type Settings = {
  sandbox: boolean; client_id: string; username: string; has_client_secret: boolean; has_password: boolean;
  numbering_range_id: string; iva_responsable: boolean; ready: boolean;
};
type Range = { id: string; label: string };

/** Mi cuenta → Facturación electrónica: conexión con Factus, resolución DIAN y régimen de IVA. */
export default function EInvoiceSettings() {
  const [s, setS] = useState<Settings | null>(null);
  const [secret, setSecret] = useState('');
  const [password, setPassword] = useState('');
  const [ranges, setRanges] = useState<Range[] | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ settings: Settings }>('/api/einvoice/settings').then((d) => setS(d.settings)).catch(() => setS(null));
  }, []);

  if (!s) return null;
  const patch = (p: Partial<Settings>) => setS({ ...s, ...p });

  async function save(quiet = false) {
    if (!s) return null;
    setBusy(true);
    try {
      const d = await api<{ settings: Settings }>('/api/einvoice/settings', { method: 'PUT', body: { ...s, client_secret: secret, password } });
      setS(d.settings);
      setSecret('');
      setPassword('');
      if (!quiet) setMsg({ text: 'Configuración de facturación guardada.' });
      return d.settings;
    } catch (e) {
      setMsg({ text: (e as Error).message, bad: true });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    const saved = await save(true);
    if (!saved) return;
    setBusy(true);
    try {
      const d = await api<{ ranges: Range[] }>('/api/einvoice/ranges');
      setRanges(d.ranges);
      if (d.ranges.length === 1 && !saved.numbering_range_id) {
        const only = d.ranges[0].id;
        const again = await api<{ settings: Settings }>('/api/einvoice/settings', { method: 'PUT', body: { ...saved, numbering_range_id: only } });
        setS(again.settings);
      }
      setMsg({ text: d.ranges.length ? 'Conexión correcta con Factus.' : 'Conexión correcta, pero tu cuenta de Factus no tiene resoluciones de factura de venta activas.' });
    } catch (e) {
      setMsg({ text: (e as Error).message, bad: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Facturación electrónica (DIAN)</h2>
      <p className="muted small">
        Para emitir facturas legales desde el cotizador, conecta tu cuenta de <a href="https://www.factus.com.co" target="_blank" rel="noreferrer">Factus</a>,
        proveedor tecnológico autorizado por la DIAN. Antes debes estar habilitado como facturador electrónico en la DIAN y tener tu
        resolución de numeración cargada en Factus. Las claves se guardan cifradas.
      </p>
      {msg && <div className={`alert ${msg.bad ? 'bad' : ''}`}>{msg.text}</div>}
      <div className="row">
        <div className="field">
          <label htmlFor="fx-env">Ambiente</label>
          <select id="fx-env" value={s.sandbox ? 'sandbox' : 'prod'} onChange={(e) => patch({ sandbox: e.target.value === 'sandbox' })}>
            <option value="sandbox">Pruebas (no son facturas reales)</option>
            <option value="prod">Producción (facturas legales ante la DIAN)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="fx-iva">¿Eres responsable de IVA?</label>
          <select id="fx-iva" value={s.iva_responsable ? 'si' : 'no'} onChange={(e) => patch({ iva_responsable: e.target.value === 'si' })}>
            <option value="no">No (no se cobra IVA en la factura)</option>
            <option value="si">Sí (se cobra el IVA de la cotización)</option>
          </select>
        </div>
      </div>
      <div className="row">
        <div className="field"><label htmlFor="fx-cid">Client ID</label><input id="fx-cid" value={s.client_id} onChange={(e) => patch({ client_id: e.target.value })} autoComplete="off" /></div>
        <div className="field">
          <label htmlFor="fx-cs">Client Secret</label>
          <input id="fx-cs" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={s.has_client_secret ? '•••••• (guardado, deja en blanco para no cambiar)' : ''} autoComplete="new-password" />
        </div>
      </div>
      <div className="row">
        <div className="field"><label htmlFor="fx-user">Usuario (correo de Factus)</label><input id="fx-user" value={s.username} onChange={(e) => patch({ username: e.target.value })} autoComplete="off" /></div>
        <div className="field">
          <label htmlFor="fx-pw">Contraseña de Factus</label>
          <input id="fx-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={s.has_password ? '•••••• (guardada, deja en blanco para no cambiar)' : ''} autoComplete="new-password" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="fx-range">Resolución de numeración</label>
        {ranges && ranges.length > 0 ? (
          <select id="fx-range" value={s.numbering_range_id} onChange={(e) => patch({ numbering_range_id: e.target.value })}>
            <option value="">— Elige —</option>
            {ranges.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        ) : (
          <input id="fx-range" value={s.numbering_range_id} onChange={(e) => patch({ numbering_range_id: e.target.value })} placeholder="Pulsa «Probar conexión» para elegirla de la lista" />
        )}
      </div>
      <div className="row">
        <button type="button" className="shrink" disabled={busy} onClick={() => save()}>Guardar</button>
        <button type="button" className="ghost shrink" disabled={busy} onClick={test}>Probar conexión</button>
        {s.ready && <span className="badge">{s.sandbox ? 'Conectado (pruebas)' : 'Conectado (producción)'}</span>}
      </div>
    </section>
  );
}
