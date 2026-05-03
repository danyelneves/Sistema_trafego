-- ============================================================
-- Nexus OS — Sistema de Feature Flags + Planos + Bundles
-- ============================================================
-- Aplicado em prod via Supabase MCP em 2026-05-02.
-- Permite vender Nexus OS de forma modular: cada workspace tem
-- um plano (com features inclusas) + overrides individuais.
--
-- Resolução de acesso (precedência):
--   1. is_core = true              → SEMPRE ativo
--   2. workspace_features override → vale o override
--   3. workspace_plan + plan_features → resolve via plano
--   4. nada                         → desligado (default seguro)
-- ============================================================

CREATE TABLE IF NOT EXISTS bundles (
  key            TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  description    TEXT,
  display_order  INT DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS features (
  key            TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  description    TEXT,
  bundle_key     TEXT REFERENCES bundles(key) ON DELETE SET NULL,
  is_core        BOOLEAN DEFAULT false,
  depends_on     TEXT[] DEFAULT '{}',
  display_order  INT DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plans (
  id             SERIAL PRIMARY KEY,
  key            TEXT UNIQUE NOT NULL,
  name           TEXT NOT NULL,
  description    TEXT,
  price_brl      NUMERIC(10,2) DEFAULT 0,
  active         BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_features (
  plan_id        INT REFERENCES plans(id) ON DELETE CASCADE,
  feature_key    TEXT REFERENCES features(key) ON DELETE CASCADE,
  limits         JSONB DEFAULT '{}'::jsonb,
  PRIMARY KEY (plan_id, feature_key)
);

CREATE TABLE IF NOT EXISTS workspace_plan (
  workspace_id   INT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  plan_id        INT REFERENCES plans(id) ON DELETE RESTRICT,
  assigned_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_features (
  workspace_id   INT REFERENCES workspaces(id) ON DELETE CASCADE,
  feature_key    TEXT REFERENCES features(key) ON DELETE CASCADE,
  enabled        BOOLEAN NOT NULL,
  limits         JSONB DEFAULT '{}'::jsonb,
  reason         TEXT,
  updated_at     TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (workspace_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_features_bundle      ON features(bundle_key);
CREATE INDEX IF NOT EXISTS idx_workspace_features_ws ON workspace_features(workspace_id);

-- Seeds (bundles, features, planos, atribuição inicial) aplicados via MCP
-- — ver commit que adiciona este arquivo pra reaplicar em outro ambiente.
