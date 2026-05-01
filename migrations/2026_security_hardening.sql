-- 2026 Security Hardening Migration

-- 1. Idempotência de Webhooks
CREATE TABLE IF NOT EXISTS webhook_events (
  id BIGSERIAL PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,
  external_id VARCHAR(255) NOT NULL,
  payload JSONB,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_processed 
  ON webhook_events(processed_at);

-- 2. Auditoria de Pagamentos
CREATE TABLE IF NOT EXISTS payments_log (
  id BIGSERIAL PRIMARY KEY,
  payment_id VARCHAR(255) NOT NULL,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
  plan VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_log_workspace 
  ON payments_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_payments_log_payment_id 
  ON payments_log(payment_id);

-- 3. Inserção de tokens de webhook do WhatsApp (UUIDs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workspace_settings_ws_key_unique'
  ) THEN
    ALTER TABLE workspace_settings
      ADD CONSTRAINT workspace_settings_ws_key_unique
      UNIQUE (workspace_id, key);
  END IF;
END $$;

INSERT INTO workspace_settings (workspace_id, key, value)
SELECT id, 'whatsapp.webhook.token', gen_random_uuid()::text
FROM workspaces
ON CONFLICT (workspace_id, key) DO NOTHING;

-- 4. Tabela de billing por workspace (movida de routes/billing.js)
CREATE TABLE IF NOT EXISTS workspace_billing (
  workspace_id INTEGER PRIMARY KEY REFERENCES workspaces(id),
  plan_type VARCHAR(50) DEFAULT 'TRIAL',
  credits_limit NUMERIC(10,2) DEFAULT 5.00,
  credits_used NUMERIC(10,2) DEFAULT 0.00
);
