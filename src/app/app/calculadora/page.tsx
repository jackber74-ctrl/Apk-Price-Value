'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { api, create, list, remove, update } from '@/lib/client';
import { money, pct } from '@/lib/format';
import { DEFAULT_SETTINGS, breakEvenUnits, diagnose, monthlyAmount, suggestedPrice, supplyUnitCost, type Settings } from '@/lib/pricing';

type FixedCost = { id: number; name: string; amount: number; frequency: string; mandatory: boolean };
type Supply = { id: number; name: string; unit: string; price: number; qty: number; iva_pct: number; waste_pct: number };
type Line = { id: string; name: string; amount: string };
type Quote = { id: number; name: string; price: number; created_at: string; data: CalcState };

type CalcState = {
  name: string;
  kind: 'Producto' | 'Servicio';
  lines: Line[];
  hours: string;
  hourRate: string;
  units: string;
  selectedFixed: number[];
  extraFixed: string;
  extraFixedName?: string;
  margin: number;
  marginMode: 'precio' | 'costo';
  commission: string;
  withIva: boolean;
  ivaRate: string;
  roundTo: string;
  competitor: string;
};

const uid = () => Math.random().toString(36).slice(2, 9);
const num = (s: string) => {
  const x = parseFloat(String(s).replace(',', '.'));
  return Number.isFinite(x) ? x : 0;
};
const MARGINS = [10, 20, 25, 30, 40, 50, 60, 70];

function initialState(s: Settings): CalcState {
  return {
    name: '',
    kind: 'Producto',
    lines: [
      { id: uid(), name: 'Materia prima / producto', amount: '' },
      { id: uid(), name: 'Empaque', amount: '' },
    ],
    hours: '',
    hourRate: '',
    units: '100',
    selectedFixed: [],
    extraFixed: '',
    margin: s.margin * 100,
    marginMode: 'precio',
    commission: String(s.commission * 100),
    withIva: s.iva_responsable,
    ivaRate: String(s.iva_rate * 100),
    roundTo: String(s.round_to),
    competitor: '',
  };
}

function Calculadora() {
  const router = useRouter();
  const params = useSearchParams();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [fixed, setFixed] = useState<FixedCost[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [st, setSt] = useState<CalcState>(() => initialState(DEFAULT_SETTINGS));
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    Promise.all([api<{ settings: Settings }>('/api/settings'), list<FixedCost>('fixed_costs'), list<Quote>('quotes'), list<Supply>('supplies')])
      .then(([s, f, q, sup]) => {
        setSupplies(sup);
        setSettings(s.settings);
        setFixed(f);
        setQuotes(q);
        const base = { ...initialState(s.settings), selectedFixed: f.filter((x) => x.mandatory).map((x) => x.id) };
        const open = q.find((x) => x.id === Number(params.get('id')));
        if (open) {
          setSt({ ...base, ...open.data });
          setEditingId(open.id);
        } else {
          setSt(base);
        }
      })
      .catch((e) => setMsg(e.message))
      .finally(() => setLoaded(true));
  }, []);

  const set = <K extends keyof CalcState>(k: K, v: CalcState[K]) => setSt((p) => ({ ...p, [k]: v }));

  const calc = useMemo(() => {
    const materials = st.lines.reduce((a, l) => a + num(l.amount), 0);
    const labor = num(st.hours) * num(st.hourRate);
    const variable = materials + labor;
    const fixedMonthly =
      fixed
        .filter((f) => f.mandatory || st.selectedFixed.includes(f.id))
        .reduce((a, f) => a + monthlyAmount(Number(f.amount), f.frequency), 0) + num(st.extraFixed);
    const units = num(st.units);
    const fixedPerUnit = units > 0 ? fixedMonthly / units : 0;
    const unitCost = variable + fixedPerUnit;
    const commission = num(st.commission) / 100;
    const ivaRate = st.withIva ? num(st.ivaRate) / 100 : 0;
    const r = suggestedPrice({
      unitCost,
      margin: st.margin / 100,
      commission,
      ivaRate,
      roundTo: num(st.roundTo),
      marginMode: st.marginMode,
    });
    const finalNoTax = r.finalPrice / (1 + ivaRate);
    const be = breakEvenUnits(fixedMonthly, finalNoTax, variable, commission);
    const comp = num(st.competitor);
    const compRatio = comp > 0 ? r.finalPrice / comp - 1 : null;
    const target = st.marginMode === 'precio' ? st.margin / 100 : st.margin / 100 / (1 + st.margin / 100);
    return { materials, labor, variable, fixedMonthly, fixedPerUnit, unitCost, r, be, compRatio, diag: diagnose(r.profit, r.realMargin, target, compRatio), monthlyProfit: r.profit * units };
  }, [st, fixed]);

  function toggleFixed(id: number) {
    setSt((p) => ({
      ...p,
      selectedFixed: p.selectedFixed.includes(id) ? p.selectedFixed.filter((x) => x !== id) : [...p.selectedFixed, id],
    }));
  }

  async function saveQuote(asNew = false): Promise<Quote | null> {
    const name = st.name.trim() || `Cálculo ${new Date().toLocaleDateString('es-CO')}`;
    try {
      if (editingId && !asNew) {
        const q = await update<Quote>('quotes', editingId, { name, data: st, price: calc.r.finalPrice });
        setQuotes((p) => p.map((x) => (x.id === q.id ? q : x)));
        setMsg(`Actualizado: ${name}`);
        return q;
      }
      const q = await create<Quote>('quotes', { name, data: st, price: calc.r.finalPrice });
      setQuotes((p) => [q, ...p]);
      setEditingId(q.id);
      setMsg(`Guardado: ${name}`);
      return q;
    } catch (e) {
      setMsg((e as Error).message);
      return null;
    }
  }

  async function toEstimate() {
    const q = await saveQuote();
    if (q) router.push(`/app/cotizador?agregar=${q.id}`);
  }

  function newCalc() {
    setEditingId(null);
    setSt({ ...initialState(settings), selectedFixed: fixed.filter((x) => x.mandatory).map((x) => x.id) });
    setMsg('');
  }

  async function deleteQuote(id: number) {
    if (!window.confirm('¿Eliminar este cálculo guardado?')) return;
    await remove('quotes', id);
    setQuotes((p) => p.filter((q) => q.id !== id));
    if (editingId === id) setEditingId(null);
  }

  function addSupplyLine(idStr: string) {
    const sp = supplies.find((x) => x.id === Number(idStr));
    if (!sp) return;
    const cost = supplyUnitCost(sp, settings.iva_responsable);
    set('lines', [...st.lines, { id: uid(), name: sp.name, amount: String(Math.round(cost * 100) / 100) }]);
  }

  async function saveLineAsSupply(l: Line) {
    if (!l.name.trim() || num(l.amount) <= 0) return setMsg('Escribe el concepto y el valor para guardarlo como insumo.');
    try {
      const sp = await create<Supply>('supplies', { name: l.name.trim(), qty: 1, unit: 'und', price: num(l.amount) });
      setSupplies((p) => [...p, sp].sort((a, b) => a.name.localeCompare(b.name)));
      setMsg(`«${sp.name}» quedó guardado en tus insumos.`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function saveExtraAsFixed() {
    const name = (st.extraFixedName ?? '').trim();
    if (!name || num(st.extraFixed) <= 0) return setMsg('Escribe el nombre y el valor del gasto para guardarlo.');
    try {
      const f = await create<FixedCost>('fixed_costs', { name, amount: num(st.extraFixed), frequency: 'Mensual', mandatory: false });
      setFixed((p) => [...p, f]);
      setSt((p) => ({ ...p, selectedFixed: [...p.selectedFixed, f.id], extraFixed: '', extraFixedName: '' }));
      setMsg(`«${name}» quedó guardado en tus gastos fijos.`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  if (!loaded) return <p className="muted">Cargando…</p>;

  return (
    <>
      <div className="page-head">
        <h1>Calculadora de precio</h1>
        <p className="muted">Llena lo que sepas. El precio se calcula solo mientras escribes.</p>
      </div>
      {msg && <div className="alert">{msg}</div>}

      <div className="grid2">
        <div>
          <section className="card">
            <h2>1. ¿Qué vas a vender?</h2>
            <div className="row">
              <div className="field">
                <label htmlFor="name">Nombre</label>
                <input id="name" value={st.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej.: Perfume 50 ml" />
              </div>
              <div className="field shrink">
                <label>Tipo</label>
                <div className="chips">
                  {(['Producto', 'Servicio'] as const).map((k) => (
                    <button key={k} type="button" className={`chip ${st.kind === k ? 'on' : ''}`} onClick={() => set('kind', k)}>{k}</button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            <h2>2. Costos variables por unidad</h2>
            <p className="muted small">Lo que gastas cada vez que haces o vendes una unidad: materiales, empaque, envío, transporte…</p>
            {st.lines.map((l, i) => (
              <div className="row" key={l.id} style={{ marginBottom: 8 }}>
                <input aria-label="Concepto" value={l.name} placeholder="Concepto"
                  onChange={(e) => set('lines', st.lines.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <input aria-label="Valor" inputMode="decimal" value={l.amount} placeholder="$ por unidad"
                  onChange={(e) => set('lines', st.lines.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
                <button type="button" className="ghost shrink" title="Guardar como insumo para reutilizar" aria-label="Guardar como insumo" onClick={() => saveLineAsSupply(l)}>💾</button>
                <button type="button" className="danger shrink" aria-label="Quitar" onClick={() => set('lines', st.lines.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <div className="row">
              <button type="button" className="ghost shrink" onClick={() => set('lines', [...st.lines, { id: uid(), name: '', amount: '' }])}>+ Agregar costo</button>
              {supplies.length > 0 && (
                <select aria-label="Agregar insumo guardado" value="" onChange={(e) => addSupplyLine(e.target.value)}>
                  <option value="">+ Usar un insumo guardado…</option>
                  {supplies.map((x) => <option key={x.id} value={x.id}>{x.name} — {money(supplyUnitCost(x, settings.iva_responsable))}/{x.unit || 'und'}</option>)}
                </select>
              )}
            </div>
            <p className="muted small" style={{ margin: '6px 0 0' }}>Con 💾 guardas el concepto en tus insumos para usarlo otra vez.</p>

            <h3 style={{ marginTop: 18 }}>{st.kind === 'Servicio' ? 'Tiempo de trabajo' : 'Mano de obra (opcional)'}</h3>
            <div className="row">
              <div className="field">
                <label htmlFor="hours">Horas por unidad</label>
                <input id="hours" inputMode="decimal" value={st.hours} onChange={(e) => set('hours', e.target.value)} placeholder="Ej.: 1,5" />
              </div>
              <div className="field">
                <label htmlFor="rate">Valor de tu hora ($)</label>
                <input id="rate" inputMode="decimal" value={st.hourRate} onChange={(e) => set('hourRate', e.target.value)} placeholder="Ej.: 15000" />
              </div>
            </div>
          </section>

          <section className="card">
            <h2>3. Gastos fijos del mes</h2>
            <p className="muted small">Los indispensables siempre se suman. Marca los demás que quieras cargarle a este precio.</p>
            {fixed.length === 0 && (
              <p className="small">Aún no tienes gastos fijos guardados. <Link href="/app/avanzado/gastos">Agrégalos aquí</Link> (arriendo, internet, publicidad…).</p>
            )}
            {fixed.map((f) => {
              const on = f.mandatory || st.selectedFixed.includes(f.id);
              return (
                <label className="check-row" key={f.id} style={{ color: 'var(--ink)', fontSize: '0.95rem', margin: 0 }}>
                  <input type="checkbox" checked={on} disabled={f.mandatory} onChange={() => toggleFixed(f.id)} />
                  <span className="grow">{f.name} {f.mandatory && <span className="badge lock">Indispensable</span>}</span>
                  <span className="num">{money(monthlyAmount(Number(f.amount), f.frequency))}/mes</span>
                </label>
              );
            })}
            <div className="row" style={{ marginTop: 12 }}>
              <div className="field">
                <label htmlFor="extra">Otro gasto fijo solo para este cálculo ($/mes)</label>
                <input id="extra" inputMode="decimal" value={st.extraFixed} onChange={(e) => set('extraFixed', e.target.value)} placeholder="0" />
                {num(st.extraFixed) > 0 && (
                  <div className="row" style={{ marginTop: 6 }}>
                    <input aria-label="Nombre del gasto" value={st.extraFixedName ?? ''} placeholder="Nombre para guardarlo" onChange={(e) => set('extraFixedName', e.target.value)} />
                    <button type="button" className="ghost shrink" onClick={saveExtraAsFixed}>Guardar en mis gastos</button>
                  </div>
                )}
              </div>
              <div className="field">
                <label htmlFor="units">Unidades que esperas vender al mes</label>
                <input id="units" inputMode="decimal" value={st.units} onChange={(e) => set('units', e.target.value)} />
              </div>
            </div>
            <p className="muted small" style={{ margin: 0 }}>Los gastos fijos se reparten entre esas unidades.</p>
          </section>

          <section className="card">
            <h2>4. ¿Cuánto quieres ganar?</h2>
            <div className="chips" style={{ marginBottom: 10 }}>
              {MARGINS.map((m) => (
                <button key={m} type="button" className={`chip ${st.margin === m ? 'on' : ''}`} onClick={() => set('margin', m)}>{m} %</button>
              ))}
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="margin">Ganancia: {st.margin} %</label>
                <input id="margin" type="range" min={0} max={90} step={1} value={st.margin} onChange={(e) => set('margin', Number(e.target.value))} />
              </div>
              <div className="field shrink">
                <label>Calcular la ganancia sobre</label>
                <div className="chips">
                  <button type="button" className={`chip ${st.marginMode === 'precio' ? 'on' : ''}`} onClick={() => set('marginMode', 'precio')}>el precio</button>
                  <button type="button" className={`chip ${st.marginMode === 'costo' ? 'on' : ''}`} onClick={() => set('marginMode', 'costo')}>el costo</button>
                </div>
              </div>
            </div>
            <p className="muted small">
              {st.marginMode === 'precio'
                ? `De cada $100 que vendas, $${st.margin} son ganancia.`
                : `Al costo le sumas ${st.margin} %. (Menos ganancia real que calcularlo sobre el precio.)`}
            </p>
            <div className="row">
              <div className="field">
                <label htmlFor="com">Comisión datáfono / plataforma (%)</label>
                <input id="com" inputMode="decimal" value={st.commission} onChange={(e) => set('commission', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="round">Redondear a múltiplos de ($)</label>
                <input id="round" inputMode="decimal" value={st.roundTo} onChange={(e) => set('roundTo', e.target.value)} />
              </div>
            </div>
            <div className="row">
              <label className="check-row shrink" style={{ border: 0, color: 'var(--ink)', margin: 0 }}>
                <input type="checkbox" checked={st.withIva} onChange={(e) => set('withIva', e.target.checked)} /> Cobrar IVA
              </label>
              {st.withIva && (
                <div className="field">
                  <label htmlFor="iva">Tarifa IVA (%)</label>
                  <input id="iva" inputMode="decimal" value={st.ivaRate} onChange={(e) => set('ivaRate', e.target.value)} />
                </div>
              )}
              <div className="field">
                <label htmlFor="comp">Precio de la competencia (opcional)</label>
                <input id="comp" inputMode="decimal" value={st.competitor} onChange={(e) => set('competitor', e.target.value)} />
              </div>
            </div>
          </section>
        </div>

        <aside className="sticky">
          <section className="card">
            <p className="muted small" style={{ margin: 0 }}>Precio sugerido al público</p>
            {calc.r.ok ? (
              <div className="result-big">{money(calc.r.finalPrice)}</div>
            ) : (
              <div className="alert bad">{calc.r.message}</div>
            )}
            <p style={{ margin: '6px 0 14px' }}>
              <span className={`badge ${calc.diag.startsWith('⚠') ? 'bad' : calc.diag.startsWith('✓') ? '' : 'warn'}`}>{calc.diag}</span>
            </p>
            <div className="kv"><span>Costos variables</span><strong>{money(calc.variable)}</strong></div>
            {calc.labor > 0 && <div className="kv small muted"><span>· de ellos, mano de obra</span><span>{money(calc.labor)}</span></div>}
            <div className="kv"><span>Gastos fijos por unidad</span><strong>{money(calc.fixedPerUnit)}</strong></div>
            <div className="kv"><span>Costo total por unidad</span><strong>{money(calc.unitCost)}</strong></div>
            <div className="kv"><span>Precio sin impuesto</span><strong>{money(calc.r.priceNoTax)}</strong></div>
            {st.withIva && <div className="kv"><span>IVA</span><strong>{money(calc.r.tax)}</strong></div>}
            <div className="kv"><span>Ganancia por unidad</span><strong style={{ color: calc.r.profit < 0 ? 'var(--bad)' : 'var(--good)' }}>{money(calc.r.profit)}</strong></div>
            <div className="kv"><span>Margen real</span><strong>{pct(calc.r.realMargin)}</strong></div>
            <div className="kv"><span>Ganancia al mes ({num(st.units)} und)</span><strong>{money(calc.monthlyProfit)}</strong></div>
            <div className="kv"><span>Punto de equilibrio</span><strong>{Number.isFinite(calc.be) ? `${calc.be} und/mes` : 'No se alcanza'}</strong></div>
            {calc.compRatio != null && (
              <div className="kv"><span>Vs. competencia</span><strong>{calc.compRatio > 0 ? '+' : ''}{pct(calc.compRatio)}</strong></div>
            )}
            <button type="button" style={{ width: '100%', marginTop: 14 }} onClick={() => saveQuote()} disabled={!calc.r.ok}>
              {editingId ? 'Guardar cambios' : 'Guardar cálculo'}
            </button>
            {editingId && (
              <button type="button" className="ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => saveQuote(true)} disabled={!calc.r.ok}>Guardar como cálculo nuevo</button>
            )}
            <button type="button" className="ghost" style={{ width: '100%', marginTop: 8 }} onClick={toEstimate} disabled={!calc.r.ok}>Pasar al cotizador →</button>
            {editingId && <button type="button" className="ghost" style={{ width: '100%', marginTop: 8 }} onClick={newCalc}>Empezar un cálculo nuevo</button>}
          </section>

          <section className="card">
            <h3>Cálculos guardados</h3>
            {quotes.length === 0 && <p className="muted small">Aquí aparecen los que guardes.</p>}
            {quotes.map((q) => (
              <div className="check-row" key={q.id}>
                <button type="button" className="ghost grow" style={{ textAlign: 'left', fontWeight: q.id === editingId ? 700 : 400 }}
                  onClick={() => { setSt({ ...initialState(settings), ...q.data }); setEditingId(q.id); setMsg(`Editando «${q.name}».`); }}>
                  {q.name}
                </button>
                <span className="num">{money(Number(q.price))}</span>
                <button type="button" className="danger" aria-label="Borrar" onClick={() => deleteQuote(q.id)}>✕</button>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Cargando…</p>}>
      <Calculadora />
    </Suspense>
  );
}
