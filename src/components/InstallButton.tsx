'use client';
import { useEffect, useState } from 'react';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Botón «Instalar app». En iPhone no existe el aviso automático, así que se explica el paso manual. */
export default function InstallButton() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [help, setHelp] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;
    if (standalone) return setInstalled(true);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent); };
    const onInstalled = () => { setInstalled(true); setEvt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || (!evt && !ios)) return null;

  async function install() {
    if (evt) {
      await evt.prompt();
      await evt.userChoice.catch(() => {});
      setEvt(null);
    } else setHelp((v) => !v);
  }

  return (
    <div style={{ position: 'relative' }}>
      <button type="button" className="ghost" onClick={install}>Instalar app</button>
      {help && (
        <div className="card" role="dialog" style={{ position: 'absolute', right: 0, top: '110%', width: 250, zIndex: 20, fontSize: '0.85rem' }}>
          En Safari toca <strong>Compartir</strong> y luego <strong>Agregar a pantalla de inicio</strong>.
        </div>
      )}
    </div>
  );
}
