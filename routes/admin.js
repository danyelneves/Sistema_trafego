/**
 * routes/admin.js — gestão de planos, features, atribuições.
 *
 * Toda rota aqui exige admin no workspace owner (id=1).
 * Pra evitar acidente de admin de cliente futuro alterar planos
 * globais, restringimos por workspace_id=1.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const audit = require('../utils/audit');
const { invalidate } = require('../utils/features');

const OWNER_WORKSPACE_ID = 1;

router.use(requireAuth, requireAdmin, (req, res, next) => {
  if (req.user.workspace_id !== OWNER_WORKSPACE_ID) {
    return res.status(403).json({ error: 'admin_only', message: 'Apenas admin do workspace owner' });
  }
  next();
});

// ============================================================
// PLANOS
// ============================================================

/** GET /api/admin/plans — lista planos + features inclusas + count workspaces */
router.get('/plans', async (req, res) => {
  try {
    const plans = await db.all(`
      SELECT p.id, p.key, p.name, p.description, p.price_brl, p.active, p.created_at,
             COALESCE(json_agg(DISTINCT pf.feature_key) FILTER (WHERE pf.feature_key IS NOT NULL), '[]') AS features,
             COUNT(DISTINCT wp.workspace_id) AS workspace_count
      FROM plans p
      LEFT JOIN plan_features pf ON pf.plan_id = p.id
      LEFT JOIN workspace_plan wp ON wp.plan_id = p.id
      GROUP BY p.id
      ORDER BY p.price_brl ASC, p.id ASC
    `);
    res.json({ ok: true, plans });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/admin/plans — cria plano */
router.post('/plans', async (req, res) => {
  try {
    const { key, name, description, price_brl, active = true, features = [] } = req.body || {};
    if (!key || !name) return res.status(400).json({ error: 'key e name obrigatórios' });

    const plan = await db.get(
      `INSERT INTO plans (key, name, description, price_brl, active)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [key, name, description || null, price_brl || 0, active]
    );

    if (features.length) {
      const values = features.map((_, i) => `($1, $${i + 2})`).join(',');
      await db.run(`INSERT INTO plan_features (plan_id, feature_key) VALUES ${values}
                    ON CONFLICT DO NOTHING`, [plan.id, ...features]);
    }

    audit.log('admin.plan.created', { ...audit.fromReq(req), plan: plan.key, features });
    res.json({ ok: true, plan });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** PUT /api/admin/plans/:id — edita plano (nome, preço, active, features) */
router.put('/plans/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, description, price_brl, active, features } = req.body || {};

    const existing = await db.get('SELECT * FROM plans WHERE id = $1', [id]);
    if (!existing) return res.status(404).json({ error: 'plan not found' });

    await db.run(
      `UPDATE plans SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         price_brl = COALESCE($3, price_brl),
         active = COALESCE($4, active)
       WHERE id = $5`,
      [name ?? null, description ?? null, price_brl ?? null, active ?? null, id]
    );

    if (Array.isArray(features)) {
      // Substitui features inteiramente
      await db.run('DELETE FROM plan_features WHERE plan_id = $1', [id]);
      if (features.length) {
        const values = features.map((_, i) => `($1, $${i + 2})`).join(',');
        await db.run(`INSERT INTO plan_features (plan_id, feature_key) VALUES ${values}
                      ON CONFLICT DO NOTHING`, [id, ...features]);
      }
    }

    // Invalida cache de todos workspaces que usam esse plano
    const wsIds = await db.all('SELECT workspace_id FROM workspace_plan WHERE plan_id = $1', [id]);
    wsIds.forEach(w => invalidate(w.workspace_id));

    audit.log('admin.plan.updated', { ...audit.fromReq(req), plan_id: id, features });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** DELETE /api/admin/plans/:id — remove plano (se nenhum workspace tiver) */
router.delete('/plans/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const inUse = await db.get('SELECT COUNT(*)::int AS n FROM workspace_plan WHERE plan_id = $1', [id]);
    if (inUse.n > 0) return res.status(400).json({ error: 'plan_in_use', count: inUse.n });

    const plan = await db.get('SELECT key FROM plans WHERE id = $1', [id]);
    if (plan?.key === 'owner') return res.status(400).json({ error: 'cannot_delete_owner' });

    await db.run('DELETE FROM plans WHERE id = $1', [id]);
    audit.log('admin.plan.deleted', { ...audit.fromReq(req), plan_id: id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// FEATURES + BUNDLES (catálogo, read-only via UI)
// ============================================================

/** GET /api/admin/features — catálogo de features agrupadas por bundle */
router.get('/features', async (req, res) => {
  try {
    const features = await db.all(`
      SELECT f.key, f.name, f.description, f.bundle_key, f.is_core, f.depends_on, f.display_order,
             b.name AS bundle_name
      FROM features f
      LEFT JOIN bundles b ON b.key = f.bundle_key
      ORDER BY f.is_core DESC, b.display_order, f.display_order
    `);
    const bundles = await db.all('SELECT * FROM bundles ORDER BY display_order');
    res.json({ ok: true, features, bundles });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// WORKSPACES — atribuir/ver plano
// ============================================================

/** GET /api/admin/workspaces — lista todos os workspaces + plano atual */
router.get('/workspaces', async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT w.id, w.name, w.created_at,
             p.id AS plan_id, p.key AS plan_key, p.name AS plan_name, p.price_brl,
             wp.assigned_at,
             (SELECT COUNT(*)::int FROM users u WHERE u.workspace_id = w.id) AS users
      FROM workspaces w
      LEFT JOIN workspace_plan wp ON wp.workspace_id = w.id
      LEFT JOIN plans p ON p.id = wp.plan_id
      ORDER BY w.id
    `);
    res.json({ ok: true, workspaces: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** PUT /api/admin/workspaces/:id/plan — atribui plano a workspace */
router.put('/workspaces/:id/plan', async (req, res) => {
  try {
    const wsId = parseInt(req.params.id, 10);
    const { plan_id, plan_key } = req.body || {};
    let resolvedPlanId = plan_id;
    if (!resolvedPlanId && plan_key) {
      const p = await db.get('SELECT id FROM plans WHERE key = $1', [plan_key]);
      if (!p) return res.status(400).json({ error: 'plan_not_found' });
      resolvedPlanId = p.id;
    }
    if (!resolvedPlanId) return res.status(400).json({ error: 'plan_id ou plan_key obrigatório' });

    await db.run(`
      INSERT INTO workspace_plan (workspace_id, plan_id, assigned_at)
      VALUES ($1, $2, now())
      ON CONFLICT (workspace_id) DO UPDATE
      SET plan_id = EXCLUDED.plan_id, assigned_at = now()
    `, [wsId, resolvedPlanId]);

    invalidate(wsId);
    audit.log('admin.workspace.plan_assigned', {
      ...audit.fromReq(req), target_workspace_id: wsId, plan_id: resolvedPlanId,
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** PUT /api/admin/workspaces/:id/feature/:key — override de feature individual */
router.put('/workspaces/:id/feature/:key', async (req, res) => {
  try {
    const wsId = parseInt(req.params.id, 10);
    const featureKey = req.params.key;
    const { enabled, limits, reason } = req.body || {};
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled (bool) obrigatório' });

    await db.run(`
      INSERT INTO workspace_features (workspace_id, feature_key, enabled, limits, reason, updated_at)
      VALUES ($1, $2, $3, $4, $5, now())
      ON CONFLICT (workspace_id, feature_key) DO UPDATE
      SET enabled = EXCLUDED.enabled, limits = EXCLUDED.limits, reason = EXCLUDED.reason, updated_at = now()
    `, [wsId, featureKey, enabled, JSON.stringify(limits || {}), reason || null]);

    invalidate(wsId);
    audit.log('admin.workspace.feature_override', {
      ...audit.fromReq(req), target_workspace_id: wsId, feature: featureKey, enabled, reason,
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** DELETE /api/admin/workspaces/:id/feature/:key — remove override (volta pro plano) */
router.delete('/workspaces/:id/feature/:key', async (req, res) => {
  try {
    const wsId = parseInt(req.params.id, 10);
    const featureKey = req.params.key;
    await db.run('DELETE FROM workspace_features WHERE workspace_id = $1 AND feature_key = $2', [wsId, featureKey]);
    invalidate(wsId);
    audit.log('admin.workspace.feature_override_removed', { ...audit.fromReq(req), target_workspace_id: wsId, feature: featureKey });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// ONBOARDING MODE (toggle manual / auto)
// ============================================================

/** GET /api/admin/onboarding — modo atual + signups recentes */
router.get('/onboarding', async (req, res) => {
  try {
    const setting = await db.get(`SELECT value FROM settings WHERE key = 'onboarding.mode'`);
    const recent = await db.all(`
      SELECT s.id, s.email, s.name, s.workspace_name, s.status, s.created_at, s.paid_at, s.converted_at,
             p.name AS plan_name, p.price_brl
      FROM pending_signups s
      LEFT JOIN plans p ON p.id = s.plan_id
      ORDER BY s.created_at DESC LIMIT 50
    `);
    const stats = await db.get(`
      SELECT
        COUNT(*) FILTER (WHERE status='pending')   AS pending,
        COUNT(*) FILTER (WHERE status='paid')      AS paid,
        COUNT(*) FILTER (WHERE status='converted') AS converted,
        COUNT(*) FILTER (WHERE status='failed')    AS failed
      FROM pending_signups
    `);
    res.json({ ok: true, mode: setting?.value || 'manual', signups: recent, stats });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** PUT /api/admin/onboarding — alterna modo (manual/auto) */
router.put('/onboarding', async (req, res) => {
  try {
    const { mode } = req.body || {};
    if (!['manual', 'auto'].includes(mode)) {
      return res.status(400).json({ error: 'mode deve ser manual ou auto' });
    }
    await db.run(
      `INSERT INTO settings (key, value) VALUES ('onboarding.mode', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [mode]
    );
    audit.log('admin.onboarding.mode_changed', { ...audit.fromReq(req), mode });
    res.json({ ok: true, mode });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
