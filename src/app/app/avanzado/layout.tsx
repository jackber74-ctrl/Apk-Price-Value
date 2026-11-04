'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import PlanGate from '@/components/PlanGate';

const TABS = [
  { href: '/app/avanzado', label: 'Productos y precios' },
  { href: '/app/avanzado/insumos', label: 'Insumos y comparador' },
  { href: '/app/avanzado/proveedores', label: 'Proveedores' },
  { href: '/app/avanzado/gastos', label: 'Gastos fijos' },
  { href: '/app/avanzado/personal', label: 'Mano de obra' },
  { href: '/app/avanzado/equipos', label: 'Equipos' },
  { href: '/app/avanzado/configuracion', label: 'Configuración' },
];

export default function AdvancedLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <>
      <nav className="subnav" style={{ marginTop: 12 }}>
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={path === t.href ? 'active' : ''}>{t.label}</Link>
        ))}
      </nav>
      <PlanGate feature="advanced" title="Modo avanzado">{children}</PlanGate>
    </>
  );
}
