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
| `NEXT_PUBLIC_APK_URL`, `NEXT_PUBLIC_WINDOWS_URL` | Opcional. Enlaces a un .apk o instalador de Windows ya generados (por ejemplo con PWABuilder); si existen, `/descargar` muestra el botón «Descargar el instalador» |
| `LEGAL_NAME`, `LEGAL_ID`, `LEGAL_EMAIL`, `LEGAL_ADDRESS`, `LEGAL_CITY`, `LEGAL_PHONE` | Datos del responsable que salen en los Términos y la Política de privacidad |

Las tablas se crean solas en cada `npm run build` (o con `npm run db:migrate`).

## Planes

Free (calculadora básica, sin guardar), Pro (cotizador y guardar), Pro+ (buscador de proveedores) y Pro+Plus (todo, con modo
avanzado). Cada plan incluye lo del anterior. Precios y ahorros en `src/lib/plans.ts`; el bloqueo se hace en el servidor
(`requireFeature`, respuesta 402) y en las pantallas (`PlanGate`).

- Los usuarios que existían cuando se creó la columna `users.plan` quedaron con el plan máximo de por vida.
- Cobro con **Rapyd** (tiene prioridad si sus claves están puestas). Página de pago de Rapyd para pago único y página de suscripción para el cobro automático; la tarjeta se escribe en Rapyd, la app nunca la ve.
  1. En el panel de Rapyd → Developers → Credentials copia la clave de acceso y la clave secreta a `RAPYD_ACCESS_KEY` y `RAPYD_SECRET_KEY`. Con claves de prueba (panel en «Sandbox») pon también `RAPYD_SANDBOX=1`; quítalo con las claves de producción.
  2. En Developers → Webhooks registra `https://<tu-dominio>/api/billing/rapyd/webhook` y marca al menos Payment Succeeded, Payment Completed e Invoice Payment Succeeded.
  3. Opcional: `RAPYD_COUNTRY` (por defecto `CO`), `RAPYD_RECURRING=0` para apagar el cobro automático, `RAPYD_WEBHOOK_URL` si registraste otra URL.
  4. Cada pago activa el plan una sola vez (`payments` id `rapyd:<pago>` o `rapyd:inv:<factura>`). `/api/billing/status` muestra si las claves están y la URL del webhook.
- Cobro con **PayU Latam** (WebCheckout: tarjetas, PSE, Nequi, Efecty…). Si `PAYU_*` está configurado, se usa PayU; si no, Mercado Pago.
  1. En el panel de PayU, Configuración → Configuración técnica, copia Merchant ID, Account ID y API Key a `PAYU_MERCHANT_ID`, `PAYU_ACCOUNT_ID`, `PAYU_API_KEY`.
  2. Las URLs ya van en cada pago: confirmación `https://TU-DOMINIO/api/billing/payu/confirmacion` y respuesta `https://TU-DOMINIO/api/billing/payu/respuesta`.
  3. Para probar sin tu cuenta pon `PAYU_TEST=1` (usa la cuenta sandbox pública de PayU). Quítalo en producción.
  4. La confirmación se valida con la firma de PayU y activa el plan una sola vez (tabla `payments`, id `payu:<transacción>`).
  5. `/api/billing/status` (con sesión) muestra qué pasarela está activa y qué variables faltan.
  6. **Cobro automático** (opcional): pide a PayU que active «Pagos recurrentes» en tu cuenta, luego pon `PAYU_RECURRING=1` y `PAYU_API_LOGIN` (Configuración técnica). Al elegir un plan aparece un formulario de tarjeta; PayU guarda la tarjeta (la app solo guarda los últimos 4 dígitos) y cobra solo cada mes, semestre o año. La persona cancela en Mi cuenta. Cada cobro pagado extiende el plan una vez (`payments` id `payu:bill:<id>`). Un cron diario (`vercel.json`, necesita `CRON_SECRET`) revisa los cobros por si algún aviso no llegó.
- Cobro con **Mercado Pago** (Checkout Pro). Sin `MP_ACCESS_TOKEN`, `/api/billing/checkout` responde 503.
  1. En mercadopago.com.co/developers crea una aplicación y copia el *Access Token* de producción a `MP_ACCESS_TOKEN`.
  2. En Webhooks de esa aplicación agrega `https://TU-DOMINIO/api/billing/webhook` con el evento **Pagos**, y copia su clave secreta a `MP_WEBHOOK_SECRET`.
  3. Los precios están en USD; Mercado Pago Colombia cobra en pesos, así que se convierten con `MP_USD_RATE` (por defecto 4000) y `MP_CURRENCY=COP`.
  4. El webhook consulta el pago a Mercado Pago, comprueba plan, periodo y monto, y activa el plan sin duplicar (tabla `payments`). Renovar el mismo plan suma el tiempo al vencimiento actual.
- Para dar un plan a mano (pruebas o cobro fuera de la app):
  `UPDATE users SET plan='pro', plan_period='annual', plan_expires_at = now() + interval '1 year' WHERE email='correo@ejemplo.com';`
  (planes: `free`, `pro`, `plus`, `max`; de por vida: `plan_lifetime = true`).

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

## Instalar como app y sacar el .apk

La página pública **`/descargar`** deja elegir Android, iPhone, Windows o Linux y explica la instalación de cada uno; está enlazada desde el inicio, el menú y el pie de página. La web es una PWA: en Chrome (Android) aparece el botón **Instalar app** arriba, y en iPhone se agrega desde Safari con
*Compartir → Agregar a pantalla de inicio*. El manifiesto está en `src/app/manifest.ts`, los íconos en `public/icons/` y el
service worker en `public/sw.js` (solo guarda archivos estáticos y una página sin conexión; nunca la API).

Para generar el archivo **.apk / .aab**:

1. Entra a [pwabuilder.com](https://www.pwabuilder.com), pega la dirección pública de la app y pulsa *Start*.
2. En *Package for stores* elige **Android** y descarga el paquete (trae el .apk para instalar directo y el .aab para Play Store, con la llave de firma).
3. Guarda la llave de firma y su contraseña: sin ellas no puedes actualizar la app en Play Store.
4. Para quitar la barra del navegador, publica el archivo `/.well-known/assetlinks.json` con la huella SHA-256 que entrega PWABuilder.
5. Play Store pide cuenta de desarrollador (US$25 una vez), política de privacidad (`/privacidad`) y capturas.

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
