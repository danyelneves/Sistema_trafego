/**
 * routes/auth.js — login, logout, /me
 *
 * Rate limiting: máx 10 tentativas de login por IP em 15 minutos.
 */
const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');
const { checkAuthRateLimit } = require('../middleware/ratelimit');

const router = express.Router();

router.post('/login', checkAuthRateLimit, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'campos obrigatórios' });

  try {
    const row = await db.get(
      'SELECT id, username, password_hash, display_name, role FROM users WHERE username = $1',
      username
    );
    if (!row) return res.status(401).json({ error: 'credenciais inválidas' });

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok)  return res.status(401).json({ error: 'credenciais inválidas' });

    const IS_PROD = process.env.NODE_ENV === 'production';
    const token   = signToken({ id: row.id, username: row.username, role: row.role, name: row.display_name });
    res.cookie('auth', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure:   IS_PROD,
      maxAge:   7 * 24 * 60 * 60 * 1000,
    });
    res.json({ ok: true, user: { id: row.id, username: row.username, role: row.role, name: row.display_name } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('auth');
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.get('/viewer-link', requireAuth, require('../middleware/auth').requireAdmin, (req, res) => {
  const IS_PROD = process.env.NODE_ENV === 'production';
  const token = signToken({ id: 0, username: 'diretoria', role: 'viewer', name: 'Diretoria' });
  const host = req.get('host');
  const protocol = IS_PROD ? 'https' : req.protocol;
  res.json({ link: `${protocol}://${host}/api/auth/login-link?token=${token}` });
});

router.get('/login-link', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Token inválido');
  const { verifyToken } = require('../middleware/auth');
  const user = verifyToken(token);
  if (!user || user.role !== 'viewer') return res.status(401).send('Token inválido ou expirado');
  
  const IS_PROD = process.env.NODE_ENV === 'production';
  res.cookie('auth', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure:   IS_PROD,
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 dias para o link de diretoria
  });
  res.redirect('/');
});

module.exports = router;
