'use client';
import { useEffect, useState } from 'react';
import { clearInstallEvent, getInstall, startInstallCapture, subscribeInstall } from './install-store';

export type Platform = 'android' | 'ios' | 'windows' | 'linux' | 'mac' | 'other';

export function detectPlatform(ua: string): Platform {
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/windows/i.test(ua)) return 'windows';
  if (/macintosh|mac os x/i.test(ua)) return 'mac';
  if (/linux|x11|cros/i.test(ua)) return 'linux';
  return 'other';
}

/** Navegador que no instala webs como apps (Firefox de escritorio) o que corre dentro de otra app (Facebook, Instagram, TikTok…). */
export function browserLimit(ua: string, platform: Platform): 'firefox' | 'inapp' | null {
  if (/FBAN|FBAV|Instagram|TikTok|musical_ly|Line\/|; wv\)/i.test(ua)) return 'inapp';
  if (/firefox/i.test(ua) && platform !== 'android') return 'firefox';
  return null;
}

/** Estado de la instalación de la PWA: plataforma, si ya está instalada y el aviso nativo del navegador cuando existe. */
export function useInstall() {
  const [platform, setPlatform] = useState<Platform>('other');
  const [limit, setLimit] = useState<'firefox' | 'inapp' | null>(null);
  const [installed, setInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    startInstallCapture();
    const ua = navigator.userAgent;
    const plat = detectPlatform(ua);
    setPlatform(plat);
    setLimit(browserLimit(ua, plat));
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;
    const sync = () => {
      const s = getInstall();
      setCanInstall(!!s.event);
      setInstalled(!!standalone || s.installed);
    };
    sync();
    return subscribeInstall(sync);
  }, []);

  async function install() {
    const { event } = getInstall();
    if (!event) return false;
    await event.prompt();
    const choice = await event.userChoice.catch(() => null);
    clearInstallEvent();
    return choice?.outcome === 'accepted';
  }

  return { platform, limit, installed, canInstall, install };
}
