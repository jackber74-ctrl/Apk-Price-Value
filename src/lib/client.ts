'use client';
// Llamadas a la API desde el navegador.

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? 'GET',
    headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/api/auth')) {
    window.location.href = '/login';
  }
  if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
  return data as T;
}

export const list = <T = any>(resource: string) => api<{ rows: T[] }>(`/api/data/${resource}`).then((d) => d.rows);
export const create = <T = any>(resource: string, body: unknown) =>
  api<{ row: T }>(`/api/data/${resource}`, { method: 'POST', body }).then((d) => d.row);
export const update = <T = any>(resource: string, id: number, body: unknown) =>
  api<{ row: T }>(`/api/data/${resource}/${id}`, { method: 'PUT', body }).then((d) => d.row);
export const remove = (resource: string, id: number) => api(`/api/data/${resource}/${id}`, { method: 'DELETE' });

/** Descarga filas como CSV (se abre en Excel). */
export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + [headers, ...rows].map((r) => r.map(esc).join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
