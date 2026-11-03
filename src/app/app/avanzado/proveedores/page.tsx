'use client';
import Link from 'next/link';
import CrudTable from '@/components/CrudTable';
import { useAdvanced, type Supplier } from '@/components/useAdvanced';

export default function Proveedores() {
  const { data, setList, loading, error } = useAdvanced();
  if (loading) return <p className="muted">Cargando…</p>;
  return (
    <>
      <div className="page-head">
        <h1>Proveedores</h1>
        <p className="muted">Tu directorio de proveedores. Puedes <Link href="/app/buscador">buscar nuevos en línea</Link> y guardarlos aquí.</p>
      </div>
      {error && <div className="alert bad">{error}</div>}
      <CrudTable<Supplier>
        resource="suppliers"
        rows={data.suppliers}
        setRows={setList('suppliers')}
        blank={{ name: 'Nuevo proveedor' }}
        addLabel="+ Agregar proveedor"
        cols={[
          { key: 'name', label: 'Nombre' },
          { key: 'url', label: 'Página web', width: 220 },
          { key: 'phone', label: 'Teléfono / WhatsApp', width: 140 },
          { key: 'city', label: 'Ciudad', width: 120 },
          { key: 'notes', label: 'Notas', width: 220 },
        ]}
        extraActions={(r) => (r.url ? <a className="small" href={r.url.startsWith('http') ? r.url : `https://${r.url}`} target="_blank" rel="noreferrer">Abrir</a> : null)}
      />
    </>
  );
}
