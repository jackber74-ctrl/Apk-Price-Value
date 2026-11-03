'use client';
import CrudTable from '@/components/CrudTable';
import { useAdvanced } from '@/components/useAdvanced';
import type { WorkerRow } from '@/lib/advanced';
import { money, pct } from '@/lib/format';
import { ARL_RATES, workerMonthlyCost } from '@/lib/pricing';

const CONTRACTS = ['Contrato laboral', 'Prestación de servicios', 'Dueño(a) / socio(a)'];

export default function Personal() {
  const { data, setList, loading, error } = useAdvanced();
  if (loading) return <p className="muted">Cargando…</p>;
  const cfg = data.settings;
  return (
    <>
      <div className="page-head">
        <h1>Mano de obra</h1>
        <p className="muted">
          El costo real de cada persona en Colombia 2026: con contrato laboral suma auxilio de transporte, salud, pensión, ARL,
          caja, ICBF, SENA, prima, cesantías, intereses y vacaciones. Inclúyete con el sueldo que mereces ganar.
          Directa = produce o atiende (va a los productos). Indirecta = administrativa (va a gastos fijos).
        </p>
      </div>
      {error && <div className="alert bad">{error}</div>}
      <CrudTable<WorkerRow>
        resource="workers"
        rows={data.workers}
        setRows={setList('workers')}
        blank={{ name: 'Nueva persona', contract: 'Contrato laboral', direct: true, salary: cfg.min_wage, arl_class: 'I' }}
        addLabel="+ Agregar persona"
        cols={[
          { key: 'name', label: 'Nombre o rol' },
          { key: 'contract', label: 'Vinculación', type: 'select', options: CONTRACTS.map((c) => ({ value: c, label: c })) },
          { key: 'direct', label: 'Directa', type: 'bool' },
          { key: 'salary', label: 'Salario / pago mensual', type: 'num' },
          { key: 'arl_class', label: 'Riesgo ARL', type: 'select', options: Object.keys(ARL_RATES).map((k) => ({ value: k, label: k })) },
          { key: 'hours', label: 'Horas productivas/mes', type: 'num' },
          { key: 'total', label: 'Costo total mensual', computed: (r) => money(workerMonthlyCost(r, cfg).total), csv: (r) => Math.round(workerMonthlyCost(r, cfg).total) },
          { key: 'extra', label: 'Carga sobre salario', computed: (r) => pct(workerMonthlyCost(r, cfg).extra) },
          { key: 'hour', label: 'Costo por hora', computed: (r) => money(workerMonthlyCost(r, cfg).perMinute * 60) },
          { key: 'min', label: 'Costo por minuto', computed: (r) => money(workerMonthlyCost(r, cfg).perMinute), csv: (r) => workerMonthlyCost(r, cfg).perMinute.toFixed(2) },
        ]}
      />
      <p className="muted small" style={{ marginTop: 10 }}>
        Horas productivas vacías = {cfg.hours_month} h × {Math.round(cfg.productive_pct * 100)} % = {Math.round(cfg.hours_month * cfg.productive_pct)} h (cámbialo en Configuración).
      </p>
    </>
  );
}
