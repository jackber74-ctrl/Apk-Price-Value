import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { DEFAULT_SETTINGS, type Settings } from '@/lib/pricing';

const KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];

function normalize(row: Record<string, unknown> | undefined): Settings {
  const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  if (!row) return out as Settings;
  for (const k of KEYS) {
    const d = DEFAULT_SETTINGS[k];
    const v = row[k];
    if (v == null || v === '') continue;
    if (typeof d === 'number') {
      const x = Number(v);
      if (Number.isFinite(x)) out[k] = x;
    } else if (typeof d === 'boolean') out[k] = v === true || v === 'true';
    else out[k] = String(v).slice(0, 200);
  }
  return out as Settings;
}

export async function GET() {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const [row] = await query('SELECT * FROM settings WHERE user_id = $1', [uid]);
  return NextResponse.json({ settings: normalize(row) });
}

export async function PUT(req: Request) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const s = normalize(await req.json().catch(() => ({})));
  if (s.fixed_method !== 'unidad' && s.fixed_method !== 'minuto') s.fixed_method = 'unidad';
  const cols = KEYS.join(', ');
  const vals = KEYS.map((_, i) => `$${i + 2}`).join(', ');
  const updates = KEYS.map((k) => `${k} = EXCLUDED.${k}`).join(', ');
  await query(
    `INSERT INTO settings (user_id, ${cols}) VALUES ($1, ${vals}) ON CONFLICT (user_id) DO UPDATE SET ${updates}`,
    [uid, ...KEYS.map((k) => s[k])],
  );
  return NextResponse.json({ settings: s });
}
