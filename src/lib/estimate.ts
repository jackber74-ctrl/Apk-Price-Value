// Cuentas de una cotización: líneas, descuento e IVA.

export type EstimateItem = {
  id: string;
  name: string;
  desc: string;
  kind: 'Producto' | 'Servicio';
  qty: number;
  price: number; // precio por unidad
  quote_id?: number | null; // cálculo guardado del que salió
};

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export function estimateTotals(items: EstimateItem[], discountPct: number, ivaPct: number) {
  const subtotal = items.reduce((a, i) => a + n(i.qty) * n(i.price), 0);
  const discount = subtotal * (Math.min(Math.max(n(discountPct), 0), 100) / 100);
  const base = subtotal - discount;
  const iva = base * (Math.max(n(ivaPct), 0) / 100);
  return { subtotal, discount, base, iva, total: base + iva };
}

/** Siguiente consecutivo tipo COT-0007 a partir de los que ya existen. */
export function nextNumber(existing: string[]) {
  const max = existing.reduce((m, s) => {
    const x = /(\d+)\s*$/.exec(s ?? '');
    return x ? Math.max(m, parseInt(x[1], 10)) : m;
  }, 0);
  return `COT-${String(max + 1).padStart(4, '0')}`;
}

export const STATUSES = ['Borrador', 'Enviada', 'Aprobada', 'Rechazada'] as const;
