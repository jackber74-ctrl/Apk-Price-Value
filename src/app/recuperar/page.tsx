'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/client';

export default function RecuperarPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/forgot', { method: 'POST', body: { email } });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <Link href="/" className="brand">Apk <span>Price Value</span></Link>
      <div className="card" style={{ marginTop: 16 }}>
        <h1>Recuperar contraseña</h1>
        {sent ? (
          <div className="alert ok">
            Si hay una cuenta con <b>{email}</b>, te enviamos un enlace para crear una nueva contraseña. Revisa también la carpeta de spam. El enlace vence en una hora.
          </div>
        ) : (
          <>
            <p className="muted small">Escribe el correo de tu cuenta y te enviamos un enlace para crear una nueva contraseña.</p>
            {error && <div className="alert bad">{error}</div>}
            <form onSubmit={submit}>
              <div className="field">
                <label htmlFor="email">Correo</label>
                <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <button type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? 'Un momento…' : 'Enviar enlace'}</button>
            </form>
          </>
        )}
        <p className="small" style={{ marginTop: 14, marginBottom: 0 }}>
          <Link href="/login">Volver a iniciar sesión</Link>
        </p>
      </div>
    </main>
  );
}
