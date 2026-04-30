const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);
router.use(requireAdmin);

router.get('/', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM automations WHERE workspace_id = $1 ORDER BY created_at DESC', req.user.workspace_id);
    res.json(rows || []);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  const { name, metric, operator, value, action } = req.body;
  if (!name || !metric || !operator || value === undefined || !action) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }
  
  try {
    const sql = `
      INSERT INTO automations (workspace_id, name, metric, operator, value, action)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `;
    const row = await db.get(sql, req.user.workspace_id, name, metric, operator, Number(value), action);
    res.status(201).json(row);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM automations WHERE id = $1 AND workspace_id = $2', Number(req.params.id), req.user.workspace_id);
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id/toggle', async (req, res) => {
  try {
    const { active } = req.body;
    await db.run('UPDATE automations SET active = $1 WHERE id = $2 AND workspace_id = $3', active, Number(req.params.id), req.user.workspace_id);
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
