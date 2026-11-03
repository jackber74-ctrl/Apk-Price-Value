import { query } from './db';
import { RESOURCES, type Resource } from './resources';

/** Verifica que los ids relacionados (proveedor, insumo, producto...) sean del mismo usuario. */
export async function checkRefs(res: Resource, row: Record<string, unknown>, uid: number) {
  for (const [col, target] of Object.entries(res.refs ?? {})) {
    const v = row[col];
    if (v == null) continue;
    const table = RESOURCES[target].table;
    const found = await query(`SELECT 1 FROM ${table} WHERE id = $1 AND user_id = $2`, [v, uid]);
    if (!found.length) throw new Error(`Referencia no válida en "${col}".`);
  }
}
