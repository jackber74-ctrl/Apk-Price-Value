'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/client';
import InstallButton from './InstallButton';

const LINKS = [
  { href: '/app/calculadora', label: 'Calculadora' },
  { href: '/app/cotizador', label: 'Cotizador' },
  { href: '/app/buscador', label: 'Buscar proveedores' },
  { href: '/app/avanzado', label: 'Avanzado' },
  { href: '/app/cuenta', label: 'Mi cuenta' },
];

export default function TopNav() {
  const path = usePathname();
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
            <Link key={l.href} href={l.href} className={path.startsWith(l.href) ? 'active' : ''}>{l.label}</Link>
          ))}
        </nav>
        <InstallButton />
        <button className="ghost" onClick={logout}>Salir</button>
      </div>
    </header>
  );
}
