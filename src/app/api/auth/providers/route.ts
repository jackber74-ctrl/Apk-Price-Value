import { NextResponse } from 'next/server';
import { PROVIDERS, callbackUrl, enabledProviders } from '@/lib/oauth';

export async function GET(req: Request) {
  return NextResponse.json({
    providers: enabledProviders().map((id) => ({ id, label: PROVIDERS[id].label, callback: callbackUrl(req, id) })),
  });
}
