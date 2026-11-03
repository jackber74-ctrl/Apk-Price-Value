import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireUser, jsonError } from '@/lib/auth';
import { RESOURCES, cleanRow } from '@/lib/resources';
import { checkRefs } from '@/lib/refs';

type Ctx = { params: Promise<{ resource: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const res = RESOURCES[(await ctx.params).resource];
  if (!res) return jsonError('Recurso no válido.', 404);
  const rows = await query(`SELECT * FROM ${res.table} WHERE user_id = $1 ORDER BY ${res.order}`, [uid]);
  return NextResponse.json({ rows });
}

export async function POST(req: Request, ctx: Ctx) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const res = RESOURCES[(await ctx.params).resource];
  if (!res) return jsonError('Recurso no válido.', 404);
  let row: Record<string, unknown>;
  try {
    row = cleanRow(res, await req.json(), false);
    await checkRefs(res, row, uid);
  } catch (e) {
    return jsonError((e as Error).message);
  }
  const cols = Object.keys(row);
  const sql = `INSERT INTO ${res.table} (user_id${cols.map((c) => `, ${c}`).join('')})
    VALUES ($1${cols.map((_, i) => `, $${i + 2}`).join('')}) RETURNING *`;
  const [created] = await query(sql, [uid, ...cols.map((c) => row[c])]);
  return NextResponse.json({ row: created }, { status: 201 });
}
