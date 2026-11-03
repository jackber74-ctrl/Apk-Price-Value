const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export const money = (v: number) => (Number.isFinite(v) ? cop.format(v) : '—');
export const pct = (v: number, digits = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(digits).replace('.', ',')} %` : '—');

/** Lee precios como "$ 43.500", "COP 1.250.000,50" o "43500". */
export function parseCop(text: unknown): number | null {
  if (text == null) return null;
  let s = String(text).replace(/[^\d.,]/g, '');
  if (!s) return null;
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/[.,]/g, '');
  const x = parseFloat(s);
  return Number.isFinite(x) ? x : null;
}
