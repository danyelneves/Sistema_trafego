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
const audit = require('../utils/audit');

const router = express.Router();

router.post('/login', checkAuthRateLimit, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'campos obrigatórios' });

  try {
    const row = await db.get(
      'SELECT id, username, password_hash, display_name, role FROM users WHERE username = $1',
      username
    );
    const meta = audit.fromReq(req);
    if (!row) {
      audit.log('auth.login.failed', { ...meta, actor: `attempt:${username}`, reason: 'user_not_found' });
      return res.status(401).json({ error: 'credenciais inválidas' });
    }

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      audit.log('auth.login.failed', { ...meta, userId: row.id, actor: `user:${row.id}`, reason: 'wrong_password' });
      return res.status(401).json({ error: 'credenciais inválidas' });
    }

    const IS_PROD = process.env.NODE_ENV === 'production';
    const token   = signToken({ id: row.id, username: row.username, role: row.role, name: row.display_name });
    res.cookie('auth', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure:   IS_PROD,
      maxAge:   7 * 24 * 60 * 60 * 1000,
    });
    audit.log('auth.login.success', { ...meta, userId: row.id, actor: `user:${row.id}`, role: row.role });
    res.json({ ok: true, user: { id: row.id, username: row.username, role: row.role, name: row.display_name } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('auth');
  audit.log('auth.logout', audit.fromReq(req));
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.get('/me/features', requireAuth, async (req, res) => {
  try {
    const { getFullFeatureContext } = require('../utils/features');
    const ctx = await getFullFeatureContext(req.user.workspace_id, req.user);
    res.json({ ok: true, ...ctx });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/me/plan', requireAuth, async (req, res) => {
  try {
    const wsId = req.user.workspace_id;
    const plan = await db.get(`
      SELECT p.id, p.key, p.name, p.description, p.price_brl,
             COALESCE(json_agg(json_build_object(
               'key', f.key, 'name', f.name, 'description', f.description,
               'bundle_key', f.bundle_key, 'is_core', f.is_core
             ) ORDER BY f.is_core DESC, f.display_order)
             FILTER (WHERE f.key IS NOT NULL), '[]') AS features
      FROM workspace_plan wp
      JOIN plans p ON p.id = wp.plan_id
      LEFT JOIN plan_features pf ON pf.plan_id = p.id
      LEFT JOIN features f ON f.key = pf.feature_key
      WHERE wp.workspace_id = $1
      GROUP BY p.id
    `, [wsId]);
    const all_plans = await db.all(`
      SELECT id, key, name, description, price_brl, active FROM plans
      WHERE active = true AND key != 'owner'
      ORDER BY price_brl ASC
    `);
    res.json({ ok: true, current: plan, available: all_plans });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/viewer-link', requireAuth, require('../middleware/auth').requireAdmin, (req, res) => {
  const IS_PROD = process.env.NODE_ENV === 'production';
  const token = signToken({ id: 0, username: 'diretoria', role: 'viewer', name: 'Diretoria' });
  const host = req.get('host');
  const protocol = IS_PROD ? 'https' : req.protocol;
  audit.log('auth.viewer_link.generated', audit.fromReq(req));
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
