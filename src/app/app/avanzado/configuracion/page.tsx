'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { DEFAULT_SETTINGS, type Settings } from '@/lib/pricing';

type Field = { key: keyof Settings; label: string; type: 'text' | 'num' | 'pct' | 'bool' | 'method'; help?: string };

const FIELDS: { title: string; fields: Field[] }[] = [
  { title: 'Negocio', fields: [{ key: 'business_name', label: 'Nombre del negocio', type: 'text' }] },
  {
    title: 'Impuestos',
    fields: [
      { key: 'iva_responsable', label: '¿Eres responsable de IVA?', type: 'bool', help: 'Si no lo eres, el IVA que pagas a proveedores se vuelve parte del costo y no cobras IVA.' },
      { key: 'iva_rate', label: 'Tarifa general de IVA (%)', type: 'pct' },
    ],
  },
  {
    title: 'Precios',
    fields: [
      { key: 'margin', label: 'Margen de ganancia por defecto (% sobre el precio)', type: 'pct' },
      { key: 'commission', label: 'Comisión de medios de pago o plataformas (%)', type: 'pct' },
      { key: 'round_to', label: 'Redondear precios al múltiplo de ($)', type: 'num', help: '500 convierte $43.120 en $43.500. 0 = sin redondeo.' },
      { key: 'fixed_method', label: 'Cómo repartir los gastos fijos', type: 'method' },
    ],
  },
  {
    title: 'Parámetros laborales 2026',
    fields: [
      { key: 'min_wage', label: 'Salario mínimo (SMMLV)', type: 'num' },
      { key: 'transport_aid', label: 'Auxilio de transporte', type: 'num' },
      { key: 'hours_month', label: 'Horas laborales al mes', type: 'num' },
      { key: 'productive_pct', label: 'Tiempo realmente productivo (%)', type: 'pct' },
      { key: 'exonerated', label: '¿Aplica exoneración de aportes (art. 114-1 E.T.)?', type: 'bool' },
    ],
  },
];

export default function Configuracion() {
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    api<{ settings: Settings }>('/api/settings').then((r) => setS(r.settings));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await api<{ settings: Settings }>('/api/settings', { method: 'PUT', body: s });
      setS(r.settings);
      setMsg('Configuración guardada.');
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  const val = (f: Field) => (f.type === 'pct' ? +(Number(s[f.key]) * 100).toFixed(4) : (s[f.key] as string | number));
  const put = (f: Field, raw: string | boolean) =>
    setS((p) => ({
      ...p,
      [f.key]: f.type === 'bool' ? raw : f.type === 'pct' ? parseFloat(String(raw)) / 100 : f.type === 'num' ? parseFloat(String(raw)) : raw,
    }));

  return (
    <form onSubmit={save} style={{ maxWidth: 720 }}>
      <div className="page-head">
        <h1>Configuración</h1>
        <p className="muted">Valores por defecto para todos tus cálculos.</p>
      </div>
      {msg && <div className="alert">{msg}</div>}
      {FIELDS.map((g) => (
        <section className="card" key={g.title}>
          <h2>{g.title}</h2>
          {g.fields.map((f) => (
            <div className="field" key={f.key}>
              {f.type === 'bool' ? (
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--ink)' }}>
                  <input type="checkbox" checked={!!s[f.key]} onChange={(e) => put(f, e.target.checked)} /> {f.label}
                </label>
              ) : f.type === 'method' ? (
                <>
                  <label htmlFor={f.key}>{f.label}</label>
                  <select id={f.key} value={s.fixed_method} onChange={(e) => put(f, e.target.value)}>
                    <option value="unidad">Por unidad vendida (simple, productos parecidos)</option>
                    <option value="minuto">Por minuto de trabajo (si unos productos toman más tiempo)</option>
                  </select>
                </>
              ) : (
                <>
                  <label htmlFor={f.key}>{f.label}</label>
                  <input id={f.key} inputMode={f.type === 'text' ? undefined : 'decimal'} value={String(val(f))} onChange={(e) => put(f, e.target.value)} />
                </>
              )}
              {f.help && <p className="muted small" style={{ margin: '4px 0 0' }}>{f.help}</p>}
            </div>
          ))}
        </section>
      ))}
      <button type="submit">Guardar configuración</button>
    </form>
  );
}
