'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';

type Account = {
  user: { email: string | null; name: string; created_at: string; accepted_terms_at: string | null; terms_version: string | null; has_password: boolean };
  providers: string[];
};
const LABEL: Record<string, string> = { google: 'Google', facebook: 'Facebook', tiktok: 'TikTok' };

export default function Cuenta() {
  const [acc, setAcc] = useState<Account | null>(null);
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api<Account>('/api/account').then(setAcc).catch((e) => setMsg(e.message));
  }, []);

  async function remove() {
    try {
      await api('/api/account', { method: 'DELETE', body: { confirm } });
      window.location.href = '/';
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  if (!acc) return <p className="muted">{msg || 'Cargando…'}</p>;
  const methods = [...(acc.user.has_password ? ['Correo y contraseña'] : []), ...acc.providers.map((p) => LABEL[p] ?? p)];

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="page-head">
        <h1>Mi cuenta</h1>
        <p className="muted">Aquí puedes ver tus datos, descargarlos o eliminar tu cuenta.</p>
      </div>
      {msg && <div className="alert bad">{msg}</div>}

      <section className="card">
        <h2>Tus datos</h2>
        <div className="kv"><span>Nombre</span><strong>{acc.user.name || '—'}</strong></div>
        <div className="kv"><span>Correo</span><strong>{acc.user.email || 'Sin correo'}</strong></div>
        <div className="kv"><span>Formas de entrar</span><strong>{methods.join(', ') || '—'}</strong></div>
        <div className="kv"><span>Cuenta creada</span><strong>{new Date(acc.user.created_at).toLocaleDateString('es-CO')}</strong></div>
        <div className="kv">
          <span>Términos aceptados</span>
          <strong>{acc.user.accepted_terms_at ? `${new Date(acc.user.accepted_terms_at).toLocaleDateString('es-CO')} (versión ${acc.user.terms_version})` : 'Sin registro'}</strong>
        </div>
        <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
          Lee los <Link href="/terminos">Términos y condiciones</Link> y la <Link href="/privacidad">Política de privacidad</Link>.
        </p>
      </section>

      <section className="card">
        <h2>Descargar mis datos</h2>
        <p className="muted small">Un archivo con tu cuenta, proveedores, insumos, gastos, productos y cálculos guardados.</p>
        <a className="btn" href="/api/account/export" download>Descargar mis datos (JSON)</a>
      </section>

      <section className="card">
        <h2>Eliminar mi cuenta</h2>
        <p className="muted small">
          Se borran tu cuenta y todos tus datos de forma permanente. No se puede deshacer. Si lo necesitas, descarga tus datos antes.
        </p>
        <div className="row">
          <div className="field">
            <label htmlFor="del">Escribe ELIMINAR para confirmar</label>
            <input id="del" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          </div>
          <button type="button" className="shrink" style={{ background: 'var(--bad)', borderColor: 'var(--bad)', color: '#fff' }} disabled={confirm !== 'ELIMINAR'} onClick={remove}>
            Eliminar mi cuenta
          </button>
        </div>
      </section>
    </div>
  );
}
