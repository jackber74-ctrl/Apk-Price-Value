'use client';
import CrudTable from '@/components/CrudTable';
import { useAdvanced } from '@/components/useAdvanced';
import type { EquipmentRow } from '@/lib/advanced';
import { money } from '@/lib/format';
import { equipmentMonthly } from '@/lib/pricing';

const CHARGES = ['Como gasto fijo', 'Por minutos de uso'];

export default function Equipos() {
  const { data, setList, loading, error } = useAdvanced();
  if (loading) return <p className="muted">Cargando…</p>;
  return (
    <>
      <div className="page-head">
        <h1>Equipos y herramientas</h1>
        <p className="muted">
          Su desgaste (depreciación) y mantenimiento también deben salir del precio. &quot;Por minutos de uso&quot; para máquinas que usas
          en pasos concretos (se cargan en el proceso de cada producto); &quot;Como gasto fijo&quot; para el resto.
        </p>
      </div>
      {error && <div className="alert bad">{error}</div>}
      <CrudTable<EquipmentRow>
        resource="equipment"
        rows={data.equipment}
        setRows={setList('equipment')}
        blank={{ name: 'Nuevo equipo', life_years: 5, charge: 'Como gasto fijo' }}
        addLabel="+ Agregar equipo"
        cols={[
          { key: 'name', label: 'Equipo' },
          { key: 'cost', label: 'Valor de compra', type: 'num' },
          { key: 'life_years', label: 'Vida útil (años)', type: 'num' },
          { key: 'residual', label: 'Valor residual', type: 'num' },
          { key: 'maint_year', label: 'Mantenimiento anual', type: 'num' },
          { key: 'charge', label: '¿Cómo se carga?', type: 'select', options: CHARGES.map((c) => ({ value: c, label: c })) },
          { key: 'hours_month', label: 'Horas de uso/mes', type: 'num' },
          { key: 'dep', label: 'Depreciación mensual', computed: (r) => money(equipmentMonthly(r).dep) },
          { key: 'monthly', label: 'Costo mensual', computed: (r) => money(equipmentMonthly(r).monthly), csv: (r) => Math.round(equipmentMonthly(r).monthly) },
          { key: 'pm', label: 'Costo por minuto', computed: (r) => (r.charge === 'Por minutos de uso' ? money(equipmentMonthly(r).perMinute) : '—') },
        ]}
      />
    </>
  );
}
