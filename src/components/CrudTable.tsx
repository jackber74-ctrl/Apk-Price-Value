'use client';
// Tabla editable genérica: cada celda se guarda al salir del campo.
import { useState } from 'react';
import { create, downloadCsv, remove, update } from '@/lib/client';

export type Col<T> = {
  key: string;
  label: string;
  type?: 'text' | 'num' | 'pct' | 'bool' | 'select' | 'date';
  options?: { value: string | number; label: string }[];
  width?: number;
  computed?: (row: T) => React.ReactNode; // columna calculada (solo lectura)
  csv?: (row: T) => string | number | null;
};

type Props<T extends { id: number }> = {
  resource: string;
  rows: T[];
  setRows: (update: (prev: T[]) => T[]) => void;
  cols: Col<T>[];
  blank: Partial<T>;
  addLabel?: string;
  csvName?: string;
  extraActions?: (row: T) => React.ReactNode;
};

function toInput(v: unknown, type: Col<unknown>['type']) {
  if (v == null) return '';
  if (type === 'pct') return String(+(Number(v) * 100).toFixed(4));
  if (type === 'date') return String(v).slice(0, 10);
  return String(v);
}
function fromInput(s: string, type: Col<unknown>['type']) {
  if (type === 'pct') return s === '' ? null : parseFloat(s.replace(',', '.')) / 100;
  if (type === 'num') return s === '' ? null : parseFloat(s.replace(',', '.'));
  return s;
}

export default function CrudTable<T extends { id: number }>({ resource, rows, setRows, cols, blank, addLabel, csvName, extraActions }: Props<T>) {
  const [error, setError] = useState('');

  async function save(row: T, key: string, value: unknown) {
    if ((row as Record<string, unknown>)[key] === value) return;
    try {
      const updated = await update<T>(resource, row.id, { [key]: value });
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function add() {
    try {
      const row = await create<T>(resource, blank);
      setRows((prev) => [...prev, row]);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function del(id: number) {
    if (!window.confirm('¿Borrar esta fila?')) return;
    await remove(resource, id);
    setRows((prev) => prev.filter((r) => r.id !== id));
  }
  function exportCsv() {
    downloadCsv(
      `${csvName ?? resource}.csv`,
      cols.map((c) => c.label),
      rows.map((r) =>
        cols.map((c) => (c.csv ? c.csv(r) : c.computed ? '' : ((r as Record<string, unknown>)[c.key] as string | number | null))),
      ),
    );
  }

  return (
    <>
      {error && <div className="alert bad">{error}</div>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key} className={c.computed || c.type === 'num' || c.type === 'pct' ? 'num' : ''}>{c.label}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={cols.length + 1} className="muted">Sin datos todavía.</td></tr>
            )}
            {rows.map((row) => (
              <tr key={row.id}>
                {cols.map((c) => {
                  const v = (row as Record<string, unknown>)[c.key];
                  if (c.computed) return <td key={c.key} className="num">{c.computed(row)}</td>;
                  if (c.type === 'bool')
                    return (
                      <td key={c.key}>
                        <input type="checkbox" aria-label={c.label} checked={!!v} onChange={(e) => save(row, c.key, e.target.checked)} />
                      </td>
                    );
                  if (c.type === 'select')
                    return (
                      <td key={c.key}>
                        <select aria-label={c.label} value={v == null ? '' : String(v)} onChange={(e) => save(row, c.key, e.target.value === '' ? null : e.target.value)}>
                          <option value="">—</option>
                          {c.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                    );
                  return (
                    <td key={c.key} className={c.type === 'num' || c.type === 'pct' ? 'num' : ''}>
                      <input
                        aria-label={c.label}
                        type={c.type === 'date' ? 'date' : 'text'}
                        inputMode={c.type === 'num' || c.type === 'pct' ? 'decimal' : undefined}
                        defaultValue={toInput(v, c.type)}
                        style={{ width: c.width ?? (c.type === 'num' || c.type === 'pct' ? 110 : 170), textAlign: c.type === 'num' || c.type === 'pct' ? 'right' : 'left' }}
                        onBlur={(e) => save(row, c.key, fromInput(e.target.value, c.type))}
                      />
                    </td>
                  );
                })}
                <td>
                  {extraActions?.(row)}
                  <button type="button" className="danger" aria-label="Borrar" onClick={() => del(row.id)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button type="button" className="shrink" onClick={add}>{addLabel ?? '+ Agregar'}</button>
        <button type="button" className="ghost shrink" onClick={exportCsv}>Exportar a Excel (CSV)</button>
      </div>
    </>
  );
}
