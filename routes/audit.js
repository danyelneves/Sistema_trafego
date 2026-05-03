/**
 * routes/audit.js — consulta do log canônico do sistema.
 *
 * GET /api/audit       → lista paginada com filtros (admin)
 * GET /api/audit/stats → contagem por action nas últimas 24h (admin)
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth, requireAdmin);

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;
    const { action, actor, since } = req.query;

    const where = ['(workspace_id = $1 OR workspace_id IS NULL)'];
    const params = [req.user.workspace_id];

    if (action) { where.push(`action ILIKE $${params.length + 1}`); params.push(`%${action}%`); }
    if (actor)  { where.push(`actor  ILIKE $${params.length + 1}`); params.push(`%${actor}%`); }
    if (since)  { where.push(`ts >= $${params.length + 1}`);          params.push(since); }

    params.push(limit, offset);
    const rows = await db.all(
      `SELECT id, ts, action, actor, user_id, ip, workspace_id, details
       FROM audit_log
       WHERE ${where.join(' AND ')}
       ORDER BY ts DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ ok: true, rows, limit, offset });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT action, COUNT(*)::int AS count, MAX(ts) AS last_at
       FROM audit_log
       WHERE (workspace_id = $1 OR workspace_id IS NULL)
         AND ts > NOW() - INTERVAL '24 hours'
       GROUP BY action
       ORDER BY count DESC
       LIMIT 30`,
      [req.user.workspace_id]
    );
    res.json({ ok: true, window: '24h', rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
