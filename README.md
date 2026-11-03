# Apk Price Value

App web para sacar el precio sugerido de cualquier producto o servicio, con usuarios y contraseña,
buscador de proveedores en línea y un modo avanzado basado en la *Plantilla de costos, precios y
contabilidad – Colombia 2026*.

## Qué hace

- **Calculadora simple**: costos variables por unidad, horas de trabajo, gastos fijos (los
  *indispensables* siempre se suman y los demás se eligen), % de ganancia con botones o barra
  (sobre el precio o sobre el costo), comisión, IVA y redondeo. Muestra precio final, ganancia,
  margen real y punto de equilibrio. Los cálculos se pueden guardar.
- **Buscador de proveedores**: busca precios (Google Shopping Colombia) o mayoristas, y guarda el
  resultado como insumo nuevo o como cotización en el comparador. Sin clave de búsqueda, muestra
  enlaces directos a Mercado Libre, Google Shopping, Falabella y Alibaba.
- **Modo avanzado**: insumos con merma e IVA, comparador de proveedores, gastos fijos, mano de obra
  con seguridad social y prestaciones 2026, equipos con depreciación, recetas y procesos por
  producto, reparto de gastos fijos (por unidad o por minuto), diagnóstico y comparación con la
  competencia. Todas las tablas se exportan a Excel (CSV).

## Tecnología

Next.js 15 + PostgreSQL (`pg`), contraseñas con bcrypt y sesión firmada en cookie (`jose`).

## Variables de entorno

| Variable | Para qué |
| --- | --- |
| `DATABASE_URL` | Conexión a Postgres (Neon, Supabase, Vercel Postgres…) |
| `AUTH_SECRET` | Texto secreto de 32+ caracteres para firmar sesiones |
| `SERPER_API_KEY` | Opcional. Clave de [serper.dev](https://serper.dev) para ver resultados dentro del buscador |

Las tablas se crean solas en cada `npm run build` (o con `npm run db:migrate`).

## Publicar en Vercel

1. En Vercel: *Add New → Project* e importa este repositorio.
2. En el proyecto: *Storage → Create Database → Neon (Postgres)* y conéctala. Eso agrega `DATABASE_URL`.
3. En *Settings → Environment Variables* agrega `AUTH_SECRET` (y `SERPER_API_KEY` si la tienes).
4. *Redeploy*. Entra al enlace, crea tu cuenta y listo.

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # y llena los valores
npm run db:migrate
npm run dev
npm test
```
