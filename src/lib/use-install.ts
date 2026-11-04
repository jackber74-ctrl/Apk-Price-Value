'use client';
import { useEffect, useState } from 'react';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
export type Platform = 'android' | 'ios' | 'windows' | 'linux' | 'mac' | 'other';

export function detectPlatform(ua: string): Platform {
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/windows/i.test(ua)) return 'windows';
  if (/macintosh|mac os x/i.test(ua)) return 'mac';
  if (/linux|x11|cros/i.test(ua)) return 'linux';
  return 'other';
}

/** Estado de la instalación de la PWA: plataforma, si ya está instalada y el aviso nativo del navegador cuando existe. */
export function useInstall() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>('other');
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform(navigator.userAgent));
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;
    if (standalone) setInstalled(true);
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent); };
    const onInstalled = () => { setInstalled(true); setEvt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!evt) return;
    await evt.prompt();
    await evt.userChoice.catch(() => {});
    setEvt(null);
  }

  return { platform, installed, canInstall: !!evt, install };
}
