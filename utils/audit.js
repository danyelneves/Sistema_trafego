/**
 * utils/audit.js — log canônico de eventos do sistema.
 *
 * Tabela: audit_log (criada via migrations/2026_audit_log.sql + 2026_audit_log_unify.sql)
 * Schema: id, ts, action, workspace_id, user_id, ip, actor, details (JSONB)
 *
 * Uso simples (signature legada, retrocompatível):
 *   audit.log('billing.upgrade.approved', { workspaceId, userId, ip, plan, amount });
 *
 * Uso novo (com actor explícito pra eventos sem user — system/scheduled-task/webhook):
 *   audit.log('cleanup.shim_removed', { actor: 'scheduled-task:foo', workspaceId, pr_url });
 *
 * Helpers:
 *   audit.fromReq(req)      → { userId, ip, workspaceId, actor }
 *   audit.cleanup()         → deleta entries > AUDIT_RETENTION_DAYS (default 90)
 *
 * Fire-and-forget: erros viram warning no logger, nunca quebram a request.
 */
const db = require('../db');
const log = require('../middleware/logger');

const RETENTION_DAYS = parseInt(process.env.AUDIT_RETENTION_DAYS || '90', 10);

const SECRET_PATTERNS = /apikey|api_key|secret|token|password|credit|hash/i;
function maskSecrets(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (SECRET_PATTERNS.test(k) && typeof v === 'string') {
      out[k] = v.length > 6 ? `${v.slice(0, 3)}***${v.slice(-2)}` : '***';
    } else if (v && typeof v === 'object') {
      out[k] = maskSecrets(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function logAudit(action, details = {}) {
  try {
    const { workspaceId, userId, ip, actor, ...rest } = details;
    const safeDetails = maskSecrets(rest);
    const finalActor = actor || (userId ? `user:${userId}` : 'system');
    await db.run(
      'INSERT INTO audit_log (action, workspace_id, user_id, ip, actor, details) VALUES ($1, $2, $3, $4, $5, $6)',
      [action, workspaceId || null, userId || null, ip || null, finalActor, JSON.stringify(safeDetails)]
    );
  } catch (err) {
    log.error('audit: falha ao gravar', err, { action });
    // não relança — auditoria nunca deve quebrar a operação
  }
}

function fromReq(req) {
  return {
    userId: req?.user?.id || null,
    workspaceId: req?.user?.workspace_id || null,
    ip: req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
      || req?.ip
      || req?.connection?.remoteAddress
      || null,
    actor: req?.user?.id ? `user:${req.user.id}` : 'anonymous',
  };
}

async function cleanup() {
  try {
    const result = await db.run(
      `DELETE FROM audit_log WHERE ts < NOW() - INTERVAL '${RETENTION_DAYS} days'`
    );
    log.info(`audit: cleanup removeu entries > ${RETENTION_DAYS}d`, { rowCount: result?.rowCount });
    return result?.rowCount || 0;
  } catch (err) {
    log.error('audit: falha no cleanup', err);
    return 0;
  }
}

module.exports = { log: logAudit, fromReq, cleanup };
