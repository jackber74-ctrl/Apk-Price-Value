import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/auth';
import { baseUrl } from '@/lib/oauth';
import { sendMail } from '@/lib/mailer';
import { createReset, resetEmail, resetLink } from '@/lib/password-reset';

// Siempre responde lo mismo, exista o no la cuenta, para no revelar qué correos están registrados.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError('Escribe un correo válido.');
  const reset = await createReset(email);
  if (reset) {
    const mail = resetEmail(resetLink(baseUrl(req), reset.token), reset.user.name);
    await sendMail({ to: email, ...mail });
  }
  return NextResponse.json({ ok: true });
}
