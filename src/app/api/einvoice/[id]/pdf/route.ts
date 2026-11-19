import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireUser, jsonError } from '@/lib/auth';
import { requireFeature } from '@/lib/plan-server';
import { credsFor, providerError } from '@/lib/einvoice-server';
import { billPdf } from '@/lib/factus';

type Ctx = { params: Promise<{ id: string }> };

/** Descarga la representación gráfica (PDF con CUFE y QR) que genera Factus. */
export async function GET(_req: Request, ctx: Ctx) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const denied = await requireFeature(uid, 'save');
  if (denied) return denied;
  const id = parseInt((await ctx.params).id, 10);
  const [inv] = await query<{ number: string; status: string }>('SELECT number, status FROM invoices WHERE id = $1 AND user_id = $2', [id, uid]);
  if (!inv || inv.status !== 'issued' || !inv.number) return jsonError('Factura no encontrada.', 404);
  const r = await credsFor(uid);
  if (r instanceof NextResponse) return r;
  try {
    const { name, pdf } = await billPdf(r.c, inv.number);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${name.replace(/[^\w.-]/g, '_').replace(/\.pdf$/i, '')}.pdf"`,
      },
    });
  } catch (e) {
    return providerError(e);
  }
}
