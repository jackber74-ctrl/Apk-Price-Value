// Cliente de la API de Factus (proveedor tecnológico autorizado por la DIAN).
// Pruebas: https://api-sandbox.factus.com.co · Producción: https://api.factus.com.co
// Cada usuario usa sus propias credenciales (las crea en su cuenta de Factus).

export type FactusCreds = { sandbox: boolean; client_id: string; client_secret: string; username: string; password: string };

export const factusBase = (sandbox: boolean) =>
  process.env.FACTUS_BASE_URL || (sandbox ? 'https://api-sandbox.factus.com.co' : 'https://api.factus.com.co');

const tokens = new Map<string, { token: string; until: number }>();

export class FactusError extends Error {
  constructor(message: string, public status: number, public body: unknown) {
    super(message);
  }
}

/** Convierte la respuesta de error de Factus en un texto que se entienda. */
export function factusErrorText(body: any, status: number): string {
  const parts: string[] = [];
  if (body?.message) parts.push(String(body.message));
  const errs = body?.data?.errors ?? body?.errors;
  if (errs && typeof errs === 'object') {
    for (const [k, v] of Object.entries(errs)) parts.push(`${k}: ${Array.isArray(v) ? v.join(' ') : String(v)}`);
  }
  if (body?.error_description) parts.push(String(body.error_description));
  return parts.length ? parts.join(' · ') : `Factus respondió ${status}.`;
}

async function token(c: FactusCreds): Promise<string> {
  const k = `${c.sandbox}|${c.client_id}|${c.username}`;
  const hit = tokens.get(k);
  if (hit && hit.until > Date.now()) return hit.token;
  const res = await fetch(`${factusBase(c.sandbox)}/oauth/token`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password', client_id: c.client_id, client_secret: c.client_secret, username: c.username, password: c.password,
    }),
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new FactusError(`No se pudo entrar a Factus: ${factusErrorText(body, res.status)} Revisa las credenciales en Mi cuenta.`, res.status, body);
  }
  tokens.set(k, { token: body.access_token, until: Date.now() + Math.max(Number(body.expires_in) || 600, 120) * 1000 - 60_000 });
  return body.access_token;
}

async function call<T = any>(c: FactusCreds, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${factusBase(c.sandbox)}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${await token(c)}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(45_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new FactusError(factusErrorText(body, res.status), res.status, body);
  return body as T;
}

const rows = (d: any): any[] => (Array.isArray(d?.data?.data) ? d.data.data : Array.isArray(d?.data) ? d.data : []);

/** Crea la factura y la envía a la DIAN. Devuelve lo esencial y la respuesta completa. */
export async function validateBill(c: FactusCreds, payload: unknown) {
  const body = await call(c, '/v1/bills/validate', { method: 'POST', body: payload });
  const bill = body?.data?.bill ?? body?.data ?? {};
  return {
    number: String(bill.number ?? ''),
    cufe: String(bill.cufe ?? ''),
    qr_url: String(bill.qr ?? ''),
    public_url: String(bill.public_url ?? ''),
    raw: body,
  };
}

/** Rangos de numeración activos para factura de venta (la resolución DIAN que se cargó en Factus). */
export async function numberingRanges(c: FactusCreds) {
  const body = await call(c, '/v1/numbering-ranges?filter[document]=21&filter[is_active]=1');
  return rows(body).map((r) => ({
    id: String(r.id),
    label: [r.prefix, r.document, r.resolution_number && `Resolución ${r.resolution_number}`, r.from && r.to && `${r.from}–${r.to}`]
      .filter(Boolean)
      .join(' · '),
  }));
}

export async function municipalities(c: FactusCreds, name: string) {
  const body = await call(c, `/v1/municipalities?name=${encodeURIComponent(name)}`);
  return rows(body).slice(0, 30).map((m) => ({ id: String(m.id), name: `${m.name}${m.department ? `, ${m.department}` : ''}` }));
}

export async function billPdf(c: FactusCreds, number: string) {
  const body = await call(c, `/v1/bills/download-pdf/${encodeURIComponent(number)}`);
  const b64 = body?.data?.pdf_base_64_encoded;
  if (!b64) throw new FactusError('Factus no devolvió el PDF.', 502, body);
  return { name: String(body.data.file_name || number), pdf: Buffer.from(b64, 'base64') };
}
