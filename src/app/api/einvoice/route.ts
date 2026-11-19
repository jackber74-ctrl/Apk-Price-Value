import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireUser, jsonError } from '@/lib/auth';
import { requireFeature } from '@/lib/plan-server';
import { credsFor, providerError } from '@/lib/einvoice-server';
import { validateBill } from '@/lib/factus';
import { buildFactusBill, buyerProblems, invoiceTotals, optionProblems, referenceCode, type Buyer, type IssueOptions } from '@/lib/einvoice';
import type { EstimateItem } from '@/lib/estimate';

const COLS = 'id, estimate_id, customer_id, provider, sandbox, status, number, cufe, qr_url, public_url, total, error, created_at';

/** Facturas emitidas (y los intentos fallidos) del usuario. */
export async function GET() {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const denied = await requireFeature(uid, 'save');
  if (denied) return denied;
  const rows = await query(`SELECT ${COLS} FROM invoices WHERE user_id = $1 ORDER BY created_at DESC`, [uid]);
  return NextResponse.json({ rows });
}

type Est = { id: number; customer_id: number | null; number: string; items: EstimateItem[]; discount_pct: number; iva_pct: number; notes: string };

/** Emite la factura electrónica de una cotización guardada. */
export async function POST(req: Request) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const denied = await requireFeature(uid, 'save');
  if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  const opts: IssueOptions = {
    payment_form: b.payment_form === '2' ? '2' : '1',
    payment_method: String(b.payment_method ?? '10'),
    due_date: b.due_date ? String(b.due_date).slice(0, 10) : undefined,
  };

  const [est] = await query<Est>('SELECT * FROM estimates WHERE id = $1 AND user_id = $2', [Number(b.estimate_id), uid]);
  if (!est) return jsonError('Guarda la cotización antes de facturarla.', 404);
  const [buyer] = est.customer_id
    ? await query<Buyer & { id: number }>('SELECT * FROM customers WHERE id = $1 AND user_id = $2', [est.customer_id, uid])
    : [];
  const r = await credsFor(uid);
  if (r instanceof NextResponse) return r;
  const { s, c } = r;

  const problems = [...buyerProblems(buyer), ...optionProblems(opts)];
  if (!s.numbering_range_id) problems.push('Resolución de numeración (en Mi cuenta → Facturación electrónica)');
  const totals = invoiceTotals(est, s);
  if (!est.items.some((i) => Number(i.qty) > 0 && String(i.name ?? '').trim())) problems.push('Al menos una línea con concepto y cantidad');
  if (totals.total <= 0) problems.push('Un total mayor a cero');
  if (!s.iva_responsable && Number(est.iva_pct) > 0) {
    problems.push('Quitar el IVA de la cotización: en tu configuración no eres responsable de IVA');
  }
  if (problems.length) return NextResponse.json({ error: `Falta: ${problems.join('; ')}.`, problems }, { status: 400 });

  if (!s.sandbox) {
    const [done] = await query(`SELECT ${COLS} FROM invoices WHERE estimate_id = $1 AND user_id = $2 AND NOT sandbox AND status = 'issued'`, [est.id, uid]);
    if (done) return NextResponse.json({ error: 'Esta cotización ya tiene factura electrónica.', invoice: done }, { status: 409 });
  }

  let inv: { id: number };
  try {
    [inv] = await query<{ id: number }>(
      `INSERT INTO invoices (user_id, estimate_id, customer_id, provider, sandbox, status, total) VALUES ($1, $2, $3, 'factus', $4, 'pending', $5) RETURNING id`,
      [uid, est.id, buyer.id, s.sandbox, totals.total],
    );
  } catch (e) {
    if ((e as { code?: string }).code === '23505') return jsonError('Esta cotización ya se está facturando. Espera un momento y recarga.', 409);
    throw e;
  }

  const payload = buildFactusBill(est, buyer, s, opts, referenceCode(est.id, inv.id, s.sandbox));
  try {
    const bill = await validateBill(c, payload);
    const [row] = await query(
      `UPDATE invoices SET status = 'issued', number = $2, cufe = $3, qr_url = $4, public_url = $5, request = $6, response = $7, error = ''
       WHERE id = $1 RETURNING ${COLS}`,
      [inv.id, bill.number, bill.cufe, bill.qr_url, bill.public_url, JSON.stringify(payload), JSON.stringify(bill.raw)],
    );
    if (!s.sandbox) await query(`UPDATE estimates SET status = 'Facturada' WHERE id = $1 AND user_id = $2`, [est.id, uid]);
    return NextResponse.json({ invoice: row }, { status: 201 });
  } catch (e) {
    const resp = providerError(e);
    const msg = ((await resp.clone().json()) as { error: string }).error;
    await query(`UPDATE invoices SET status = 'error', request = $2, error = $3 WHERE id = $1`, [inv.id, JSON.stringify(payload), msg.slice(0, 2000)]);
    return resp;
  }
}
