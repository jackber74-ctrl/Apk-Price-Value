import { NextResponse } from 'next/server';
import { requireUser, jsonError } from '@/lib/auth';
import { parseCop } from '@/lib/format';
import { directLinks, type SearchResult } from '@/lib/search';

// Buscador de proveedores en línea.
// Con SERPER_API_KEY muestra resultados dentro de la app (Google Shopping y Google en Colombia).
// Sin clave, devuelve solo enlaces directos a las tiendas.

export async function GET(req: Request) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
  const mode = url.searchParams.get('mode') === 'proveedores' ? 'proveedores' : 'productos';
  if (!q) return jsonError('Escribe qué quieres buscar.');

  const links = directLinks(q);
  const key = process.env.SERPER_API_KEY;
  if (!key) return NextResponse.json({ results: [], links, configured: false });

  const endpoint = mode === 'productos' ? 'https://google.serper.dev/shopping' : 'https://google.serper.dev/search';
  const query = mode === 'productos' ? q : `${q} proveedor mayorista`;
  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, gl: 'co', hl: 'es', num: 20 }),
      cache: 'no-store',
    });
    if (!r.ok) return NextResponse.json({ results: [], links, configured: true, error: `El buscador respondió ${r.status}.` });
    const data = await r.json();
    const results: SearchResult[] =
      mode === 'productos'
        ? (data.shopping ?? []).map((x: Record<string, string>) => ({
            title: x.title,
            source: x.source ?? '',
            link: x.link,
            priceText: x.price ?? '',
            price: parseCop(x.price),
            image: x.imageUrl,
          }))
        : (data.organic ?? []).map((x: Record<string, string>) => ({
            title: x.title,
            source: safeHost(x.link),
            link: x.link,
            priceText: '',
            price: null,
            snippet: x.snippet,
          }));
    if (mode === 'productos') results.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    return NextResponse.json({ results, links, configured: true });
  } catch {
    return NextResponse.json({ results: [], links, configured: true, error: 'No se pudo conectar con el buscador.' });
  }
}

function safeHost(link: string) {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
