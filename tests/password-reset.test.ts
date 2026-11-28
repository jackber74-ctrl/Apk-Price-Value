import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { hashToken, newToken, resetEmail, resetLink } from '../src/lib/password-reset';

describe('enlace de restablecimiento', () => {
  it('genera tokens largos y distintos, y guarda solo su hash', () => {
    const a = newToken();
    const b = newToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(a)).not.toContain(a);
  });

  it('arma el enlace con la dirección pública y escapa el HTML del correo', () => {
    const link = resetLink('https://app.co/', 'abc_-1');
    expect(link).toBe('https://app.co/restablecer?token=abc_-1');
    const mail = resetEmail(link, '<b>Ana</b>');
    expect(mail.text).toContain(link);
    expect(mail.html).toContain('&lt;b&gt;Ana&lt;/b&gt;');
    expect(mail.html).not.toContain('<b>Ana</b>');
  });
});

// Necesita una base de datos con el esquema aplicado (npm run db:migrate). Sin DATABASE_URL se omite.
const run = !!process.env.DATABASE_URL;
const email = `reset.t${Date.now()}${Math.floor(Math.random() * 1000)}@prueba.co`;

describe.skipIf(!run)('restablecer contraseña con la base de datos', () => {
  let query: typeof import('../src/lib/db').query;
  let pool: typeof import('../src/lib/db').pool;
  let lib: typeof import('../src/lib/password-reset');
  let userId: number;

  beforeAll(async () => {
    ({ query, pool } = await import('../src/lib/db'));
    lib = await import('../src/lib/password-reset');
    const [u] = await query<{ id: number }>(
      'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [email, 'Ana', await bcrypt.hash('vieja-clave', 4)],
    );
    userId = u.id;
  });
  afterAll(async () => {
    await query('DELETE FROM users WHERE email = $1', [email]);
    await pool().end();
  });

  it('no crea nada para un correo que no existe', async () => {
    expect(await lib.createReset('nadie.' + email)).toBeNull();
  });

  it('cambia la contraseña una sola vez con un enlace válido', async () => {
    const r = await lib.createReset(email);
    expect(r?.user.id).toBe(userId);
    const [row] = await query<any>('SELECT token_hash FROM password_resets WHERE user_id = $1', [userId]);
    expect(row.token_hash).toBe(lib.hashToken(r!.token));
    expect(await lib.checkReset(r!.token)).toBe(true);

    // Un segundo pedido inmediato no genera otro correo.
    expect(await lib.createReset(email)).toBeNull();

    expect(await lib.consumeReset(r!.token, 'nueva-clave-123')).toBe(userId);
    const [u] = await query<any>('SELECT password_hash, email_verified FROM users WHERE id = $1', [userId]);
    expect(await bcrypt.compare('nueva-clave-123', u.password_hash)).toBe(true);
    expect(u.email_verified).toBe(true);

    expect(await lib.checkReset(r!.token)).toBe(false);
    expect(await lib.consumeReset(r!.token, 'otra-clave-456')).toBeNull();
  });

  it('rechaza enlaces vencidos o inventados', async () => {
    const token = lib.newToken();
    await query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, now() - interval '1 minute')`,
      [userId, lib.hashToken(token)],
    );
    expect(await lib.checkReset(token)).toBe(false);
    expect(await lib.consumeReset(token, 'otra-clave-456')).toBeNull();
    expect(await lib.consumeReset('inventado', 'otra-clave-456')).toBeNull();
    expect(await lib.checkReset('')).toBe(false);
  });
});
