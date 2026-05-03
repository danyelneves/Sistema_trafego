-- ============================================================
-- Nexus OS — Auto-onboarding (pending_signups)
-- ============================================================
-- Cliente preenche form em /comprar, paga via MP, e o webhook
-- converte o pending_signup em workspace+user+plano automaticamente.
-- Toggle em settings.onboarding.mode = 'manual' | 'auto'
-- ============================================================

CREATE TABLE IF NOT EXISTS pending_signups (
  id              SERIAL PRIMARY KEY,
  email           TEXT NOT NULL,
  name            TEXT NOT NULL,
  workspace_name  TEXT NOT NULL,
  phone           TEXT,
  plan_id         INT NOT NULL REFERENCES plans(id),
  mp_preference_id TEXT,
  payment_id      TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | paid | converted | failed
  workspace_id    INT REFERENCES workspaces(id),
  user_id         INT,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT now(),
  paid_at         TIMESTAMPTZ,
  converted_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pending_signups_email   ON pending_signups(email);
CREATE INDEX IF NOT EXISTS idx_pending_signups_pref    ON pending_signups(mp_preference_id);
CREATE INDEX IF NOT EXISTS idx_pending_signups_payment ON pending_signups(payment_id);
CREATE INDEX IF NOT EXISTS idx_pending_signups_status  ON pending_signups(status);

-- Default: modo manual (você atende cada cliente). Toggle pelo /admin.
INSERT INTO settings (key, value) VALUES ('onboarding.mode', 'manual')
ON CONFLICT (key) DO NOTHING;
