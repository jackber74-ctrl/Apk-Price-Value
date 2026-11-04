'use client';
import { useEffect, useState } from 'react';
import PlanGate from '@/components/PlanGate';
import { api, create, list } from '@/lib/client';
import { money } from '@/lib/format';
import type { SearchResult } from '@/lib/search';

type Supply = { id: number; name: string; unit: string; qty: number };
type Supplier = { id: number; name: string };
type Resp = { results: SearchResult[]; links: { name: string; url: string }[]; configured: boolean; error?: string };

function Buscador() {
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<'productos' | 'proveedores'>('productos');
  const [resp, setResp] = useState<Resp | null>(null);
  const [busy, setBusy] = useState(false);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [target, setTarget] = useState<string>('new');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    list<Supply>('supplies').then(setSupplies).catch(() => {});
    list<Supplier>('suppliers').then(setSuppliers).catch(() => {});
  }, []);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setMsg('');
    try {
      setResp(await api<Resp>(`/api/search?mode=${mode}&q=${encodeURIComponent(q)}`));
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function ensureSupplier(name: string, url: string) {
    const found = suppliers.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (found) return found;
    const s = await create<Supplier>('suppliers', { name: name || 'Proveedor en línea', url });
    setSuppliers((p) => [...p, s]);
    return s;
  }

  async function savePrice(r: SearchResult) {
    try {
      if (target === 'new') {
        const sup = await ensureSupplier(r.source, r.link);
        const s = await create<Supply>('supplies', {
          name: r.title.slice(0, 120), supplier_id: sup.id, price: r.price ?? 0, qty: 1, unit: 'und', url: r.link, category: q,
        });
        setSupplies((p) => [...p, s]);
        setMsg(`Guardado como insumo nuevo: "${s.name}". Ajusta la cantidad y unidad en Avanzado → Insumos.`);
      } else {
        const supply = supplies.find((s) => String(s.id) === target);
        await create('supply_quotes', { supply_id: Number(target), supplier: r.source, price: r.price ?? 0, qty: supply?.qty ?? 1, url: r.link });
        setMsg(`Cotización agregada al comparador de "${supply?.name}".`);
      }
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  async function saveSupplier(r: SearchResult) {
    try {
      const s = await ensureSupplier(r.source || r.title, r.link);
      setMsg(`"${s.name}" quedó en tu lista de proveedores.`);
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Buscar proveedores en línea</h1>
        <p className="muted">Escribe lo que necesitas comprar. Puedes guardar un resultado como insumo o sumarlo al comparador.</p>
      </div>

      <form className="card" onSubmit={search}>
        <div className="row">
          <div style={{ flex: '3 1 260px' }}>
            <label htmlFor="q">¿Qué necesitas?</label>
            <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ej.: frasco vidrio 50 ml, cajas kraft, esencia de vainilla…" />
          </div>
          <div className="shrink">
            <label>Buscar</label>
            <div className="chips">
              <button type="button" className={`chip ${mode === 'productos' ? 'on' : ''}`} onClick={() => setMode('productos')}>Precios</button>
              <button type="button" className={`chip ${mode === 'proveedores' ? 'on' : ''}`} onClick={() => setMode('proveedores')}>Mayoristas</button>
            </div>
          </div>
          <button type="submit" className="shrink" disabled={busy}>{busy ? 'Buscando…' : 'Buscar'}</button>
        </div>
        {mode === 'productos' && (
          <div className="field" style={{ marginTop: 12, maxWidth: 420 }}>
            <label htmlFor="target">Al guardar un precio…</label>
            <select id="target" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="new">Crear un insumo nuevo</option>
              {supplies.map((s) => <option key={s.id} value={s.id}>Comparar con: {s.name}</option>)}
            </select>
          </div>
        )}
      </form>

      {msg && <div className="alert">{msg}</div>}

      {resp && (
        <>
          {!resp.configured && (
            <div className="alert">
              Para ver los resultados aquí mismo falta la clave del buscador (SERPER_API_KEY). Mientras tanto, abre la búsqueda en estas tiendas:
            </div>
          )}
          {resp.error && <div className="alert bad">{resp.error}</div>}
          <div className="chips" style={{ marginBottom: 16 }}>
            {resp.links.map((l) => (
              <a key={l.name} className="chip" href={l.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>{l.name} ↗</a>
            ))}
          </div>
          {resp.configured && resp.results.length === 0 && !resp.error && <p className="muted">Sin resultados. Prueba con otras palabras.</p>}
          <div className="results">
            {resp.results.map((r, i) => (
              <article className="card tight result" key={`${r.link}-${i}`} style={{ margin: 0 }}>
                {r.image && <img src={r.image} alt="" loading="lazy" />}
                <a className="title" href={r.link} target="_blank" rel="noreferrer">{r.title}</a>
                <span className="muted small">{r.source}</span>
                {r.snippet && <span className="small">{r.snippet}</span>}
                {r.price != null && <span className="price">{money(r.price)}</span>}
                {mode === 'productos' ? (
                  <button type="button" onClick={() => savePrice(r)}>{target === 'new' ? 'Guardar como insumo' : 'Agregar al comparador'}</button>
                ) : (
                  <button type="button" className="ghost" onClick={() => saveSupplier(r)}>Guardar proveedor</button>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default function Page() {
  return (
    <PlanGate feature="search" title="Buscador de proveedores">
      <Buscador />
    </PlanGate>
  );
}
