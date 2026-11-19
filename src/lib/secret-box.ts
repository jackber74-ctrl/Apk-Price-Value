// Cifra en la base de datos las claves que cada usuario pone de su proveedor de facturación.
// La llave sale de EINVOICE_KEY o, si no existe, de AUTH_SECRET. Si cambias esa variable, hay que volver a escribir las claves.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

function key() {
  const base = process.env.EINVOICE_KEY || process.env.AUTH_SECRET;
  if (!base || base.length < 32) throw new Error('Falta AUTH_SECRET (32+ caracteres) para guardar claves.');
  return createHash('sha256').update(`einvoice:${base}`).digest();
}

/** Devuelve "v1:<iv>:<tag>:<datos>" en base64url. Texto vacío se guarda vacío. */
export function seal(plain: string): string {
  if (!plain) return '';
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), data.toString('base64url')].join(':');
}

export function open(sealed: string): string {
  if (!sealed) return '';
  const [v, iv, tag, data] = sealed.split(':');
  if (v !== 'v1' || !iv || !tag || data == null) throw new Error('Clave guardada no válida.');
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8');
}
