'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/client';

export default function AuthForm({ mode }: { mode: 'login' | 'registro' }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(mode === 'login' ? '/api/auth/login' : '/api/auth/register', {
        method: 'POST',
        body: { email, password, name },
      });
      const next = new URLSearchParams(window.location.search).get('next');
      window.location.href = next && next.startsWith('/app') ? next : '/app/calculadora';
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <Link href="/" className="brand">Apk <span>Price Value</span></Link>
      <div className="card" style={{ marginTop: 16 }}>
        <h1>{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h1>
        <p className="muted small">{mode === 'login' ? 'Entra con tu correo y contraseña.' : 'Tus datos quedan guardados en tu cuenta.'}</p>
        {error && <div className="alert bad">{error}</div>}
        <form onSubmit={submit}>
          {mode === 'registro' && (
            <div className="field">
              <label htmlFor="name">Nombre del negocio</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Moranta" />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Correo</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password" type="password" required minLength={8}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
            {mode === 'registro' && <p className="muted small" style={{ marginTop: 4 }}>Mínimo 8 caracteres.</p>}
          </div>
          <button type="submit" disabled={busy} style={{ width: '100%' }}>
            {busy ? 'Un momento…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>
        <p className="small" style={{ marginTop: 14, marginBottom: 0 }}>
          {mode === 'login' ? <>¿No tienes cuenta? <Link href="/registro">Créala aquí</Link></> : <>¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link></>}
        </p>
      </div>
    </main>
  );
}
