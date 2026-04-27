/**
 * routes/users.js — CRUD de usuários (admin only).
 */
const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireAdmin);

const ROLES = ['admin', 'viewer'];

router.get('/', async (req, res) => {
  try {
    const rows = await db.all(
      'SELECT id, username, display_name, role, created_at FROM users ORDER BY id'
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { username, password, display_name, role = 'viewer' } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username e password são obrigatórios' });
  if (!ROLES.includes(role))  return res.status(400).json({ error: `role deve ser: ${ROLES.join(', ')}` });
  if (password.length < 6)    return res.status(400).json({ error: 'senha deve ter ao menos 6 caracteres' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const row = await db.get(
      `INSERT INTO users (username, password_hash, display_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, display_name, role, created_at`,
      username.trim(), hash, display_name?.trim() || null, role
    );
    res.status(201).json(row);
  } catch (e) {
    if (String(e.code) === '23505') return res.status(409).json({ error: 'username já existe' });
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id', async (req, res) => {
  const id  = Number(req.params.id);
  try {
    const cur = await db.get('SELECT * FROM users WHERE id = $1', id);
    if (!cur) return res.status(404).json({ error: 'usuário não encontrado' });

    const { display_name, role, password } = req.body || {};
    if (role && !ROLES.includes(role)) return res.status(400).json({ error: `role deve ser: ${ROLES.join(', ')}` });

    let hash = cur.password_hash;
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'senha deve ter ao menos 6 caracteres' });
      hash = await bcrypt.hash(password, 10);
    }

    const row = await db.get(
      `UPDATE users SET display_name = $1, role = $2, password_hash = $3
       WHERE id = $4
       RETURNING id, username, display_name, role, created_at`,
      display_name !== undefined ? display_name.trim() : cur.display_name,
      role || cur.role,
      hash,
      id
    );
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'não é possível excluir o próprio usuário' });
  try {
    const { rowCount } = await db.run('DELETE FROM users WHERE id = $1', id);
    if (!rowCount) return res.status(404).json({ error: 'usuário não encontrado' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
