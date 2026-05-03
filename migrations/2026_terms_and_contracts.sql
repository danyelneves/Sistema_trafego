-- ============================================================
-- Nexus OS — Termos, Privacidade e Contratos
-- ============================================================
-- Compliance LGPD + prova jurídica de aceite.
--
-- terms_versions       → versões dos textos (ToS, Privacidade)
-- terms_acceptances    → cada aceite com IP/UA/timestamp
-- contract_signatures  → "assinatura" do contrato (Fase 2): hash do
--                        conteúdo + dados do signatário, congelado.
-- ============================================================

CREATE TABLE IF NOT EXISTS terms_versions (
  id           SERIAL PRIMARY KEY,
  kind         TEXT NOT NULL CHECK (kind IN ('terms','privacy','contract')),
  version      TEXT NOT NULL,
  title        TEXT NOT NULL,
  content_md   TEXT NOT NULL,
  hash         TEXT NOT NULL,
  is_current   BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(kind, version)
);

-- Só uma versão "is_current=true" por kind por vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_terms_versions_current
  ON terms_versions(kind) WHERE is_current = true;

CREATE TABLE IF NOT EXISTS terms_acceptances (
  id                  SERIAL PRIMARY KEY,
  email               TEXT NOT NULL,
  pending_signup_id   INT REFERENCES pending_signups(id) ON DELETE SET NULL,
  user_id             INT REFERENCES users(id) ON DELETE SET NULL,
  terms_version_id    INT REFERENCES terms_versions(id),
  privacy_version_id  INT REFERENCES terms_versions(id),
  ip                  TEXT,
  user_agent          TEXT,
  accepted_at         TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_terms_acceptances_email   ON terms_acceptances(email);
CREATE INDEX IF NOT EXISTS idx_terms_acceptances_signup  ON terms_acceptances(pending_signup_id);
CREATE INDEX IF NOT EXISTS idx_terms_acceptances_user    ON terms_acceptances(user_id);

CREATE TABLE IF NOT EXISTS contract_signatures (
  id                  SERIAL PRIMARY KEY,
  pending_signup_id   INT REFERENCES pending_signups(id) ON DELETE CASCADE,
  workspace_id        INT REFERENCES workspaces(id) ON DELETE SET NULL,
  user_id             INT REFERENCES users(id) ON DELETE SET NULL,
  acceptance_id       INT REFERENCES terms_acceptances(id),
  contract_version_id INT REFERENCES terms_versions(id),
  contract_html       TEXT NOT NULL,
  contract_hash       TEXT NOT NULL,
  signer_name         TEXT,
  signer_email        TEXT,
  signer_ip           TEXT,
  signer_user_agent   TEXT,
  plan_id             INT REFERENCES plans(id),
  plan_name           TEXT,
  plan_price_brl      NUMERIC,
  signed_at           TIMESTAMPTZ DEFAULT now(),
  metadata            JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_contract_signatures_signup    ON contract_signatures(pending_signup_id);
CREATE INDEX IF NOT EXISTS idx_contract_signatures_workspace ON contract_signatures(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contract_signatures_email     ON contract_signatures(signer_email);
CREATE INDEX IF NOT EXISTS idx_contract_signatures_hash      ON contract_signatures(contract_hash);

-- Coluna em pending_signups pra linkar o aceite
ALTER TABLE pending_signups
  ADD COLUMN IF NOT EXISTS acceptance_id INT REFERENCES terms_acceptances(id);
