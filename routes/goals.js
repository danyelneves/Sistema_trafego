/**
 * routes/goals.js — CRUD de metas mensais.
 */
const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const METRICS = ['cpl','conversions','spend','ctr','roas','impressions','clicks'];

router.get('/', async (req, res) => {
  try {
    const { year, month, channel } = req.query;
    let sql = 'SELECT * FROM goals WHERE workspace_id = $1';
    const args = [req.user.workspace_id];
    let i = 2;
    if (year)    { sql += ` AND year = $${i++}`;    args.push(Number(year)); }
    if (month)   { sql += ` AND month = $${i++}`;   args.push(Number(month)); }
    if (channel) { sql += ` AND channel = $${i++}`; args.push(channel); }
    sql += ' ORDER BY year, month, channel, metric';
    res.json(await db.all(sql, ...args));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAdmin, async (req, res) => {
  const { year, month, channel, metric, target, direction = 'min' } = req.body || {};
  if (!year || !month || !channel || !metric || target == null)
    return res.status(400).json({ error: 'year, month, channel, metric, target são obrigatórios' });
  if (!METRICS.includes(metric)) return res.status(400).json({ error: `metric inválido (${METRICS.join(', ')})` });
  if (!['min','max'].includes(direction)) return res.status(400).json({ error: 'direction deve ser min ou max' });

  try {
    const row = await db.get(
      `INSERT INTO goals (workspace_id, year, month, channel, metric, target, direction)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT(year, month, channel, metric) DO UPDATE SET
         target = EXCLUDED.target,
         direction = EXCLUDED.direction
       RETURNING *`,
      req.user.workspace_id, Number(year), Number(month), channel, metric, Number(target), direction
    );
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await db.run('DELETE FROM goals WHERE id = $1 AND workspace_id = $2', Number(req.params.id), req.user.workspace_id);
    if (!rowCount) return res.status(404).json({ error: 'não encontrada' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
