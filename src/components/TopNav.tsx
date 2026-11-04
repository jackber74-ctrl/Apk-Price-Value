'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/client';
import { usePlan } from '@/lib/use-plan';
import type { Feature } from '@/lib/plans';

const LINKS: { href: string; label: string; feature?: Feature }[] = [
  { href: '/app/calculadora', label: 'Calculadora' },
  { href: '/app/cotizador', label: 'Cotizador', feature: 'save' },
  { href: '/app/buscador', label: 'Buscar proveedores', feature: 'search' },
  { href: '/app/avanzado', label: 'Avanzado', feature: 'advanced' },
  { href: '/planes', label: 'Planes' },
  { href: '/app/cuenta', label: 'Mi cuenta' },
];

export default function TopNav() {
  const path = usePathname();
  const plan = usePlan();
  async function logout() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/login';
  }
  return (
    <header className="topbar">
      <div className="shell">
        <Link href="/app/calculadora" className="brand">Apk <span>Price Value</span></Link>
        <nav className="nav">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={path.startsWith(l.href) ? 'active' : ''}>{l.label}{l.feature && plan.loaded && !plan.can(l.feature) && <span className="lock" aria-label="Requiere un plan superior">🔒</span>}</Link>
          ))}
        </nav>
        <Link href="/descargar" className="btn ghost">Descargar app</Link>
        <button className="ghost" onClick={logout}>Salir</button>
      </div>
    </header>
  );
}
