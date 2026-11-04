'use client';
import { dominantColor } from './brand';

/** Reduce el logo a máx. 480 px y lo devuelve como data URL junto con su color principal. */
export async function prepareLogo(file: File): Promise<{ logo: string; color: string }> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Sube una imagen PNG, JPG o WebP.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => fail(new Error('No pude leer esa imagen.'));
      i.src = url;
    });
    const scale = Math.min(1, 480 / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, w, h);
    const color = dominantColor(ctx.getImageData(0, 0, w, h).data);
    let logo = canvas.toDataURL('image/png');
    if (logo.length > 300_000) logo = canvas.toDataURL('image/jpeg', 0.85);
    if (logo.length > 300_000) throw new Error('El logo pesa demasiado. Prueba con uno más simple.');
    return { logo, color };
  } finally {
    URL.revokeObjectURL(url);
  }
}
