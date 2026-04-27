/**
 * routes/campaigns.js — CRUD de campanhas.
 */
const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { channel, status } = req.query;
    let sql = 'SELECT * FROM campaigns WHERE 1=1';
    const args = [];
    let i = 1;
    if (channel) { sql += ` AND channel = $${i++}`; args.push(channel); }
    if (status)  { sql += ` AND status = $${i++}`;  args.push(status); }
    sql += ' ORDER BY channel, name';
    res.json(await db.all(sql, ...args));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAdmin, async (req, res) => {
  const { channel, name, objective, status = 'active', color } = req.body || {};
  if (!channel || !name) return res.status(400).json({ error: 'channel e name são obrigatórios' });
  if (!['google','meta'].includes(channel)) return res.status(400).json({ error: 'channel inválido' });
  try {
    const row = await db.get(
      `INSERT INTO campaigns (channel, name, objective, status, color)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      channel, name, objective || null, status, color || null
    );
    res.status(201).json(row);
  } catch (e) {
    if (String(e.message).includes('unique') || String(e.code) === '23505')
      return res.status(409).json({ error: 'já existe campanha com esse nome neste canal' });
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const cur = await db.get('SELECT * FROM campaigns WHERE id = $1', id);
    if (!cur) return res.status(404).json({ error: 'não encontrada' });
    const { name, objective, status, color } = req.body || {};
    if (status && !['active','paused','ended'].includes(status))
      return res.status(400).json({ error: 'status inválido (active, paused, ended)' });
    const next = {
      name:      name      ?? cur.name,
      objective: objective ?? cur.objective,
      status:    status    ?? cur.status,
      color:     color     ?? cur.color,
    };
    const row = await db.get(
      `UPDATE campaigns SET name=$1, objective=$2, status=$3, color=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      next.name, next.objective, next.status, next.color, id
    );
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await db.run('DELETE FROM campaigns WHERE id = $1', Number(req.params.id));
    if (!rowCount) return res.status(404).json({ error: 'não encontrada' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
