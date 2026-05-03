/**
 * utils/limits.js — enforcement de quotas por feature.
 *
 * Padrão de uso:
 *   const limits = require('../utils/limits');
 *
 *   // No handler de uma rota que executa ação cara (Skynet, Studio, etc):
 *   const allowed = await limits.check(req.user.workspace_id, 'skynet', 'calls_per_day', 1);
 *   if (!allowed.ok) {
 *     return res.status(429).json({
 *       error: 'limit_exceeded',
 *       feature: 'skynet',
 *       limit: allowed.limit,
 *       used: allowed.used,
 *     });
 *   }
 *   // ... executa a ação
 *   await limits.record(req.user.workspace_id, 'skynet', 'calls_per_day', 1);
 *
 * Resolução do limite (precedência):
 *   1. workspace_features[ws].limits[key]   (override individual)
 *   2. plan_features[plan].limits[key]      (default do plano)
 *   3. sem limite                            (deixa passar)
 *
 * Owner sempre passa, sem limite.
 *
 * Persistência: tabela feature_usage_daily (workspace_id, feature_key,
 * limit_key, day, count). Reset automático por janela de tempo (UTC).
 */
const db = require('../db');
const log = require('../middleware/logger');
const { getFeatures } = require('./features');

const OWNER_WORKSPACE_ID = 1;

async function _ensureTable() {
  await db.run(`
    CREATE TABLE IF NOT EXISTS feature_usage_daily (
      workspace_id INT NOT NULL,
      feature_key  TEXT NOT NULL,
      limit_key    TEXT NOT NULL,
      day          DATE NOT NULL DEFAULT CURRENT_DATE,
      count        INT NOT NULL DEFAULT 0,
      updated_at   TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (workspace_id, feature_key, limit_key, day)
    )
  `);
}
let _ensured = false;
async function _ready() { if (!_ensured) { await _ensureTable(); _ensured = true; } }

async function _resolveLimit(workspaceId, featureKey, limitKey) {
  // override
  const ovr = await db.get(
    `SELECT limits FROM workspace_features WHERE workspace_id = $1 AND feature_key = $2`,
    [workspaceId, featureKey]
  );
  if (ovr?.limits && ovr.limits[limitKey] != null) return Number(ovr.limits[limitKey]);
  // plano
  const planLimit = await db.get(`
    SELECT pf.limits
    FROM plan_features pf
    JOIN workspace_plan wp ON wp.plan_id = pf.plan_id
    WHERE wp.workspace_id = $1 AND pf.feature_key = $2
  `, [workspaceId, featureKey]);
  if (planLimit?.limits && planLimit.limits[limitKey] != null) return Number(planLimit.limits[limitKey]);
  return null; // sem limite
}

/**
 * Verifica se workspace ainda tem quota.
 * @returns {Promise<{ok: boolean, limit: number|null, used: number, remaining: number|null}>}
 */
async function check(workspaceId, featureKey, limitKey = 'calls_per_day', cost = 1, opts = {}) {
  if (opts.user?.role === 'admin' && workspaceId === OWNER_WORKSPACE_ID) {
    return { ok: true, limit: null, used: 0, remaining: null, isOwner: true };
  }
  await _ready();
  const limit = await _resolveLimit(workspaceId, featureKey, limitKey);
  if (limit == null) return { ok: true, limit: null, used: 0, remaining: null };

  const row = await db.get(`
    SELECT count FROM feature_usage_daily
    WHERE workspace_id = $1 AND feature_key = $2 AND limit_key = $3 AND day = CURRENT_DATE
  `, [workspaceId, featureKey, limitKey]);
  const used = row?.count || 0;
  const remaining = Math.max(0, limit - used);
  return { ok: used + cost <= limit, limit, used, remaining };
}

/** Registra consumo (após executar ação) */
async function record(workspaceId, featureKey, limitKey = 'calls_per_day', cost = 1) {
  try {
    await _ready();
    await db.run(`
      INSERT INTO feature_usage_daily (workspace_id, feature_key, limit_key, day, count)
      VALUES ($1, $2, $3, CURRENT_DATE, $4)
      ON CONFLICT (workspace_id, feature_key, limit_key, day)
      DO UPDATE SET count = feature_usage_daily.count + $4, updated_at = now()
    `, [workspaceId, featureKey, limitKey, cost]);
  } catch (err) {
    log.error('limits.record falhou', err, { workspaceId, featureKey });
    // não relança — limit accounting nunca deve quebrar a ação
  }
}

/**
 * Atalho: verifica + (se ok) registra. Retorna ok/falsa.
 * Não atomico (small race possível em alta concorrência), aceitável pra MVP.
 */
async function checkAndRecord(workspaceId, featureKey, limitKey = 'calls_per_day', cost = 1, opts = {}) {
  const r = await check(workspaceId, featureKey, limitKey, cost, opts);
  if (r.ok) await record(workspaceId, featureKey, limitKey, cost);
  return r;
}

module.exports = { check, record, checkAndRecord };
