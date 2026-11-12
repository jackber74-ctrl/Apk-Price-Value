// Envío de correos con Resend (https://resend.com) por su API HTTP, sin dependencias extra.
// Si no hay RESEND_API_KEY, en desarrollo el correo se muestra en la consola y en producción no se envía.

export type Mail = { to: string; subject: string; html: string; text: string };

export function mailConfigured() {
  return !!process.env.RESEND_API_KEY?.trim();
}

export function mailFrom() {
  return process.env.MAIL_FROM?.trim() || 'Apk Price Value <onboarding@resend.dev>';
}

/** Devuelve true si el correo salió (o se mostró en consola en desarrollo). */
export async function sendMail(mail: Mail): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[correo] Para: ${mail.to}\nAsunto: ${mail.subject}\n\n${mail.text}`);
      return true;
    }
    console.error('[correo] Falta RESEND_API_KEY: no se pudo enviar el correo a', mail.to);
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: mailFrom(), to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }),
    });
    if (!res.ok) {
      console.error('[correo] Resend respondió', res.status, (await res.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[correo] Error al enviar:', err);
    return false;
  }
}
