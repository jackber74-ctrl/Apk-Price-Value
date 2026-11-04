'use client';
// Guarda el aviso de instalación del navegador. Ese aviso se dispara una sola vez al cargar la página, así que se
// captura desde el inicio de cualquier página y se entrega después a /descargar.

export type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let saved: InstallEvent | null = null;
let installed = false;
let started = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function startInstallCapture() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    saved = e as InstallEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    saved = null;
    emit();
  });
}

export const getInstall = () => ({ event: saved, installed });
export function clearInstallEvent() { saved = null; emit(); }
export function subscribeInstall(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
