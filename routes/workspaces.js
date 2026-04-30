const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', requireAdmin, async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM workspaces ORDER BY name');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name é obrigatório' });
  try {
    const row = await db.get('INSERT INTO workspaces(name) VALUES($1) RETURNING *', name);
    res.status(201).json(row);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/switch', requireAdmin, async (req, res) => {
  const { workspace_id } = req.body;
  if (!workspace_id) return res.status(400).json({ error: 'workspace_id é obrigatório' });
  try {
    const ws = await db.get('SELECT id FROM workspaces WHERE id = $1', workspace_id);
    if (!ws) return res.status(404).json({ error: 'Workspace não encontrado' });

    await db.run('UPDATE users SET current_workspace_id = $1 WHERE id = $2', workspace_id, req.user.id);
    res.json({ ok: true, workspace_id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
