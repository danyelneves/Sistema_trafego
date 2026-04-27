-- ============================================================
-- Maranet · Central de Tráfego — Schema PostgreSQL (Supabase)
-- ============================================================
-- Execute via: psql $DATABASE_URL -f db/schema.sql
-- Ou pelo painel SQL do Supabase (copie e cole).
-- ============================================================

-- --------------------------------------------------------
-- Usuários
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  display_name  TEXT,
  role          TEXT    NOT NULL DEFAULT 'admin' CHECK(role IN ('admin','viewer')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------
-- Campanhas
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaigns (
  id          SERIAL PRIMARY KEY,
  channel     TEXT    NOT NULL CHECK(channel IN ('google','meta')),
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
  spend         NUMERIC(14,2) NOT NULL DEFAULT 0,
  revenue       NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, date)
);

CREATE INDEX IF NOT EXISTS idx_metrics_date     ON metrics_daily(date);
CREATE INDEX IF NOT EXISTS idx_metrics_campaign ON metrics_daily(campaign_id);

-- --------------------------------------------------------
-- Metas mensais
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS goals (
  id          SERIAL PRIMARY KEY,
  year        INTEGER NOT NULL,
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
  id          SERIAL PRIMARY KEY,
  year        INTEGER NOT NULL,
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
  ('brand.name',    'Maranet Telecom'),
  ('brand.holding', 'NVia Holding e Participações'),
  ('brand.tagline', 'Central de Tráfego'),
  ('theme.primary', '#00ADA7')
ON CONFLICT (key) DO NOTHING;

-- --------------------------------------------------------
-- Configurações de alertas de KPI
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS alert_configs (
  id          SERIAL PRIMARY KEY,
  metric      TEXT    NOT NULL,
  channel     TEXT    NOT NULL DEFAULT 'all' CHECK(channel IN ('google','meta','all')),
  threshold   NUMERIC(14,4) NOT NULL,
  direction   TEXT    NOT NULL DEFAULT 'min' CHECK(direction IN ('min','max')),
  email       TEXT    NOT NULL,
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
