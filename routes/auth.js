/**
 * routes/auth.js — login, logout, /me
 *
 * Rate limiting: máx 10 tentativas de login por IP em 15 minutos.
 */
const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

// ---------- Rate limiter in-memory ----------
const WINDOW_MS    = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const _attempts    = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  let entry = _attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    _attempts.set(ip, entry);
  }
  entry.count++;
  return entry;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of _attempts) {
    if (now > e.resetAt) _attempts.delete(ip);
  }
}, 5 * 60 * 1000);
// --------------------------------------------

router.post('/login', async (req, res) => {
  const ip    = req.ip || req.socket.remoteAddress || 'unknown';
  const entry = checkRateLimit(ip);

  if (entry.count > MAX_ATTEMPTS) {
    const retryAfterSec = Math.ceil((entry.resetAt - Date.now()) / 1000);
    res.set('Retry-After', String(retryAfterSec));
    return res.status(429).json({
      error: `Muitas tentativas. Aguarde ${Math.ceil(retryAfterSec / 60)} minuto(s).`,
    });
  }

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

    _attempts.delete(ip);

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
    maxAge:   30 * 24 * 60 * 60 * 1000, // 30 dias para o link de diretoria
  });
  res.redirect('/');
});

module.exports = router;
