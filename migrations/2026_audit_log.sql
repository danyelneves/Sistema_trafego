-- ============================================================
-- Nexus OS — audit_log
-- ============================================================
-- Tabela canônica de eventos do sistema. Lida pelo dashboard
-- (rota /api/dashboard) e usada por jobs autônomos pra deixar
-- rastro do que foi feito sem precisar acionar o usuário.
--
-- Convenções:
--   actor   → 'user:<id>' | 'system' | 'scheduled-task:<id>' | 'webhook:<provider>'
--   action  → notação dotted: 'rebrand.completed', 'cleanup.shim_removed', etc.
--   details → JSONB livre, idealmente inclui pr_url/commit_sha/note quando relevante
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id           BIGSERIAL PRIMARY KEY,
  workspace_id INTEGER REFERENCES workspaces(id) ON DELETE SET NULL,
  actor        TEXT NOT NULL,
  action       TEXT NOT NULL,
  details      JSONB DEFAULT '{}'::jsonb,
  ts           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_ts            ON audit_log (ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_workspace_ts  ON audit_log (workspace_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action        ON audit_log (action);
