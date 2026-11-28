// Restablecer la contraseña con un enlace de un solo uso que llega al correo.
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool, query } from './db';

export const RESET_TTL_MINUTES = 60;
/** Tiempo mínimo entre dos correos de restablecimiento para la misma cuenta. */
export const RESET_COOLDOWN_SECONDS = 60;

export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export function newToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function resetLink(base: string, token: string) {
  return `${base.replace(/\/+$/, '')}/restablecer?token=${encodeURIComponent(token)}`;
}

export function resetEmail(link: string, name?: string | null) {
  const hello = name ? `Hola, ${name}:` : 'Hola:';
  const text = [
    hello,
    '',
    'Recibimos una solicitud para restablecer la contraseña de tu cuenta en Apk Price Value.',
    `Abre este enlace para crear una nueva (vence en ${RESET_TTL_MINUTES} minutos y sirve una sola vez):`,
    link,
    '',
    'Si no la pediste, ignora este correo: tu contraseña no cambia.',
  ].join('\n');
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#222">
<p>${esc(hello)}</p>
<p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en <b>Apk Price Value</b>.</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Crear nueva contraseña</a></p>
<p style="color:#666;font-size:13px">El enlace vence en ${RESET_TTL_MINUTES} minutos y sirve una sola vez. Si el botón no funciona, copia esta dirección:<br>${esc(link)}</p>
<p style="color:#666;font-size:13px">Si no la pediste, ignora este correo: tu contraseña no cambia.</p>
</div>`;
  return { subject: 'Restablece tu contraseña', text, html };
}

type ResetUser = { id: number; name: string | null };

/**
 * Crea un token para el correo dado. Devuelve null si no hay cuenta con ese correo
 * o si se pidió otro hace menos de RESET_COOLDOWN_SECONDS (para no llenar el buzón).
 */
export async function createReset(email: string): Promise<{ token: string; user: ResetUser } | null> {
  const [user] = await query<ResetUser>('SELECT id, name FROM users WHERE email = $1', [email]);
  if (!user) return null;
  const recent = await query(
    `SELECT 1 FROM password_resets WHERE user_id = $1 AND created_at > now() - make_interval(secs => $2)`,
    [user.id, RESET_COOLDOWN_SECONDS],
  );
  if (recent.length) return null;
  const token = newToken();
  await query(
    `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, now() + make_interval(mins => $3))`,
    [user.id, hashToken(token), RESET_TTL_MINUTES],
  );
  return { token, user };
}

/** ¿El token existe, no venció y no se ha usado? */
export async function checkReset(token: string) {
  if (!token) return false;
  const rows = await query(
    'SELECT 1 FROM password_resets WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()',
    [hashToken(token)],
  );
  return rows.length > 0;
}

/**
 * Cambia la contraseña si el token es válido y lo marca como usado (junto con los demás
 * enlaces pendientes de la cuenta). Devuelve el id del usuario o null si el enlace no sirve.
 */
export async function consumeReset(token: string, password: string): Promise<number | null> {
  if (!token) return null;
  const hash = await bcrypt.hash(password, 10);
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ user_id: number }>(
      `UPDATE password_resets SET used_at = now()
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
        RETURNING user_id`,
      [hashToken(token)],
    );
    const userId = rows[0]?.user_id;
    if (!userId) {
      await client.query('ROLLBACK');
      return null;
    }
    // Quien recibe el correo demuestra que es dueño de la dirección, así que la marcamos verificada.
    await client.query('UPDATE users SET password_hash = $1, email_verified = true WHERE id = $2', [hash, userId]);
    await client.query('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [userId]);
    await client.query('COMMIT');
    return userId;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
