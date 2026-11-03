export type SearchResult = { title: string; source: string; link: string; price: number | null; priceText: string; image?: string; snippet?: string };

export function directLinks(q: string) {
  const e = encodeURIComponent(q);
  return [
    { name: 'Mercado Libre', url: `https://listado.mercadolibre.com.co/${encodeURIComponent(q.replace(/\s+/g, '-'))}` },
    { name: 'Google Shopping', url: `https://www.google.com/search?tbm=shop&gl=co&q=${e}` },
    { name: 'Proveedores mayoristas', url: `https://www.google.com/search?gl=co&q=${encodeURIComponent(q + ' proveedor mayorista Colombia')}` },
    { name: 'Falabella', url: `https://www.falabella.com.co/falabella-co/search?Ntt=${e}` },
    { name: 'Alibaba', url: `https://www.alibaba.com/trade/search?SearchText=${e}` },
  ];
}
