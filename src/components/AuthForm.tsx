'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';

type Provider = { id: string; label: string; callback?: string };

const ERRORS: Record<string, string> = {
  cancelled: 'Cancelaste el inicio de sesión. Puedes intentarlo de nuevo.',
  state: 'La sesión de inicio expiró. Intenta de nuevo.',
  failed: 'No pudimos completar el inicio de sesión. Intenta de nuevo o usa otro método.',
  provider: 'Ese método de acceso no está disponible.',
};

export default function AuthForm({ mode }: { mode: 'login' | 'registro' }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [next, setNext] = useState('');
  const [why, setWhy] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('error');
    if (code) setError(ERRORS[code] ?? ERRORS.failed);
    setWhy(params.get('why') ?? '');
    const n = params.get('next');
    if (n && n.startsWith('/app')) setNext(n);
    api<{ providers: Provider[] }>('/api/auth/providers')
      .then((d) => setProviders(d.providers))
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(mode === 'login' ? '/api/auth/login' : '/api/auth/register', {
        method: 'POST',
        body: { email, password, name, accept },
      });
      window.location.href = next || '/app/calculadora';
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const socialHref = (id: string) => `/api/auth/oauth/${id}/start${next ? `?next=${encodeURIComponent(next)}` : ''}`;
  const legalLinks = (
    <>
      los <Link href="/terminos" target="_blank">Términos y condiciones</Link> y la{' '}
      <Link href="/privacidad" target="_blank">Política de privacidad</Link>
    </>
  );

  return (
    <main className="auth">
      <Link href="/" className="brand">Apk <span>Price Value</span></Link>
      <div className="card" style={{ marginTop: 16 }}>
        <h1>{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h1>
        <p className="muted small">{mode === 'login' ? 'Entra con tu correo y contraseña.' : 'Tus datos quedan guardados en tu cuenta.'}</p>
        {error && (
          <div className="alert bad">
            {error}
            {why && <div className="small" style={{ marginTop: 6 }}>Detalle técnico: <code>{why}</code></div>}
            {why && providers[0]?.callback && (
              <div className="small" style={{ marginTop: 6 }}>Dirección de retorno que usa la app: <code>{providers[0].callback}</code></div>
            )}
          </div>
        )}

        {providers.length > 0 && (
          <>
            <div className="social">
              {providers.map((p) => (
                <a key={p.id} className="btn" href={socialHref(p.id)}>Continuar con {p.label}</a>
              ))}
            </div>
            <p className="muted small" style={{ margin: '8px 0 0' }}>
              Al continuar con uno de estos métodos aceptas {legalLinks} y autorizas el tratamiento de tus datos personales (Ley 1581 de 2012).
            </p>
            <div className="divider">o con tu correo</div>
          </>
        )}

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
            {mode === 'login' && (
              <p className="small" style={{ marginTop: 4, marginBottom: 0 }}><Link href="/recuperar">¿Olvidaste tu contraseña?</Link></p>
            )}
          </div>
          {mode === 'registro' && (
            <label className="consent" htmlFor="accept">
              <input id="accept" type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} required />
              <span>
                Acepto {legalLinks}, y autorizo de forma previa, expresa e informada el tratamiento de mis datos personales conforme a la Ley 1581 de 2012.
              </span>
            </label>
          )}
          <button type="submit" disabled={busy || (mode === 'registro' && !accept)} style={{ width: '100%' }}>
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
