// Datos del responsable del tratamiento. Se llenan con variables de entorno en Vercel
// (Settings → Environment Variables) y se muestran en la política y los términos.
// Si falta alguno, el documento muestra un aviso para que no se publique incompleto.

export const TERMS_VERSION = '2026-11-04';
export const TERMS_UPDATED = '4 de noviembre de 2026';

const env = (key: string, fallback: string) => (process.env[key]?.trim() ? process.env[key]!.trim() : fallback);

export const LEGAL = {
  app: env('LEGAL_APP_NAME', 'Apk Price Value'),
  name: env('LEGAL_NAME', '[NOMBRE COMPLETO O RAZÓN SOCIAL]'),
  id: env('LEGAL_ID', '[CÉDULA O NIT]'),
  email: env('LEGAL_EMAIL', '[CORREO PARA SOLICITUDES]'),
  address: env('LEGAL_ADDRESS', '[DIRECCIÓN DE NOTIFICACIÓN]'),
  city: env('LEGAL_CITY', 'Medellín, Colombia'),
  phone: env('LEGAL_PHONE', '[TELÉFONO O WHATSAPP]'),
  site: env('APP_URL', '[DIRECCIÓN WEB DE LA APP]'),
};

/** Campos que todavía tienen el texto de ejemplo entre corchetes. */
export function missingLegalFields() {
  return Object.entries(LEGAL)
    .filter(([, v]) => v.startsWith('['))
    .map(([k]) => k);
}
