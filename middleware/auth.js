/**
 * middleware/auth.js — proteção de rotas via cookie JWT.
 */
const jwt = require('jsonwebtoken');

const SECRET    = process.env.JWT_SECRET || 'dev-secret-change-me';
const IS_PROD   = process.env.NODE_ENV === 'production';

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: process.env.JWT_EXPIRES || '7d' });
}

function verifyToken(token) {
  try { return jwt.verify(token, SECRET); }
  catch { return null; }
}

const db = require('../db');

/** Exige autenticação (API JSON). */
async function requireAuth(req, res, next) {
  const token = req.cookies?.auth;
  const user  = token && verifyToken(token);
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  if (user.role === 'viewer') {
    user.workspace_id = user.workspace_id || 1;
    req.user = user;
    return next();
  }

  try {
    const row = await db.get(`
      SELECT u.workspace_id, w.name as workspace_name, w.logo_url, w.theme_color
      FROM users u
      LEFT JOIN workspaces w ON w.id = u.workspace_id
      WHERE u.id = $1
    `, user.id);
    if (!row) return res.status(401).json({ error: 'user not found' });
    user.workspace_id = row.workspace_id || 1;
    user.workspace_name = row.workspace_name || 'Nexus Agência';
    user.logo_url = row.logo_url || null;
    user.theme_color = row.theme_color || null;
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/** Só deixa passar admin; viewer é bloqueado em escrita. */
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  next();
}

module.exports = { signToken, verifyToken, requireAuth, requireAdmin };
