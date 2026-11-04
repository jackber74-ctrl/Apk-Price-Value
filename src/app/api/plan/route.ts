import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getPlan } from '@/lib/plan-server';

export async function GET() {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const { plan, row } = await getPlan(uid);
  return NextResponse.json({
    plan,
    lifetime: !!row?.plan_lifetime,
    period: row?.plan_period ?? null,
    expires: row?.plan_expires_at ?? null,
  });
}
