'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, create, list, remove } from '@/lib/client';
import { money, pct } from '@/lib/format';
import { DEFAULT_SETTINGS, breakEvenUnits, diagnose, monthlyAmount, suggestedPrice, type Settings } from '@/lib/pricing';

type FixedCost = { id: number; name: string; amount: number; frequency: string; mandatory: boolean };
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

export default function Calculadora() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [fixed, setFixed] = useState<FixedCost[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [st, setSt] = useState<CalcState>(() => initialState(DEFAULT_SETTINGS));
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    Promise.all([api<{ settings: Settings }>('/api/settings'), list<FixedCost>('fixed_costs'), list<Quote>('quotes')])
      .then(([s, f, q]) => {
        setSettings(s.settings);
        setFixed(f);
        setQuotes(q);
        setSt({ ...initialState(s.settings), selectedFixed: f.filter((x) => x.mandatory).map((x) => x.id) });
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

  async function saveQuote() {
    const name = st.name.trim() || `Cálculo ${new Date().toLocaleDateString('es-CO')}`;
    try {
      const q = await create<Quote>('quotes', { name, data: st, price: calc.r.finalPrice });
      setQuotes((p) => [q, ...p]);
      setMsg(`Guardado: ${name}`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function deleteQuote(id: number) {
    await remove('quotes', id);
    setQuotes((p) => p.filter((q) => q.id !== id));
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
                <button type="button" className="danger shrink" aria-label="Quitar" onClick={() => set('lines', st.lines.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button type="button" className="ghost" onClick={() => set('lines', [...st.lines, { id: uid(), name: '', amount: '' }])}>+ Agregar costo</button>

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
            <button type="button" style={{ width: '100%', marginTop: 14 }} onClick={saveQuote} disabled={!calc.r.ok}>Guardar cálculo</button>
          </section>

          <section className="card">
            <h3>Cálculos guardados</h3>
            {quotes.length === 0 && <p className="muted small">Aquí aparecen los que guardes.</p>}
            {quotes.map((q) => (
              <div className="check-row" key={q.id}>
                <button type="button" className="ghost grow" style={{ textAlign: 'left' }} onClick={() => setSt({ ...initialState(settings), ...q.data })}>
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
