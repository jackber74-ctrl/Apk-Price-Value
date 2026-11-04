# Apk Price Value

App web para sacar el precio sugerido de cualquier producto o servicio, con usuarios y contraseña,
buscador de proveedores en línea y un modo avanzado basado en la *Plantilla de costos, precios y
contabilidad – Colombia 2026*.

## Qué hace

- **Calculadora simple**: costos variables por unidad, horas de trabajo, gastos fijos (los
  *indispensables* siempre se suman y los demás se eligen), % de ganancia con botones o barra
  (sobre el precio o sobre el costo), comisión, IVA y redondeo. Muestra precio final, ganancia,
  margen real y punto de equilibrio. Los cálculos se pueden guardar.
- **Cotizador**: crea cotizaciones con clientes, líneas de productos y servicios (desde tus cálculos guardados o en
  blanco), descuento, IVA, notas, estado e impresión/PDF. Todo queda en tu cuenta para editar, duplicar o eliminar.
  Desde la calculadora hay un botón «Pasar al cotizador» y desde la cotización un enlace «Ver en calculadora».
  La calculadora también guarda líneas como insumos y gastos extra como gastos fijos para reutilizarlos.
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
| `APP_URL` | Dirección pública sin barra final, por ejemplo `https://apk-price-value.vercel.app`. Se usa para el inicio de sesión social |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Opcional. Activa «Continuar con Google» |
| `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | Opcional. Activa «Continuar con Facebook» |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | Opcional. Activa «Continuar con TikTok» |
| `LEGAL_NAME`, `LEGAL_ID`, `LEGAL_EMAIL`, `LEGAL_ADDRESS`, `LEGAL_CITY`, `LEGAL_PHONE` | Datos del responsable que salen en los Términos y la Política de privacidad |

Las tablas se crean solas en cada `npm run build` (o con `npm run db:migrate`).

## Textos legales (Colombia)

- `/terminos` y `/privacidad` están redactados según la Ley 1581 de 2012, el Decreto 1377 de 2013 (Decreto 1074 de 2015) y la
  Ley 1480 de 2011. Mientras falte alguna variable `LEGAL_*`, los documentos muestran un aviso de borrador.
- Al registrarse con correo hay una casilla obligatoria. Al usar Google, Facebook o TikTok se muestra el aviso junto a los botones.
  En ambos casos se guarda la fecha y la versión aceptadas (`users.accepted_terms_at` y `users.terms_version`).
- Si cambias los textos, actualiza `TERMS_VERSION` y `TERMS_UPDATED` en `src/lib/legal.ts`.
- **Mi cuenta** (`/app/cuenta`) permite descargar todos los datos en JSON y eliminar la cuenta, que son los derechos de acceso y
  supresión de la ley.
- Los textos son un borrador de buena fe y no reemplazan la revisión de un abogado.

## Inicio de sesión con Google, Facebook y TikTok

Cada botón aparece solo si están sus dos variables. En cada plataforma hay que registrar esta dirección de retorno
(cambia `TU-APP` por tu dirección real):

- Google: `https://TU-APP/api/auth/oauth/google/callback`
- Facebook: `https://TU-APP/api/auth/oauth/facebook/callback`
- TikTok: `https://TU-APP/api/auth/oauth/tiktok/callback`

Cómo se unen las cuentas:

- Google entrega un correo verificado, así que si ya existe una cuenta con ese correo se une a ella. Si esa cuenta se creó con
  contraseña y nunca se comprobó el correo, se le quita la contraseña para que nadie pueda quedarse con una cuenta ajena.
- Facebook y TikTok no se unen por correo: cada uno crea su propia cuenta. TikTok no entrega correo.

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
