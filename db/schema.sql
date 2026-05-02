-- ============================================================
-- Nexus OS — Schema PostgreSQL (Supabase)
-- ============================================================
-- Execute via: psql $DATABASE_URL -f db/schema.sql
-- Ou pelo painel SQL do Supabase (copie e cole).
-- ============================================================

-- --------------------------------------------------------
-- Workspaces (Clientes da Agência)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS workspaces (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE,
  logo_url      TEXT,
  theme_color   TEXT DEFAULT '#00ADA7',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- Usuários e Acessos
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                   SERIAL PRIMARY KEY,
  username             TEXT    NOT NULL UNIQUE,
  password_hash        TEXT    NOT NULL,
  display_name         TEXT,
  role                 TEXT    NOT NULL DEFAULT 'admin' CHECK(role IN ('admin','viewer')),
  current_workspace_id INTEGER REFERENCES workspaces(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_workspaces (
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id  INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin','viewer')),
  UNIQUE(user_id, workspace_id)
);

-- --------------------------------------------------------
-- Configurações por Workspace (ex: Tokens de API)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS workspace_settings (
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key          TEXT NOT NULL,
  value        TEXT,
  UNIQUE(workspace_id, key)
);

-- --------------------------------------------------------
-- Campanhas
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaigns (
  id           SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
  channel      TEXT    NOT NULL CHECK(channel IN ('google','meta')),
  name        TEXT    NOT NULL,
  objective   TEXT,
  status      TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','ended')),
  color       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(channel, name)
);

CREATE INDEX IF NOT EXISTS idx_campaigns_channel ON campaigns(channel);
CREATE INDEX IF NOT EXISTS idx_campaigns_status  ON campaigns(status);

-- --------------------------------------------------------
-- Métricas diárias
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS metrics_daily (
  id            SERIAL PRIMARY KEY,
  campaign_id   INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  date          DATE    NOT NULL,
  impressions   INTEGER NOT NULL DEFAULT 0,
  clicks        INTEGER NOT NULL DEFAULT 0,
  conversions   INTEGER NOT NULL DEFAULT 0,
  sales         INTEGER NOT NULL DEFAULT 0,
  spend         NUMERIC(14,2) NOT NULL DEFAULT 0,
  revenue       NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, date)
);

CREATE INDEX IF NOT EXISTS idx_metrics_daily_campaign ON metrics_daily(campaign_id);
CREATE INDEX IF NOT EXISTS idx_metrics_daily_date     ON metrics_daily(date);

-- --------------------------------------------------------
-- Dados demográficos e geográficos
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS metrics_demographics (
  id          SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  type        TEXT NOT NULL CHECK(type IN ('region', 'age', 'gender')),
  dimension   TEXT NOT NULL,
  impressions BIGINT DEFAULT 0,
  clicks      BIGINT DEFAULT 0,
  spend       NUMERIC(14,4) DEFAULT 0,
  conversions BIGINT DEFAULT 0,
  UNIQUE(campaign_id, date, type, dimension)
);

CREATE INDEX IF NOT EXISTS idx_metrics_demo_type ON metrics_demographics(type);
CREATE INDEX IF NOT EXISTS idx_metrics_demo_campaign ON metrics_demographics(campaign_id);

-- --------------------------------------------------------
-- Dados Nível de Anúncio (Criativos)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS metrics_ads (
  id            SERIAL PRIMARY KEY,
  campaign_id   INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  ad_id         TEXT NOT NULL,
  ad_name       TEXT,
  thumbnail_url TEXT,
  date          DATE NOT NULL,
  impressions   INTEGER DEFAULT 0,
  clicks        INTEGER DEFAULT 0,
  conversions   INTEGER DEFAULT 0,
  spend         NUMERIC(14,2) DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, ad_id, date)
);

CREATE INDEX IF NOT EXISTS idx_metrics_ads_campaign ON metrics_ads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_metrics_ads_date ON metrics_ads(date);

-- --------------------------------------------------------
-- Vendas (CRM Webhook)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales (
  id             SERIAL PRIMARY KEY,
  workspace_id   INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
  external_id    TEXT UNIQUE,
  client_name    TEXT,
  client_email   TEXT,
  contract_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  status         TEXT,
  channel        TEXT CHECK(channel IN ('google','meta','organic')),
  utm_source     TEXT,
  utm_campaign   TEXT,
  utm_content    TEXT,
  utm_term       TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_channel ON sales(channel);

-- --------------------------------------------------------
-- Metas mensais
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS goals (
  id           SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
  year         INTEGER NOT NULL,
  month       INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
  channel     TEXT    NOT NULL CHECK(channel IN ('google','meta','all')),
  metric      TEXT    NOT NULL,
  target      NUMERIC(14,4) NOT NULL,
  direction   TEXT    NOT NULL DEFAULT 'min' CHECK(direction IN ('min','max')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(year, month, channel, metric)
);

CREATE INDEX IF NOT EXISTS idx_goals_period ON goals(year, month);

-- --------------------------------------------------------
-- Anotações
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS notes (
  id           SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
  year         INTEGER NOT NULL,
  month       INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
  day         INTEGER CHECK(day BETWEEN 1 AND 31),
  channel     TEXT CHECK(channel IN ('google','meta','all')),
  text        TEXT    NOT NULL,
  tag         TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_period ON notes(year, month);

-- --------------------------------------------------------
-- Configurações chave/valor
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

INSERT INTO settings(key, value) VALUES
  ('brand.name',    'Nexus'),
  ('brand.tagline', 'Sistema operacional de IA para vendas'),
  ('theme.primary', '#0099ff')
ON CONFLICT (key) DO NOTHING;

-- --------------------------------------------------------
-- Configurações de alertas de KPI
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS alert_configs (
  id           SERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
  metric       TEXT    NOT NULL,
  channel     TEXT    NOT NULL DEFAULT 'all' CHECK(channel IN ('google','meta','all')),
  threshold   NUMERIC(14,4) NOT NULL,
  direction   TEXT    NOT NULL DEFAULT 'min' CHECK(direction IN ('min','max')),
  email       TEXT    NOT NULL,
  webhook_url TEXT,
  window_days INTEGER DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- Histórico de alertas disparados
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS alert_log (
  id          SERIAL PRIMARY KEY,
  alert_id    INTEGER NOT NULL REFERENCES alert_configs(id) ON DELETE CASCADE,
  year        INTEGER NOT NULL,
  month       INTEGER NOT NULL,
  value       NUMERIC(14,4),
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(alert_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_alert_log_period ON alert_log(year, month);
