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
    const row = await db.get('SELECT current_workspace_id FROM users WHERE id = $1', user.id);
    if (!row) return res.status(401).json({ error: 'user not found' });
    user.workspace_id = row.current_workspace_id || 1;
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
