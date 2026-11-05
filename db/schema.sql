-- Esquema de Apk Price Value. Se puede ejecutar varias veces sin romper nada.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Configuración del negocio (una fila por usuario)
CREATE TABLE IF NOT EXISTS settings (
  user_id          INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  business_name    TEXT NOT NULL DEFAULT 'Mi emprendimiento',
  iva_responsable  BOOLEAN NOT NULL DEFAULT false,
  iva_rate         NUMERIC NOT NULL DEFAULT 0.19,
  margin           NUMERIC NOT NULL DEFAULT 0.30,
  commission       NUMERIC NOT NULL DEFAULT 0.03,
  round_to         NUMERIC NOT NULL DEFAULT 500,
  fixed_method     TEXT NOT NULL DEFAULT 'unidad',
  min_wage         NUMERIC NOT NULL DEFAULT 1750905,
  transport_aid    NUMERIC NOT NULL DEFAULT 249095,
  hours_month      NUMERIC NOT NULL DEFAULT 210,
  productive_pct   NUMERIC NOT NULL DEFAULT 0.85,
  exonerated       BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS suppliers (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  url        TEXT NOT NULL DEFAULT '',
  phone      TEXT NOT NULL DEFAULT '',
  city       TEXT NOT NULL DEFAULT '',
  notes      TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insumos, materiales y mercancía
CREATE TABLE IF NOT EXISTS supplies (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT '',
  supplier_id  INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  presentation TEXT NOT NULL DEFAULT '',
  qty          NUMERIC NOT NULL DEFAULT 1,
  unit         TEXT NOT NULL DEFAULT 'und',
  price        NUMERIC NOT NULL DEFAULT 0,
  iva_pct      NUMERIC NOT NULL DEFAULT 0,
  waste_pct    NUMERIC NOT NULL DEFAULT 0,
  url          TEXT NOT NULL DEFAULT '',
  price_date   DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Precios alternativos de un insumo en otros proveedores (comparador)
CREATE TABLE IF NOT EXISTS supply_quotes (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supply_id   INTEGER NOT NULL REFERENCES supplies(id) ON DELETE CASCADE,
  supplier    TEXT NOT NULL DEFAULT '',
  price       NUMERIC NOT NULL DEFAULT 0,
  qty         NUMERIC NOT NULL DEFAULT 1,
  url         TEXT NOT NULL DEFAULT '',
  quote_date  DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS fixed_costs (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT '',
  amount     NUMERIC NOT NULL DEFAULT 0,
  frequency  TEXT NOT NULL DEFAULT 'Mensual',
  mandatory  BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS workers (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  contract   TEXT NOT NULL DEFAULT 'Contrato laboral',
  direct     BOOLEAN NOT NULL DEFAULT true,
  salary     NUMERIC NOT NULL DEFAULT 0,
  arl_class  TEXT NOT NULL DEFAULT 'I',
  hours      NUMERIC
);

CREATE TABLE IF NOT EXISTS equipment (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  cost         NUMERIC NOT NULL DEFAULT 0,
  life_years   NUMERIC NOT NULL DEFAULT 5,
  residual     NUMERIC NOT NULL DEFAULT 0,
  maint_year   NUMERIC NOT NULL DEFAULT 0,
  charge       TEXT NOT NULL DEFAULT 'Como gasto fijo',
  hours_month  NUMERIC NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  kind             TEXT NOT NULL DEFAULT 'Producto',
  category         TEXT NOT NULL DEFAULT '',
  units_month      NUMERIC NOT NULL DEFAULT 0,
  other_var_cost   NUMERIC NOT NULL DEFAULT 0,
  margin           NUMERIC,
  commission       NUMERIC,
  iva_pct          NUMERIC,
  current_price    NUMERIC,
  competitor_price NUMERIC
);

-- Receta: qué insumos lleva cada producto
CREATE TABLE IF NOT EXISTS recipe_items (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supply_id  INTEGER NOT NULL REFERENCES supplies(id) ON DELETE CASCADE,
  qty        NUMERIC NOT NULL DEFAULT 0
);

-- Procesos: minutos de cada persona y de cada equipo por producto
CREATE TABLE IF NOT EXISTS process_steps (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  step         TEXT NOT NULL DEFAULT '',
  worker_id    INTEGER REFERENCES workers(id) ON DELETE SET NULL,
  minutes      NUMERIC NOT NULL DEFAULT 0,
  equipment_id INTEGER REFERENCES equipment(id) ON DELETE SET NULL,
  equip_minutes NUMERIC NOT NULL DEFAULT 0
);

-- Cotizaciones guardadas desde el modo Simple
CREATE TABLE IF NOT EXISTS quotes (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  data       JSONB NOT NULL,
  price      NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplies_user ON supplies(user_id);
CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_fixed_user ON fixed_costs(user_id);
CREATE INDEX IF NOT EXISTS idx_recipe_product ON recipe_items(product_id);
CREATE INDEX IF NOT EXISTS idx_steps_product ON process_steps(product_id);
CREATE INDEX IF NOT EXISTS idx_quotes_user ON quotes(user_id);

-- ---------- Aceptación de términos e inicio de sesión social ----------
-- Los usuarios que entran con TikTok no tienen correo, y los que entran con Google o Facebook no
-- tienen contraseña, por eso estas dos columnas aceptan vacío.
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
-- Prueba de la autorización previa, expresa e informada (Ley 1581 de 2012, art. 9)
ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version TEXT;

CREATE TABLE IF NOT EXISTS identities (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  email            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);
CREATE INDEX IF NOT EXISTS idx_identities_user ON identities(user_id);

-- ---------- Cotizador ----------
CREATE TABLE IF NOT EXISTS customers (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  doc        TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL DEFAULT '',
  phone      TEXT NOT NULL DEFAULT '',
  address    TEXT NOT NULL DEFAULT '',
  notes      TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS estimates (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id  INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  number       TEXT NOT NULL DEFAULT '',
  title        TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'Borrador',
  issue_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_days   NUMERIC NOT NULL DEFAULT 15,
  items        JSONB NOT NULL DEFAULT '[]',
  discount_pct NUMERIC NOT NULL DEFAULT 0,
  iva_pct      NUMERIC NOT NULL DEFAULT 0,
  notes        TEXT NOT NULL DEFAULT '',
  total        NUMERIC NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_user ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_estimates_user ON estimates(user_id);

-- ---------- Logo y datos del negocio (salen en las cotizaciones) ----------
ALTER TABLE users ADD COLUMN IF NOT EXISTS logo TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS brand_color TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS biz_nit TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS biz_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS biz_email TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS biz_address TEXT NOT NULL DEFAULT '';

-- ---------- Planes ----------
-- La primera vez que se crean estas columnas, todos los usuarios que ya existían quedan con el plan máximo de por vida.
-- Los que se registren después empiezan en Free.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'plan') THEN
    ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';
    ALTER TABLE users ADD COLUMN plan_period TEXT;
    ALTER TABLE users ADD COLUMN plan_expires_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN plan_lifetime BOOLEAN NOT NULL DEFAULT false;
    UPDATE users SET plan = 'max', plan_lifetime = true;
  END IF;
END $$;

-- ---------- Pagos (Mercado Pago) ----------
-- payment_id único: así un aviso repetido del webhook no suma el plan dos veces.
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'mercadopago',
  payment_id TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL,
  period TEXT NOT NULL,
  amount NUMERIC,
  currency TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);

-- ---------- Suscripciones con cobro automático (PayU Pagos recurrentes) ----------
-- No se guardan datos de tarjeta: PayU guarda la tarjeta y aquí solo quedan sus identificadores.
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'payu',
  external_id TEXT NOT NULL UNIQUE,
  customer_id TEXT,
  plan TEXT NOT NULL,
  period TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  card_last4 TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  canceled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
-- Cliente de Rapyd de cada persona (para su cobro automático).
ALTER TABLE users ADD COLUMN IF NOT EXISTS rapyd_customer TEXT;
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(customer_id);
-- Ids que Rapyd asignó al producto y a cada plan de cobro automático.
CREATE TABLE IF NOT EXISTS rapyd_refs (
  code TEXT PRIMARY KEY,
  rapyd_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
