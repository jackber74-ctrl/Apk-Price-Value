import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { requireFeature } from '@/lib/plan-server';
import { seal } from '@/lib/secret-box';
import { loadSettings, publicSettings } from '@/lib/einvoice-server';

export async function GET() {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const denied = await requireFeature(uid, 'save');
  if (denied) return denied;
  return NextResponse.json({ settings: publicSettings(await loadSettings(uid)) });
}

/** Guarda la conexión. Las claves en blanco no cambian las que ya estaban. */
export async function PUT(req: Request) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const denied = await requireFeature(uid, 'save');
  if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  const old = await loadSettings(uid);
  const text = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);
  const secret = (v: unknown, prev: string | undefined) => (text(v, 500) ? seal(text(v, 500)) : (prev ?? ''));
  await query(
    `INSERT INTO einvoice_settings (user_id, provider, sandbox, client_id, client_secret, username, password, numbering_range_id, iva_responsable, updated_at)
     VALUES ($1, 'factus', $2, $3, $4, $5, $6, $7, $8, now())
     ON CONFLICT (user_id) DO UPDATE SET sandbox = $2, client_id = $3, client_secret = $4, username = $5, password = $6,
       numbering_range_id = $7, iva_responsable = $8, updated_at = now()`,
    [
      uid, b.sandbox !== false, text(b.client_id), secret(b.client_secret, old?.client_secret), text(b.username),
      secret(b.password, old?.password), text(b.numbering_range_id, 40), b.iva_responsable === true,
    ],
  );
  return NextResponse.json({ settings: publicSettings(await loadSettings(uid)) });
}
