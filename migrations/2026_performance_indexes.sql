-- 2026 Performance Indexes Migration
-- Adiciona índices nas colunas mais consultadas (workspace_id em queries multi-tenant).
-- Reduz latência de queries em ordem de magnitude quando o banco crescer.
--
-- Idempotente: usa IF NOT EXISTS, pode rodar várias vezes sem efeito colateral.

-- Multi-tenant: praticamente toda query tem WHERE workspace_id = ?
CREATE INDEX IF NOT EXISTS idx_metrics_daily_workspace_date
  ON metrics_daily(campaign_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_campaigns_workspace
  ON campaigns(workspace_id);

CREATE INDEX IF NOT EXISTS idx_sales_workspace
  ON sales(workspace_id);

CREATE INDEX IF NOT EXISTS idx_sales_external_id
  ON sales(external_id);

CREATE INDEX IF NOT EXISTS idx_workspace_settings_ws_key
  ON workspace_settings(workspace_id, key);

CREATE INDEX IF NOT EXISTS idx_pixel_events_workspace_created
  ON pixel_events(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_workspace_created
  ON orders(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_funnels_slug
  ON funnels(slug);

CREATE INDEX IF NOT EXISTS idx_market_leads_workspace_created
  ON market_leads(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_log_workspace_ts
  ON alert_log(workspace_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_users_username
  ON users(username);

-- Tabela de auditoria criada pelo utils/audit.js — garantir índices se já existir
CREATE INDEX IF NOT EXISTS idx_audit_log_action_ts
  ON audit_log(action, ts DESC) WHERE action IS NOT NULL;
