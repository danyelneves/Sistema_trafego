-- ============================================================
-- Nexus OS — Editor de conteúdo da landing page (multi-tenant)
-- ============================================================
-- Permite editar a landing default do sistema (nexusagencia.app/)
-- e landings específicas por tenant (/t/<slug>).
-- Fallback chain ao renderizar:
--   1. Conteúdo publicado do tenant
--   2. Conteúdo publicado do system_default
--   3. DEFAULT_CONTENT hardcoded em utils/landing-content.js
-- ============================================================

CREATE TABLE IF NOT EXISTS landing_page_content (
  id            SERIAL PRIMARY KEY,
  scope         TEXT NOT NULL CHECK (scope IN ('system_default','tenant')),
  workspace_id  INT REFERENCES workspaces(id) ON DELETE CASCADE,
  slug          TEXT,
  content_json  JSONB NOT NULL DEFAULT '{}'::jsonb,    -- rascunho
  published_json JSONB,                                 -- versão publicada
  seo_json      JSONB DEFAULT '{}'::jsonb,
  is_published  BOOLEAN DEFAULT false,
  status        TEXT DEFAULT 'draft',                   -- draft | published
  updated_by    INT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  published_at  TIMESTAMPTZ,
  CONSTRAINT chk_scope_consistency CHECK (
    (scope = 'system_default' AND workspace_id IS NULL) OR
    (scope = 'tenant' AND workspace_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_landing_default ON landing_page_content (scope) WHERE scope = 'system_default';
CREATE UNIQUE INDEX IF NOT EXISTS uq_landing_tenant  ON landing_page_content (workspace_id) WHERE scope = 'tenant';
CREATE INDEX IF NOT EXISTS idx_landing_slug ON landing_page_content (slug) WHERE slug IS NOT NULL;
