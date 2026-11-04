import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Necesita una base de datos con el esquema aplicado (npm run db:migrate). Sin DATABASE_URL se omite.
const run = !!process.env.DATABASE_URL;
const tag = `t${Date.now()}${Math.floor(Math.random() * 1000)}`;
const mail = (n: string) => `${n}.${tag}@prueba.co`;

describe.skipIf(!run)('unir o crear cuentas con proveedores externos', () => {
  let query: typeof import('../src/lib/db').query;
  let pool: typeof import('../src/lib/db').pool;
  let resolveUser: typeof import('../src/lib/oauth-users').resolveUser;

  beforeAll(async () => {
    ({ query, pool } = await import('../src/lib/db'));
    ({ resolveUser } = await import('../src/lib/oauth-users'));
  });
  afterAll(async () => {
    await query('DELETE FROM users WHERE email LIKE $1 OR id IN (SELECT user_id FROM identities WHERE provider_user_id LIKE $2)', [`%.${tag}@prueba.co`, `${tag}%`]);
    await pool().end();
  });

  it('crea la cuenta la primera vez y la reutiliza después', async () => {
    const profile = { id: `${tag}-g1`, name: 'Ana', email: mail('ana'), emailVerified: true };
    const a = await resolveUser('google', profile);
    expect(await resolveUser('google', profile)).toBe(a);
    const [u] = await query<any>('SELECT email, email_verified, password_hash, accepted_terms_at, terms_version FROM users WHERE id = $1', [a]);
    expect(u.email).toBe(mail('ana'));
    expect(u.email_verified).toBe(true);
    expect(u.password_hash).toBeNull();
    expect(u.accepted_terms_at).not.toBeNull();
    expect(u.terms_version).toBeTruthy();
    expect((await query('SELECT 1 FROM settings WHERE user_id = $1', [a])).length).toBe(1);
  });

  it('Google une la cuenta con contraseña sin verificar y le quita la contraseña', async () => {
    const [pre] = await query<any>(
      "INSERT INTO users (email, name, password_hash) VALUES ($1, 'Squatter', 'hash-de-prueba') RETURNING id",
      [mail('victima')],
    );
    const id = await resolveUser('google', { id: `${tag}-g2`, name: 'Victima', email: mail('victima'), emailVerified: true });
    expect(id).toBe(pre.id);
    const [u] = await query<any>('SELECT password_hash, email_verified FROM users WHERE id = $1', [id]);
    expect(u.password_hash).toBeNull();
    expect(u.email_verified).toBe(true);
  });

  it('Facebook nunca se une por correo: crea una cuenta aparte sin correo', async () => {
    const [existing] = await query<any>("INSERT INTO users (email, name, password_hash) VALUES ($1, 'Dueña', 'hash') RETURNING id", [mail('duena')]);
    const id = await resolveUser('facebook', { id: `${tag}-f1`, name: 'Otro', email: mail('duena'), emailVerified: false });
    expect(id).not.toBe(existing.id);
    const [u] = await query<any>('SELECT email FROM users WHERE id = $1', [id]);
    expect(u.email).toBeNull();
    const [still] = await query<any>('SELECT password_hash FROM users WHERE id = $1', [existing.id]);
    expect(still.password_hash).toBe('hash');
  });

  it('TikTok crea una cuenta sin correo', async () => {
    const id = await resolveUser('tiktok', { id: `${tag}-t1`, name: 'Tiktoker', email: null, emailVerified: false });
    const [u] = await query<any>('SELECT email, name FROM users WHERE id = $1', [id]);
    expect(u.email).toBeNull();
    expect(u.name).toBe('Tiktoker');
  });

  it('dos entradas simultáneas de la misma persona dan una sola cuenta', async () => {
    const profile = { id: `${tag}-g3`, name: 'Doble', email: mail('doble'), emailVerified: true };
    const [a, b] = await Promise.all([resolveUser('google', profile), resolveUser('google', profile)]);
    expect(a).toBe(b);
    expect((await query('SELECT 1 FROM users WHERE email = $1', [mail('doble')])).length).toBe(1);
  });
});
