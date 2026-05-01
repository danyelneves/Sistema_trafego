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

-- 3. Inserção de tokens de webhook do WhatsApp (UUIDs)
INSERT INTO workspace_settings (workspace_id, key, value)
SELECT id, 'whatsapp.webhook.token', gen_random_uuid()::text
FROM workspaces
ON CONFLICT (workspace_id, key) DO NOTHING;
