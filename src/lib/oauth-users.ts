import { pool, query } from './db';
import { TERMS_VERSION } from './legal';
import type { Profile, ProviderId } from './oauth';

/**
 * Devuelve el id de usuario para una persona que entró con un proveedor externo.
 * 1. Si ya entró antes con ese proveedor, es la misma cuenta.
 * 2. Si el proveedor garantiza su correo (Google) y ya hay una cuenta con ese correo, se une a ella.
 *    Si esa cuenta se creó con contraseña y nunca se comprobó el correo, se quita la contraseña:
 *    así nadie puede quedarse con la cuenta de otra persona registrando su correo antes.
 * 3. En cualquier otro caso se crea una cuenta nueva.
 */
export async function resolveUser(provider: ProviderId, profile: Profile, retried = false): Promise<number> {
  const [known] = await query<{ user_id: number }>(
    'SELECT user_id FROM identities WHERE provider = $1 AND provider_user_id = $2',
    [provider, profile.id],
  );
  if (known) return known.user_id;

  const email = profile.email?.trim().toLowerCase() || null;
  const trustedEmail = email && profile.emailVerified ? email : null;

  if (trustedEmail) {
    const [existing] = await query<{ id: number; email_verified: boolean }>(
      'SELECT id, email_verified FROM users WHERE email = $1',
      [trustedEmail],
    );
    if (existing) {
      if (!existing.email_verified) {
        await query('UPDATE users SET email_verified = true, password_hash = NULL WHERE id = $1', [existing.id]);
      }
      await query(
        `INSERT INTO identities (user_id, provider, provider_user_id, email) VALUES ($1, $2, $3, $4)
         ON CONFLICT (provider, provider_user_id) DO NOTHING`,
        [existing.id, provider, profile.id, email],
      );
      return existing.id;
    }
  }

  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    const name = profile.name.trim().slice(0, 120);
    const created = await client.query(
      `INSERT INTO users (email, name, email_verified, accepted_terms_at, terms_version)
       VALUES ($1, $2, $3, now(), $4) RETURNING id`,
      [trustedEmail, name, !!trustedEmail, TERMS_VERSION],
    );
    const id = created.rows[0].id as number;
    await client.query('INSERT INTO settings (user_id, business_name) VALUES ($1, $2)', [id, name || 'Mi emprendimiento']);
    await client.query('INSERT INTO identities (user_id, provider, provider_user_id, email) VALUES ($1, $2, $3, $4)', [
      id,
      provider,
      profile.id,
      email,
    ]);
    await client.query('COMMIT');
    return id;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    // Dos entradas al mismo tiempo: la otra ya creó la cuenta, se vuelve a buscar una sola vez.
    if ((e as { code?: string }).code === '23505' && !retried) return resolveUser(provider, profile, true);
    throw e;
  } finally {
    client.release();
  }
}
