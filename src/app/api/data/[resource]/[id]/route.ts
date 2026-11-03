import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireUser, jsonError } from '@/lib/auth';
import { RESOURCES, cleanRow } from '@/lib/resources';
import { checkRefs } from '@/lib/refs';

type Ctx = { params: Promise<{ resource: string; id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const p = await ctx.params;
  const res = RESOURCES[p.resource];
  const id = parseInt(p.id, 10);
  if (!res || !Number.isFinite(id)) return jsonError('Recurso no válido.', 404);
  let row: Record<string, unknown>;
  try {
    row = cleanRow(res, await req.json(), true);
    await checkRefs(res, row, uid);
  } catch (e) {
    return jsonError((e as Error).message);
  }
  const cols = Object.keys(row);
  if (!cols.length) return jsonError('No hay cambios.');
  const sets = cols.map((c, i) => `${c} = $${i + 3}`).join(', ');
  const [updated] = await query(`UPDATE ${res.table} SET ${sets} WHERE id = $1 AND user_id = $2 RETURNING *`, [
    id,
    uid,
    ...cols.map((c) => row[c]),
  ]);
  if (!updated) return jsonError('No encontrado.', 404);
  return NextResponse.json({ row: updated });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const p = await ctx.params;
  const res = RESOURCES[p.resource];
  const id = parseInt(p.id, 10);
  if (!res || !Number.isFinite(id)) return jsonError('Recurso no válido.', 404);
  await query(`DELETE FROM ${res.table} WHERE id = $1 AND user_id = $2`, [id, uid]);
  return NextResponse.json({ ok: true });
}
