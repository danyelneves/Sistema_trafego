/**
 * utils/audit.js — registro de ações sensíveis para auditoria e investigação.
 *
 * Uso:
 *   const audit = require('../utils/audit');
 *   await audit.log('billing.upgrade', {
 *     workspaceId: req.user.workspace_id,
 *     userId: req.user.id,
 *     plan_name,
 *     amount: price,
 *     ip: req.ip,
 *   });
 *
 * A tabela audit_log é criada na primeira chamada (idempotente).
 * Nunca quebra a request principal — falhas de log apenas viram warning.
 */
const db = require('../db');
const log = require('../middleware/logger');

let _ensured = false;

async function ensureTable() {
  if (_ensured) return;
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id BIGSERIAL PRIMARY KEY,
        ts TIMESTAMPTZ DEFAULT NOW(),
        action VARCHAR(100) NOT NULL,
        workspace_id INTEGER,
        user_id INTEGER,
        ip VARCHAR(64),
        details JSONB
      )
    `);
    await db.run('CREATE INDEX IF NOT EXISTS idx_audit_log_action_ts ON audit_log(action, ts DESC)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_audit_log_workspace_ts ON audit_log(workspace_id, ts DESC)');
    _ensured = true;
  } catch (err) {
    log.error('audit: falha ao criar tabela', err);
  }
}

async function logAudit(action, details = {}) {
  try {
    await ensureTable();
    const { workspaceId, userId, ip, ...rest } = details;
    await db.run(
      'INSERT INTO audit_log (action, workspace_id, user_id, ip, details) VALUES ($1, $2, $3, $4, $5)',
      [action, workspaceId || null, userId || null, ip || null, JSON.stringify(rest)]
    );
    log.info(`audit: ${action}`, { workspaceId, userId, ...rest });
  } catch (err) {
    log.error('audit: falha ao gravar', err, { action });
    // não relança — auditoria nunca deve quebrar a operação
  }
}

module.exports = { log: logAudit };
