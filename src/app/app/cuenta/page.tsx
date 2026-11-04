'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { prepareLogo } from '@/lib/logo-client';
import { DEFAULT_BRAND } from '@/lib/brand';

type Profile = { name: string; logo: string | null; brand_color: string | null; biz_nit: string; biz_phone: string; biz_email: string; biz_address: string };

type Account = {
  user: { email: string | null; name: string; created_at: string; accepted_terms_at: string | null; terms_version: string | null; has_password: boolean };
  providers: string[];
};
const LABEL: Record<string, string> = { google: 'Google', facebook: 'Facebook', tiktok: 'TikTok' };

export default function Cuenta() {
  const [acc, setAcc] = useState<Account | null>(null);
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [prof, setProf] = useState<Profile | null>(null);

  useEffect(() => {
    api<Account>('/api/account').then(setAcc).catch((e) => setMsg(e.message));
    api<{ profile: Profile }>('/api/account/profile').then((d) => setProf(d.profile)).catch(() => {});
  }, []);

  async function pickLogo(file?: File) {
    if (!file || !prof) return;
    try {
      const { logo, color } = await prepareLogo(file);
      setProf({ ...prof, logo, brand_color: color });
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function saveProfile() {
    if (!prof) return;
    try {
      const d = await api<{ profile: Profile }>('/api/account/profile', { method: 'PUT', body: prof });
      setProf(d.profile);
      setMsg('Logo y datos del negocio guardados.');
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

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

      {prof && (
        <section className="card">
          <h2>Logo y datos del negocio</h2>
          <p className="muted small">Salen en el encabezado de tus cotizaciones, con los colores de tu logo.</p>
          <div className="row" style={{ alignItems: 'center' }}>
            <div style={{ width: 110, height: 110, border: '1px dashed var(--line)', borderRadius: 8, display: 'grid', placeItems: 'center', overflow: 'hidden', background: '#fff' }}>
              {prof.logo ? <img src={prof.logo} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%' }} /> : <span className="muted small">Sin logo</span>}
            </div>
            <div className="field">
              <label htmlFor="logo">Subir logo (PNG, JPG o WebP)</label>
              <input id="logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => pickLogo(e.target.files?.[0])} />
              {prof.logo && <button type="button" className="ghost" style={{ marginTop: 6 }} onClick={() => setProf({ ...prof, logo: null, brand_color: null })}>Quitar logo</button>}
            </div>
            <div className="field shrink">
              <label htmlFor="color">Color principal</label>
              <input id="color" type="color" value={prof.brand_color ?? DEFAULT_BRAND} onChange={(e) => setProf({ ...prof, brand_color: e.target.value })} />
            </div>
          </div>
          <div className="row">
            <div className="field"><label htmlFor="bn">Nombre del negocio</label><input id="bn" value={prof.name} onChange={(e) => setProf({ ...prof, name: e.target.value })} /></div>
            <div className="field"><label htmlFor="nit">NIT / CC</label><input id="nit" value={prof.biz_nit} onChange={(e) => setProf({ ...prof, biz_nit: e.target.value })} /></div>
          </div>
          <div className="row">
            <div className="field"><label htmlFor="ph">Teléfono</label><input id="ph" value={prof.biz_phone} onChange={(e) => setProf({ ...prof, biz_phone: e.target.value })} /></div>
            <div className="field"><label htmlFor="em">Correo del negocio</label><input id="em" value={prof.biz_email} onChange={(e) => setProf({ ...prof, biz_email: e.target.value })} /></div>
          </div>
          <div className="field"><label htmlFor="ad">Dirección</label><input id="ad" value={prof.biz_address} onChange={(e) => setProf({ ...prof, biz_address: e.target.value })} /></div>
          <button type="button" onClick={saveProfile}>Guardar</button>
        </section>
      )}

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
