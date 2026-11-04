import Link from 'next/link';
import { TERMS_UPDATED, TERMS_VERSION, missingLegalFields } from '@/lib/legal';

export default function LegalDoc({ title, children }: { title: string; children: React.ReactNode }) {
  const missing = missingLegalFields();
  return (
    <main className="shell legal">
      <Link href="/" className="brand">Apk <span>Price Value</span></Link>
      <h1 style={{ marginTop: 16 }}>{title}</h1>
      <p className="muted small">Versión {TERMS_VERSION} · Última actualización: {TERMS_UPDATED}</p>
      {missing.length > 0 && (
        <div className="alert">
          Borrador: faltan datos del responsable ({missing.join(', ')}). Complétalos con las variables LEGAL_* en Vercel antes de
          publicar este documento.
        </div>
      )}
      <article className="card">{children}</article>
    </main>
  );
}
