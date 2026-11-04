// Lista blanca de tablas y columnas que la API genérica puede leer y escribir.
// Cada fila siempre pertenece al usuario que inició sesión (user_id).

import type { Feature } from './plans';

type ColType = 'text' | 'num' | 'numNull' | 'bool' | 'date' | 'ref' | 'json';

export type Resource = {
  table: string;
  cols: Record<string, ColType>;
  required: string[];
  refs?: Record<string, string>; // columna -> tabla a la que apunta
  order: string;
  /** Plan mínimo que necesita para leer y escribir este recurso. */
  feature?: Feature;
};

export const RESOURCES: Record<string, Resource> = {
  suppliers: {
    table: 'suppliers',
    feature: 'advanced',
    cols: { name: 'text', url: 'text', phone: 'text', city: 'text', notes: 'text' },
    required: ['name'],
    order: 'name',
  },
  supplies: {
    table: 'supplies',
    feature: 'save',
    cols: {
      name: 'text', category: 'text', supplier_id: 'ref', presentation: 'text', qty: 'num', unit: 'text',
      price: 'num', iva_pct: 'num', waste_pct: 'num', url: 'text', price_date: 'date',
    },
    required: ['name'],
    refs: { supplier_id: 'suppliers' },
    order: 'name',
  },
  supply_quotes: {
    table: 'supply_quotes',
    feature: 'search',
    cols: { supply_id: 'ref', supplier: 'text', price: 'num', qty: 'num', url: 'text', quote_date: 'date' },
    required: ['supply_id'],
    refs: { supply_id: 'supplies' },
    order: 'quote_date DESC',
  },
  fixed_costs: {
    table: 'fixed_costs',
    feature: 'save',
    cols: { name: 'text', category: 'text', amount: 'num', frequency: 'text', mandatory: 'bool' },
    required: ['name'],
    order: 'mandatory DESC, name',
  },
  workers: {
    table: 'workers',
    feature: 'advanced',
    cols: { name: 'text', contract: 'text', direct: 'bool', salary: 'num', arl_class: 'text', hours: 'numNull' },
    required: ['name'],
    order: 'name',
  },
  equipment: {
    table: 'equipment',
    feature: 'advanced',
    cols: {
      name: 'text', cost: 'num', life_years: 'num', residual: 'num', maint_year: 'num', charge: 'text', hours_month: 'num',
    },
    required: ['name'],
    order: 'name',
  },
  products: {
    table: 'products',
    feature: 'advanced',
    cols: {
      name: 'text', kind: 'text', category: 'text', units_month: 'num', other_var_cost: 'num', margin: 'numNull',
      commission: 'numNull', iva_pct: 'numNull', current_price: 'numNull', competitor_price: 'numNull',
    },
    required: ['name'],
    order: 'name',
  },
  recipe_items: {
    table: 'recipe_items',
    feature: 'advanced',
    cols: { product_id: 'ref', supply_id: 'ref', qty: 'num' },
    required: ['product_id', 'supply_id'],
    refs: { product_id: 'products', supply_id: 'supplies' },
    order: 'id',
  },
  process_steps: {
    table: 'process_steps',
    feature: 'advanced',
    cols: { product_id: 'ref', step: 'text', worker_id: 'ref', minutes: 'num', equipment_id: 'ref', equip_minutes: 'num' },
    required: ['product_id'],
    refs: { product_id: 'products', worker_id: 'workers', equipment_id: 'equipment' },
    order: 'id',
  },
  quotes: {
    table: 'quotes',
    feature: 'save',
    cols: { name: 'text', data: 'json', price: 'num' },
    required: ['name', 'data'],
    order: 'created_at DESC',
  },
  customers: {
    table: 'customers',
    feature: 'save',
    cols: { name: 'text', doc: 'text', email: 'text', phone: 'text', address: 'text', notes: 'text' },
    required: ['name'],
    order: 'name',
  },
  estimates: {
    table: 'estimates',
    feature: 'save',
    cols: {
      customer_id: 'ref', number: 'text', title: 'text', status: 'text', issue_date: 'date', valid_days: 'num',
      items: 'json', discount_pct: 'num', iva_pct: 'num', notes: 'text', total: 'num',
    },
    required: [],
    refs: { customer_id: 'customers' },
    order: 'created_at DESC',
  },
};

/** Convierte el cuerpo recibido en valores seguros según el tipo de cada columna. */
export function cleanRow(res: Resource, body: Record<string, unknown>, partial: boolean) {
  const out: Record<string, unknown> = {};
  for (const [col, type] of Object.entries(res.cols)) {
    if (!(col in body)) continue;
    const v = body[col];
    switch (type) {
      case 'text':
        out[col] = String(v ?? '').slice(0, 2000);
        break;
      case 'num': {
        const x = parseFloat(String(v));
        out[col] = Number.isFinite(x) ? x : 0;
        break;
      }
      case 'numNull': {
        const x = parseFloat(String(v));
        out[col] = v === '' || v == null || !Number.isFinite(x) ? null : x;
        break;
      }
      case 'bool':
        out[col] = v === true || v === 'true' || v === 1;
        break;
      case 'date':
        out[col] = /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? String(v).slice(0, 10) : new Date().toISOString().slice(0, 10);
        break;
      case 'ref': {
        const x = parseInt(String(v), 10);
        out[col] = Number.isFinite(x) ? x : null;
        break;
      }
      case 'json':
        out[col] = JSON.stringify(v ?? {});
        break;
    }
  }
  if (!partial) {
    for (const r of res.required) {
      if (out[r] == null || out[r] === '') throw new Error(`Falta el campo "${r}".`);
    }
  }
  return out;
}
