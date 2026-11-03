'use client';
import { useMemo, useState } from 'react';
import CrudTable from '@/components/CrudTable';
import { useAdvanced } from '@/components/useAdvanced';
import { computeProducts, fixedTotals, type ProductRow, type RecipeRow, type StepRow } from '@/lib/advanced';
import { downloadCsv } from '@/lib/client';
import { money, pct } from '@/lib/format';
import { supplyUnitCost, workerMonthlyCost, equipmentMonthly } from '@/lib/pricing';

export default function Productos() {
  const { data, setData, setList, loading, error } = useAdvanced();
  const [selected, setSelected] = useState<number | null>(null);
  const results = useMemo(() => computeProducts(data), [data]);
  if (loading) return <p className="muted">Cargando…</p>;

  const fx = fixedTotals(data);
  const sales = results.reduce((a, r) => a + r.monthlySales, 0);
  const profit = results.reduce((a, r) => a + r.monthlyProfit, 0);
  const alerts = results.filter((r) => !r.diagnosis.startsWith('✓')).length;
  const product = data.products.find((p) => p.id === selected) ?? null;
  const iva = data.settings.iva_responsable;

  const setRecipes = (pid: number) => (fn: (prev: RecipeRow[]) => RecipeRow[]) =>
    setData((d) => ({ ...d, recipes: [...d.recipes.filter((r) => r.product_id !== pid), ...fn(d.recipes.filter((r) => r.product_id === pid))] }));
  const setSteps = (pid: number) => (fn: (prev: StepRow[]) => StepRow[]) =>
    setData((d) => ({ ...d, steps: [...d.steps.filter((r) => r.product_id !== pid), ...fn(d.steps.filter((r) => r.product_id === pid))] }));

  function exportResults() {
    downloadCsv(
      'productos-y-precios.csv',
      ['Producto', 'Tipo', 'Materiales', 'Otros variables', 'Mano de obra', 'Equipos', 'Costo directo', 'Gastos fijos asignados', 'Costo total', 'Margen', 'Precio sugerido', 'Precio en uso', 'Utilidad por unidad', 'Margen real', 'Diagnóstico'],
      results.map((r) => [
        r.p.name, r.p.kind, Math.round(r.materials), r.p.other_var_cost, Math.round(r.labor), Math.round(r.equip), Math.round(r.direct),
        Math.round(r.fixedShare), Math.round(r.total), r.margin, r.price.finalPrice, r.inUse, Math.round(r.profit), r.realMargin.toFixed(3), r.diagnosis,
      ]),
    );
  }

  return (
    <>
      <div className="page-head">
        <h1>Productos y servicios: costo real y precio sugerido</h1>
        <p className="muted">
          El precio sugerido cubre materiales, mano de obra, equipos, tu parte de los gastos fijos, la comisión de pagos y tu margen.
          Gastos fijos repartidos {data.settings.fixed_method === 'minuto' ? 'por minuto de trabajo' : 'por unidad vendida'}.
        </p>
      </div>
      {error && <div className="alert bad">{error}</div>}

      <div className="features" style={{ marginTop: 0, marginBottom: 16 }}>
        <div className="card tight"><p className="muted small" style={{ margin: 0 }}>Gastos fijos al mes</p><strong>{money(fx.total)}</strong></div>
        <div className="card tight"><p className="muted small" style={{ margin: 0 }}>Ventas esperadas al mes</p><strong>{money(sales)}</strong></div>
        <div className="card tight"><p className="muted small" style={{ margin: 0 }}>Utilidad esperada al mes</p><strong style={{ color: profit < 0 ? 'var(--bad)' : 'var(--good)' }}>{money(profit)}</strong></div>
        <div className="card tight"><p className="muted small" style={{ margin: 0 }}>Margen promedio · alertas</p><strong>{sales ? pct(profit / sales) : '—'} · {alerts}</strong></div>
      </div>

      <section className="card">
        <h2>Resultado por producto</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th><th className="num">Materiales</th><th className="num">Mano de obra</th><th className="num">Equipos</th>
                <th className="num">Otros var.</th><th className="num">Fijos asignados</th><th className="num">Costo total</th><th className="num">Margen</th>
                <th className="num">Precio sugerido</th><th className="num">Precio en uso</th><th className="num">Utilidad/und</th><th className="num">Margen real</th>
                <th className="num">Vs. competencia</th><th>Diagnóstico</th><th />
              </tr>
            </thead>
            <tbody>
              {results.length === 0 && <tr><td colSpan={15} className="muted">Agrega tu primer producto o servicio abajo.</td></tr>}
              {results.map((r) => (
                <tr key={r.p.id}>
                  <td><strong>{r.p.name}</strong> <span className="muted small">{r.p.kind}</span></td>
                  <td className="num">{money(r.materials)}</td>
                  <td className="num">{money(r.labor)}</td>
                  <td className="num">{money(r.equip)}</td>
                  <td className="num">{money(r.p.other_var_cost)}</td>
                  <td className="num">{money(r.fixedShare)}</td>
                  <td className="num"><strong>{money(r.total)}</strong></td>
                  <td className="num">{pct(r.margin, 0)}</td>
                  <td className="num"><strong style={{ color: 'var(--accent)' }}>{r.price.ok ? money(r.price.finalPrice) : '—'}</strong></td>
                  <td className="num">{money(r.inUse)}</td>
                  <td className="num" style={{ color: r.profit < 0 ? 'var(--bad)' : undefined }}>{money(r.profit)}</td>
                  <td className="num">{pct(r.realMargin)}</td>
                  <td className="num">{r.compRatio == null ? '—' : `${r.compRatio > 0 ? '+' : ''}${pct(r.compRatio)}`}</td>
                  <td><span className={`badge ${r.diagnosis.startsWith('⚠') ? 'bad' : r.diagnosis.startsWith('✓') ? '' : 'warn'}`}>{r.diagnosis}</span></td>
                  <td><button type="button" className="ghost" style={{ padding: '4px 8px' }} onClick={() => setSelected(r.p.id)}>Receta y proceso</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="ghost" style={{ marginTop: 10 }} onClick={exportResults}>Exportar a Excel (CSV)</button>
      </section>

      <section className="card">
        <h2>Tus productos y servicios</h2>
        <p className="muted small">Margen, comisión e IVA vacíos = valor de Configuración. &quot;Precio que cobras&quot; vacío = se usa el sugerido.</p>
        <CrudTable<ProductRow>
          resource="products"
          rows={data.products}
          setRows={setList('products')}
          blank={{ name: 'Nuevo producto', kind: 'Producto', units_month: 10 }}
          addLabel="+ Agregar producto o servicio"
          cols={[
            { key: 'name', label: 'Nombre' },
            { key: 'kind', label: 'Tipo', type: 'select', options: [{ value: 'Producto', label: 'Producto' }, { value: 'Servicio', label: 'Servicio' }] },
            { key: 'category', label: 'Categoría', width: 120 },
            { key: 'units_month', label: 'Unidades/mes', type: 'num', width: 90 },
            { key: 'other_var_cost', label: 'Otros variables ($)', type: 'num' },
            { key: 'margin', label: '% margen', type: 'pct', width: 80 },
            { key: 'commission', label: '% comisión', type: 'pct', width: 80 },
            { key: 'iva_pct', label: '% IVA', type: 'pct', width: 80 },
            { key: 'current_price', label: 'Precio que cobras', type: 'num' },
            { key: 'competitor_price', label: 'Precio competencia', type: 'num' },
          ]}
        />
      </section>

      {product && (
        <section className="card" id="detalle">
          <div className="row" style={{ alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>{product.name}: receta y proceso</h2>
            <button type="button" className="ghost shrink" onClick={() => setSelected(null)}>Cerrar</button>
          </div>
          <h3 style={{ marginTop: 16 }}>Materiales que lleva (por unidad)</h3>
          {data.supplies.length === 0 && <p className="small">Primero agrega insumos en la pestaña Insumos.</p>}
          <CrudTable<RecipeRow>
            resource="recipe_items"
            rows={data.recipes.filter((r) => r.product_id === product.id)}
            setRows={setRecipes(product.id)}
            blank={{ product_id: product.id, supply_id: data.supplies[0]?.id, qty: 1 }}
            addLabel="+ Agregar material"
            csvName={`receta-${product.name}`}
            cols={[
              { key: 'supply_id', label: 'Insumo', type: 'select', options: data.supplies.map((s) => ({ value: s.id, label: `${s.name} (${s.unit})` })) },
              { key: 'qty', label: 'Cantidad', type: 'num' },
              {
                key: 'cost', label: 'Costo',
                computed: (r) => {
                  const s = data.supplies.find((x) => x.id === r.supply_id);
                  return money(s ? supplyUnitCost(s, iva) * r.qty : 0);
                },
              },
            ]}
          />
          <h3 style={{ marginTop: 20 }}>Pasos de elaboración o atención</h3>
          <CrudTable<StepRow>
            resource="process_steps"
            rows={data.steps.filter((r) => r.product_id === product.id)}
            setRows={setSteps(product.id)}
            blank={{ product_id: product.id, step: 'Nuevo paso', worker_id: data.workers.find((w) => w.direct)?.id ?? null, minutes: 10 }}
            addLabel="+ Agregar paso"
            csvName={`proceso-${product.name}`}
            cols={[
              { key: 'step', label: 'Paso' },
              { key: 'worker_id', label: 'Quién lo hace', type: 'select', options: data.workers.map((w) => ({ value: w.id, label: w.name })) },
              { key: 'minutes', label: 'Minutos', type: 'num', width: 80 },
              { key: 'equipment_id', label: 'Equipo', type: 'select', options: data.equipment.filter((e) => e.charge === 'Por minutos de uso').map((e) => ({ value: e.id, label: e.name })) },
              { key: 'equip_minutes', label: 'Min. de equipo', type: 'num', width: 80 },
              {
                key: 'cost', label: 'Costo',
                computed: (r) => {
                  const w = data.workers.find((x) => x.id === r.worker_id);
                  const e = data.equipment.find((x) => x.id === r.equipment_id);
                  const c = (w ? workerMonthlyCost(w, data.settings).perMinute * r.minutes : 0) + (e ? equipmentMonthly(e).perMinute * r.equip_minutes : 0);
                  return money(c);
                },
              },
            ]}
          />
        </section>
      )}
    </>
  );
}
