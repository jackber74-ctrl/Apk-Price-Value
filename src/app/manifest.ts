import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Apk Price Value',
    short_name: 'Precios',
    description: 'Calcula el precio sugerido de tus productos y servicios, cotiza y busca proveedores.',
    lang: 'es-CO',
    start_url: '/app/calculadora',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6f5f1',
    theme_color: '#0f766e',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Calculadora', url: '/app/calculadora' },
      { name: 'Cotizador', url: '/app/cotizador' },
    ],
  };
}
