import { NextResponse } from 'next/server';
import { PROVIDERS, enabledProviders } from '@/lib/oauth';

export async function GET() {
  return NextResponse.json({ providers: enabledProviders().map((id) => ({ id, label: PROVIDERS[id].label })) });
}
