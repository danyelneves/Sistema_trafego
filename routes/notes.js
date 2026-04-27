/**
 * routes/notes.js — CRUD de anotações de contexto.
 */
const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { year, month, channel } = req.query;
    let sql = 'SELECT * FROM notes WHERE 1=1';
    const args = [];
    let i = 1;
    if (year)    { sql += ` AND year = $${i++}`;                              args.push(Number(year)); }
    if (month)   { sql += ` AND month = $${i++}`;                             args.push(Number(month)); }
    if (channel) { sql += ` AND (channel = $${i++} OR channel = 'all')`;      args.push(channel); }
    sql += ' ORDER BY year DESC, month DESC, day DESC, id DESC';
    res.json(await db.all(sql, ...args));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAdmin, async (req, res) => {
  const { year, month, day = null, channel = 'all', text, tag = null } = req.body || {};
  if (!year || !month || !text) return res.status(400).json({ error: 'year, month, text são obrigatórios' });
  try {
    const row = await db.get(
      `INSERT INTO notes (year, month, day, channel, text, tag)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      Number(year), Number(month), day ? Number(day) : null, channel, text, tag
    );
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await db.run('DELETE FROM notes WHERE id = $1', Number(req.params.id));
    if (!rowCount) return res.status(404).json({ error: 'não encontrada' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
