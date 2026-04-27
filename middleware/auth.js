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

/** Exige autenticação (API JSON). */
function requireAuth(req, res, next) {
  const token = req.cookies?.auth;
  const user  = token && verifyToken(token);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  req.user = user;
  next();
}

/** Só deixa passar admin; viewer é bloqueado em escrita. */
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  next();
}

module.exports = { signToken, verifyToken, requireAuth, requireAdmin };
