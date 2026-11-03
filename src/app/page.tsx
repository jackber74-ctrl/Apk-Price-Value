import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUserId } from '@/lib/auth';

export default async function Home() {
  if (await currentUserId()) redirect('/app/calculadora');
  return (
    <main className="hero">
      <p className="badge">Para emprendimientos en Colombia</p>
      <h1>Saca el precio justo de lo que vendes</h1>
      <p className="muted">
        Suma tus costos variables y fijos, elige cuánto quieres ganar y obtén el precio sugerido final.
        Busca proveedores en línea y compara quién te vende más barato.
      </p>
      <div className="actions">
        <Link className="btn" href="/registro">Crear cuenta gratis</Link>
        <Link className="btn ghost" href="/login">Ya tengo cuenta</Link>
      </div>
      <div className="features">
        <div className="card"><h3>Calculadora simple</h3><p className="muted small">Pones tus costos, eliges el % de ganancia y los gastos fijos que aplican. Listo.</p></div>
        <div className="card"><h3>Buscador de proveedores</h3><p className="muted small">Busca precios en tiendas y mayoristas y guárdalos como insumos.</p></div>
        <div className="card"><h3>Modo avanzado</h3><p className="muted small">Recetas, mano de obra con prestaciones, equipos, punto de equilibrio y comparador.</p></div>
      </div>
    </main>
  );
}
