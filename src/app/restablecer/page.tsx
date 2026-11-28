'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';

export default function RestablecerPage() {
  const [token, setToken] = useState('');
  const [valid, setValid] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token') ?? '';
    setToken(t);
    if (!t) return setValid(false);
    api<{ valid: boolean }>(`/api/auth/reset?token=${encodeURIComponent(t)}`)
      .then((d) => setValid(d.valid))
      .catch(() => setValid(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError('Las dos contraseñas no coinciden.');
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/reset', { method: 'POST', body: { token, password } });
      window.location.href = '/app/calculadora';
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <Link href="/" className="brand">Apk <span>Price Value</span></Link>
      <div className="card" style={{ marginTop: 16 }}>
        <h1>Nueva contraseña</h1>
        {valid === null && <p className="muted small">Revisando el enlace…</p>}
        {valid === false && (
          <>
            <div className="alert bad">El enlace venció o ya se usó. Pide uno nuevo.</div>
            <Link className="btn" href="/recuperar">Pedir otro enlace</Link>
          </>
        )}
        {valid && (
          <form onSubmit={submit}>
            {error && <div className="alert bad">{error}</div>}
            <div className="field">
              <label htmlFor="password">Nueva contraseña</label>
              <input id="password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className="muted small" style={{ marginTop: 4 }}>Mínimo 8 caracteres.</p>
            </div>
            <div className="field">
              <label htmlFor="confirm">Repítela</label>
              <input id="confirm" type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <button type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? 'Un momento…' : 'Guardar y entrar'}</button>
          </form>
        )}
      </div>
    </main>
  );
}
