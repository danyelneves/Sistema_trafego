/**
 * utils/features.js — resolução de features por workspace.
 *
 * Resolução (precedência):
 *   1. is_core = true              → SEMPRE ativo
 *   2. workspace_features override → vale o override
 *   3. workspace_plan + plan_features → resolve via plano
 *   4. nada                         → desligado
 *
 * Owner bypass: usuário com role='admin' no workspace 1 SEMPRE tem
 * acesso, independente de qualquer config (failsafe).
 *
 * Cache: TTL 60s em memória. Invalidação manual via invalidate(wsId).
 */
const db = require('../db');
const log = require('../middleware/logger');

const CACHE_TTL_MS = 60 * 1000;
const _cache = new Map(); // workspace_id → { ts, features: Set, plan: string, limits: Map }

const OWNER_WORKSPACE_ID = 1;

async function _resolve(workspaceId) {
  // Carrega tudo numa query só
  const rows = await db.all(`
    WITH
      core AS (
        SELECT key FROM features WHERE is_core = true
      ),
      ws_overrides AS (
        SELECT feature_key, enabled, limits FROM workspace_features
        WHERE workspace_id = $1
      ),
      plan_feats AS (
        SELECT pf.feature_key, pf.limits
        FROM plan_features pf
        JOIN workspace_plan wp ON wp.plan_id = pf.plan_id
        WHERE wp.workspace_id = $1
      )
    SELECT
      'core' AS source, key AS feature_key, true AS enabled, '{}'::jsonb AS limits FROM core
      UNION ALL
    SELECT 'plan', feature_key, true, limits FROM plan_feats
      UNION ALL
    SELECT 'override', feature_key, enabled, limits FROM ws_overrides
  `, [workspaceId]);

  // Aplica precedência: core (always on) < plan < override
  const enabledMap = new Map();   // key → boolean
  const limitsMap  = new Map();   // key → object

  for (const r of rows) {
    if (r.source === 'core' || (r.source === 'plan' && r.enabled)) {
      enabledMap.set(r.feature_key, true);
      if (r.limits && Object.keys(r.limits).length) limitsMap.set(r.feature_key, r.limits);
    }
  }
  // Override por último
  for (const r of rows) {
    if (r.source === 'override') {
      enabledMap.set(r.feature_key, r.enabled);
      if (r.limits && Object.keys(r.limits).length) limitsMap.set(r.feature_key, r.limits);
    }
  }

  // Plano atual
  const planRow = await db.get(
    'SELECT p.key, p.name FROM plans p JOIN workspace_plan wp ON wp.plan_id = p.id WHERE wp.workspace_id = $1',
    [workspaceId]
  );

  const features = new Set();
  for (const [k, v] of enabledMap) if (v) features.add(k);

  return {
    features,
    limits: limitsMap,
    plan: planRow?.key || null,
    planName: planRow?.name || null,
    cachedAt: Date.now(),
  };
}

async function getFeatures(workspaceId) {
  if (!workspaceId) return null;
  const hit = _cache.get(workspaceId);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;
  try {
    const data = await _resolve(workspaceId);
    _cache.set(workspaceId, { ts: Date.now(), data });
    return data;
  } catch (err) {
    log.error('features: falha ao resolver', err, { workspaceId });
    // Failsafe: se DB falhou, devolve tudo on (não derruba cliente)
    return { features: new Set(['*']), limits: new Map(), plan: 'fallback', planName: 'Fallback (DB err)', cachedAt: Date.now() };
  }
}

/**
 * Verifica se um workspace tem acesso a uma feature.
 * Owner bypass: req.user.role='admin' AND workspace=1 → sempre true.
 */
async function hasFeature(workspaceId, featureKey, opts = {}) {
  if (!featureKey) return true;
  if (opts.user?.role === 'admin' && workspaceId === OWNER_WORKSPACE_ID) return true;
  const data = await getFeatures(workspaceId);
  if (!data) return false;
  if (data.features.has('*')) return true; // failsafe
  return data.features.has(featureKey);
}

function invalidate(workspaceId) {
  if (workspaceId) _cache.delete(workspaceId);
  else _cache.clear();
}

/**
 * Retorna lista de features ativas + bundles + plano.
 * Usado por GET /api/me/features pro frontend.
 */
async function getFullFeatureContext(workspaceId, user) {
  const data = await getFeatures(workspaceId);
  if (!data) return { enabled: [], plan: null, planName: null, isOwner: false };
  const isOwner = user?.role === 'admin' && workspaceId === OWNER_WORKSPACE_ID;
  return {
    enabled: isOwner ? null /* tudo */ : Array.from(data.features),
    isOwner,
    plan: data.plan,
    planName: data.planName,
    limits: Object.fromEntries(data.limits),
  };
}

module.exports = {
  hasFeature,
  getFeatures,
  getFullFeatureContext,
  invalidate,
  OWNER_WORKSPACE_ID,
};
