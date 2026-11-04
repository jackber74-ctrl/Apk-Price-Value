'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useInstall, type Platform } from '@/lib/use-install';

// Enlaces opcionales a paquetes ya generados (por ejemplo con PWABuilder). Se llenan en Vercel.
const APK_URL = process.env.NEXT_PUBLIC_APK_URL;
const MSIX_URL = process.env.NEXT_PUBLIC_WINDOWS_URL;

type Option = { id: Exclude<Platform, 'mac' | 'other'>; name: string; icon: string; browser: string; steps: string[]; shortcut: string };

const OPTIONS: Option[] = [
  {
    id: 'android', name: 'Android', icon: '🤖', browser: 'Chrome',
    steps: ['Abre esta página en Chrome.', 'Pulsa «Instalar en este dispositivo» (o el menú ⋮ y luego «Instalar app»).', 'Confirma. Queda con su ícono en tu pantalla de inicio.'],
    shortcut: 'El ícono queda en la pantalla de inicio y en el cajón de aplicaciones.',
  },
  {
    id: 'ios', name: 'iPhone y iPad', icon: '🍎', browser: 'Safari',
    steps: ['Abre esta página en Safari (no funciona desde otros navegadores).', 'Toca el botón Compartir (el cuadrado con la flecha).', 'Elige «Agregar a pantalla de inicio» y toca Agregar.'],
    shortcut: 'Apple no permite instalar con un solo botón: hay que hacerlo con el menú Compartir de Safari.',
  },
  {
    id: 'windows', name: 'Windows', icon: '🪟', browser: 'Edge o Chrome',
    steps: ['Abre esta página en Microsoft Edge o Chrome.', 'Pulsa «Instalar en este dispositivo» (o el ícono de instalar al final de la barra de direcciones).', 'Confirma. Se abre como programa y queda en el menú Inicio.'],
    shortcut: 'Queda en el menú Inicio y la barra de tareas. En Edge o Chrome, el mismo diálogo te deja marcar «Crear acceso directo en el escritorio».',
  },
  {
    id: 'linux', name: 'Linux', icon: '🐧', browser: 'Chrome, Chromium, Brave o Edge',
    steps: ['Abre esta página en Chrome, Chromium, Brave o Edge (Firefox no instala webs como apps).', 'Pulsa «Instalar en este dispositivo» (o el ícono de instalar en la barra de direcciones).', 'Confirma. Aparece en el menú de aplicaciones de tu escritorio.'],
    shortcut: 'Queda en el menú de aplicaciones de tu escritorio, desde donde puedes anclarla o copiar el acceso directo al escritorio.',
  },
];

export default function Descargar() {
  const { platform, limit, installed, canInstall, install } = useInstall();
  const [done, setDone] = useState(false);
  const [hint, setHint] = useState(false);
  const detected = platform === 'mac' ? 'windows' : platform;
  const [open, setOpen] = useState<string | null>(null);
  const current = open ?? (OPTIONS.some((o) => o.id === detected) ? detected : 'android');
  const opt = OPTIONS.find((o) => o.id === current)!;
  const direct = current === 'android' ? APK_URL : current === 'windows' ? MSIX_URL : undefined;

  return (
    <main className="hero" style={{ marginTop: '6vh', maxWidth: 820 }}>
      <Link href="/" className="brand">Apk <span>Price Value</span></Link>
      <h1 style={{ marginTop: 16 }}>Descarga la app</h1>
      <p className="muted">Elige tu dispositivo. Es la misma app, instalada con su ícono y en pantalla completa, sin pasar por una tienda.</p>

      {installed && <div className="alert">Ya tienes la app instalada en este dispositivo. <Link href="/app/calculadora">Abrirla</Link></div>}

      <div className="chips" style={{ justifyContent: 'center', margin: '18px 0' }} role="tablist">
        {OPTIONS.map((o) => (
          <button key={o.id} type="button" role="tab" aria-selected={current === o.id} className={`chip ${current === o.id ? 'on' : ''}`} onClick={() => setOpen(o.id)}>
            {o.icon} {o.name}{o.id === detected ? ' · tu equipo' : ''}
          </button>
        ))}
      </div>

      <section className="card" style={{ textAlign: 'left' }}>
        <h2>{opt.icon} {opt.name}</h2>
        <p className="muted small">Navegador recomendado: {opt.browser}.</p>
        <ol style={{ paddingLeft: 20, lineHeight: 1.7 }}>
          {opt.steps.map((s) => <li key={s}>{s}</li>)}
        </ol>
        <p className="muted small">{opt.shortcut}</p>
        {current === detected && limit && (
          <div className="alert bad">
            {limit === 'inapp'
              ? 'Estás dentro de otra app (Facebook, Instagram, TikTok…). Abre este enlace en Chrome o Safari desde el menú «Abrir en el navegador».'
              : 'Firefox no instala webs como apps. Abre este enlace en Chrome, Edge o Brave.'}
          </div>
        )}
        <div className="actions" style={{ justifyContent: 'flex-start' }}>
          {current === detected && installed && <Link className="btn" href="/app/calculadora">Abrir la app</Link>}
          {current === detected && !installed && current !== 'ios' && !limit && (
            <button type="button" onClick={async () => { if (canInstall) setDone(await install()); else setHint(true); }}>
              Instalar en este dispositivo
            </button>
          )}
          {current !== detected && <span className="muted small">Abre esta misma página desde ese dispositivo para instalarla.</span>}
          {direct && <a className="btn ghost" href={direct} download>Descargar el instalador</a>}
        </div>
        {done && <div className="alert" style={{ marginTop: 10 }}>¡Listo! La app quedó instalada. {opt.shortcut}</div>}
        {hint && !canInstall && (
          <div className="alert" style={{ marginTop: 10 }}>
            Tu navegador no mostró el aviso automático (a veces pasa si lo cerraste antes). Instálala desde su menú: en el celular ⋮ → «Instalar app»; en el computador, el ícono de instalar al final de la barra de direcciones.
          </div>
        )}
      </section>

      <p className="muted small" style={{ marginTop: 16 }}>
        ¿Prefieres usarla sin instalar? <Link href="/login">Entra desde el navegador</Link>. Comparte este enlace para que otros la instalen:{' '}
        <strong>/descargar</strong>
      </p>
    </main>
  );
}
