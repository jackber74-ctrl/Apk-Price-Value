'use client';
import { useState } from 'react';
import Link from 'next/link';
import CrudTable from '@/components/CrudTable';
import { useAdvanced, type SupplyQuote } from '@/components/useAdvanced';
import type { SupplyRow } from '@/lib/advanced';
import { create, remove, update } from '@/lib/client';
import { money } from '@/lib/format';
import { supplyUnitCost } from '@/lib/pricing';

const UNITS = ['und', 'g', 'kg', 'ml', 'l', 'cm', 'm', 'hoja', 'par', 'hora'];

export default function Insumos() {
  const { data, setData, setList, loading, error } = useAdvanced();
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState({ supplier: '', price: '', qty: '', url: '' });
  const [msg, setMsg] = useState('');
  if (loading) return <p className="muted">Cargando…</p>;

  const iva = data.settings.iva_responsable;
  const supply = data.supplies.find((s) => s.id === selected) ?? null;
  const supplierName = (id: number | null) => data.suppliers.find((s) => s.id === id)?.name ?? '';

  // Opciones del comparador: el precio actual + las cotizaciones guardadas
  const options = supply
    ? [
        { id: 0, supplier: supplierName(supply.supplier_id) || 'Actual', price: supply.price, qty: supply.qty, url: supply.url, quote_date: supply.price_date, current: true },
        ...data.quotes.filter((q) => q.supply_id === supply.id).map((q) => ({ ...q, current: false })),
      ]
        .map((o) => ({ ...o, unit: supplyUnitCost({ price: o.price, qty: o.qty, iva_pct: supply.iva_pct, waste_pct: supply.waste_pct }, iva) }))
        .sort((a, b) => a.unit - b.unit)
    : [];

  async function addQuote(e: React.FormEvent) {
    e.preventDefault();
    if (!supply) return;
    const q = await create<SupplyQuote>('supply_quotes', {
      supply_id: supply.id, supplier: draft.supplier, price: parseFloat(draft.price) || 0, qty: parseFloat(draft.qty) || supply.qty, url: draft.url,
    });
    setData((d) => ({ ...d, quotes: [q, ...d.quotes] }));
    setDraft({ supplier: '', price: '', qty: '', url: '' });
  }

  async function useOption(o: (typeof options)[number]) {
    if (!supply || o.current) return;
    let supplier = data.suppliers.find((s) => s.name.toLowerCase() === o.supplier.toLowerCase());
    if (!supplier && o.supplier) {
      supplier = await create('suppliers', { name: o.supplier, url: o.url });
      setData((d) => ({ ...d, suppliers: [...d.suppliers, supplier!] }));
    }
    const today = new Date().toISOString().slice(0, 10);
    const row = await update<SupplyRow>('supplies', supply.id, {
      price: o.price, qty: o.qty, url: o.url, price_date: today, supplier_id: supplier?.id ?? null,
    });
    setData((d) => ({ ...d, supplies: d.supplies.map((s) => (s.id === row.id ? row : s)) }));
    setMsg(`Ahora "${supply.name}" usa el precio de ${o.supplier || 'ese proveedor'}. Tus productos se recalculan solos.`);
  }

  async function delQuote(id: number) {
    await remove('supply_quotes', id);
    setData((d) => ({ ...d, quotes: d.quotes.filter((q) => q.id !== id) }));
  }

  return (
    <>
      <div className="page-head">
        <h1>Insumos, materiales y mercancía</h1>
        <p className="muted">
          Todo lo que compras. Escribe la cantidad que trae el paquete en la unidad más pequeña que uses (1 kg = 1000 g).
          ¿Buscas mejor precio? Usa el <Link href="/app/buscador">buscador</Link> o el comparador de abajo.
        </p>
      </div>
      {error && <div className="alert bad">{error}</div>}
      <CrudTable<SupplyRow>
        resource="supplies"
        rows={data.supplies}
        setRows={setList('supplies')}
        blank={{ name: 'Nuevo insumo', qty: 1, unit: 'und' }}
        addLabel="+ Agregar insumo"
        csvName="insumos"
        cols={[
          { key: 'name', label: 'Insumo' },
          { key: 'category', label: 'Categoría', width: 120 },
          { key: 'supplier_id', label: 'Proveedor', type: 'select', options: data.suppliers.map((s) => ({ value: s.id, label: s.name })) },
          { key: 'presentation', label: 'Presentación', width: 120 },
          { key: 'qty', label: 'Cantidad', type: 'num', width: 90 },
          { key: 'unit', label: 'Unidad', type: 'select', options: UNITS.map((u) => ({ value: u, label: u })) },
          { key: 'price', label: 'Precio de compra', type: 'num' },
          { key: 'iva_pct', label: '% IVA incluido', type: 'pct', width: 80 },
          { key: 'waste_pct', label: '% merma', type: 'pct', width: 80 },
          { key: 'unitcost', label: 'Costo por unidad', computed: (r) => money(supplyUnitCost(r, iva)), csv: (r) => supplyUnitCost(r, iva).toFixed(2) },
          { key: 'price_date', label: 'Fecha precio', type: 'date', width: 140 },
          { key: 'url', label: 'Enlace', width: 160 },
        ]}
        extraActions={(r) => (
          <button type="button" className="ghost" style={{ padding: '4px 8px' }} onClick={() => setSelected(r.id)}>Comparar</button>
        )}
      />

      <section className="card" style={{ marginTop: 20 }}>
        <h2>Comparador de proveedores</h2>
        <div className="field" style={{ maxWidth: 360 }}>
          <label htmlFor="sel">Insumo</label>
          <select id="sel" value={selected ?? ''} onChange={(e) => setSelected(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Elige un insumo…</option>
            {data.supplies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {msg && <div className="alert">{msg}</div>}
        {supply && (
          <>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Proveedor</th><th className="num">Precio</th><th className="num">Cantidad</th><th className="num">Costo por {supply.unit}</th><th>Fecha</th><th /></tr></thead>
                <tbody>
                  {options.map((o, i) => (
                    <tr key={`${o.current}-${o.id}`}>
                      <td>
                        {o.url ? <a href={o.url} target="_blank" rel="noreferrer">{o.supplier || '—'}</a> : o.supplier || '—'}{' '}
                        {i === 0 && <span className="badge">Más barato</span>} {o.current && <span className="badge lock">En uso</span>}
                      </td>
                      <td className="num">{money(o.price)}</td>
                      <td className="num">{o.qty} {supply.unit}</td>
                      <td className="num"><strong>{money(o.unit)}</strong></td>
                      <td>{String(o.quote_date).slice(0, 10)}</td>
                      <td>
                        {!o.current && <button type="button" className="ghost" style={{ padding: '4px 8px' }} onClick={() => useOption(o)}>Usar este</button>}
                        {!o.current && <button type="button" className="danger" aria-label="Borrar" onClick={() => delQuote(o.id)}>✕</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <form onSubmit={addQuote} className="row" style={{ marginTop: 12 }}>
              <div><label htmlFor="qs">Otro proveedor</label><input id="qs" value={draft.supplier} onChange={(e) => setDraft({ ...draft, supplier: e.target.value })} required /></div>
              <div><label htmlFor="qp">Precio</label><input id="qp" inputMode="decimal" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} required /></div>
              <div><label htmlFor="qq">Cantidad ({supply.unit})</label><input id="qq" inputMode="decimal" value={draft.qty} placeholder={String(supply.qty)} onChange={(e) => setDraft({ ...draft, qty: e.target.value })} /></div>
              <div><label htmlFor="qu">Enlace</label><input id="qu" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} /></div>
              <button type="submit" className="shrink">Agregar cotización</button>
            </form>
          </>
        )}
      </section>
    </>
  );
}
