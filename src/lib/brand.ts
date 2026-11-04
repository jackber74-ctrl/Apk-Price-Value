// Colores de marca a partir del logo. Funciones puras (sin navegador) para poder probarlas.

export const DEFAULT_BRAND = '#0f766e';
const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (s: unknown): s is string => typeof s === 'string' && HEX.test(s);

const hex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { s, l };
}

/** Color más "de marca" de una imagen RGBA: el más frecuente entre los que tienen color (ignora blancos, grises y transparentes). */
export function dominantColor(data: ArrayLike<number>): string {
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 200) continue;
    const { s, l } = rgbToHsl(r, g, b);
    if (s < 0.25 || l > 0.9 || l < 0.1) continue;
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bin.n += 1; bin.r += r; bin.g += g; bin.b += b;
    bins.set(key, bin);
  }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const bin of bins.values()) if (!best || bin.n > best.n) best = bin;
  return best ? hex(best.r / best.n, best.g / best.n, best.b / best.n) : DEFAULT_BRAND;
}

/** Texto blanco u oscuro según el fondo, para que se lea. */
export function readableOn(color: string): '#ffffff' | '#111827' {
  const c = isHex(color) ? color : DEFAULT_BRAND;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? '#111827' : '#ffffff';
}

/** Versión suave del color para fondos de filas y recuadros. */
export function tint(color: string, amount = 0.9): string {
  const c = isHex(color) ? color : DEFAULT_BRAND;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  return hex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

export const LOGO_MAX_CHARS = 400_000;
export const isLogo = (s: unknown): s is string =>
  typeof s === 'string' && s.length <= LOGO_MAX_CHARS && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s);
