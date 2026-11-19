import { NextResponse } from 'next/server';
import { query } from './db';
import { open } from './secret-box';
import { FactusError, type FactusCreds } from './factus';
import { jsonError } from './auth';

export type SettingsRow = {
  provider: string; sandbox: boolean; client_id: string; client_secret: string; username: string; password: string;
  numbering_range_id: string; iva_responsable: boolean;
};

export async function loadSettings(uid: number): Promise<SettingsRow | null> {
  const [row] = await query<SettingsRow>('SELECT * FROM einvoice_settings WHERE user_id = $1', [uid]);
  return row ?? null;
}

/** Lo que se le muestra al navegador: nunca las claves, solo si ya están puestas. */
export function publicSettings(s: SettingsRow | null) {
  return {
    provider: s?.provider ?? 'factus',
    sandbox: s?.sandbox ?? true,
    client_id: s?.client_id ?? '',
    username: s?.username ?? '',
    has_client_secret: !!s?.client_secret,
    has_password: !!s?.password,
    numbering_range_id: s?.numbering_range_id ?? '',
    iva_responsable: s?.iva_responsable ?? false,
    ready: !!(s && s.client_id && s.client_secret && s.username && s.password),
  };
}

/** Credenciales listas para llamar a Factus, o una respuesta de error. */
export async function credsFor(uid: number): Promise<{ s: SettingsRow; c: FactusCreds } | NextResponse> {
  const s = await loadSettings(uid);
  if (!s || !publicSettings(s).ready) return jsonError('Primero conecta tu proveedor de facturación en Mi cuenta → Facturación electrónica.', 409);
  return { s, c: { sandbox: s.sandbox, client_id: s.client_id, client_secret: open(s.client_secret), username: s.username, password: open(s.password) } };
}

export function providerError(e: unknown) {
  if (e instanceof FactusError) return jsonError(e.message, e.status >= 500 ? 502 : 400);
  const err = e as Error;
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return jsonError('Factus no respondió a tiempo. Intenta de nuevo en un momento.', 504);
  return jsonError(`No se pudo hablar con Factus: ${err?.message ?? 'error desconocido'}`, 502);
}
