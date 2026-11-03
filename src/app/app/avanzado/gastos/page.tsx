'use client';
import CrudTable from '@/components/CrudTable';
import { useAdvanced } from '@/components/useAdvanced';
import { fixedTotals, type FixedRow } from '@/lib/advanced';
import { money } from '@/lib/format';
import { FREQUENCY_MONTHS, monthlyAmount } from '@/lib/pricing';

export default function Gastos() {
  const { data, setList, loading, error } = useAdvanced();
  if (loading) return <p className="muted">Cargando…</p>;
  const t = fixedTotals(data);
  return (
    <>
      <div className="page-head">
        <h1>Gastos fijos del mes</h1>
        <p className="muted">
          Lo que pagas aunque no vendas: arriendo, internet, publicidad, contador… Marca como <strong>indispensable</strong> lo
          que debe ir sí o sí en todos los precios. En la calculadora simple los demás se pueden elegir uno por uno.
        </p>
      </div>
      {error && <div className="alert bad">{error}</div>}
      <div className="card tight">
        <div className="kv"><span>Gastos de esta tabla</span><strong>{money(t.table)}</strong></div>
        <div className="kv"><span>(+) Mano de obra indirecta (hoja Mano de obra)</span><strong>{money(t.indirectLabor)}</strong></div>
        <div className="kv"><span>(+) Equipos cargados como gasto fijo</span><strong>{money(t.equipAsFixed)}</strong></div>
        <div className="kv"><span>(=) Total a repartir entre productos (modo avanzado)</span><strong>{money(t.total)}</strong></div>
      </div>
      <CrudTable<FixedRow>
        resource="fixed_costs"
        rows={data.fixed}
        setRows={setList('fixed')}
        blank={{ name: 'Nuevo gasto', frequency: 'Mensual', amount: 0 }}
        addLabel="+ Agregar gasto fijo"
        cols={[
          { key: 'name', label: 'Concepto' },
          { key: 'category', label: 'Categoría', width: 130 },
          { key: 'amount', label: 'Valor que pagas', type: 'num' },
          { key: 'frequency', label: 'Frecuencia', type: 'select', options: Object.keys(FREQUENCY_MONTHS).map((f) => ({ value: f, label: f })) },
          { key: 'mandatory', label: 'Indispensable', type: 'bool' },
          { key: 'monthly', label: 'Valor mensual', computed: (r) => money(monthlyAmount(r.amount, r.frequency)), csv: (r) => Math.round(monthlyAmount(r.amount, r.frequency)) },
        ]}
      />
    </>
  );
}
