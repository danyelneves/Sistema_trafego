/**
 * middleware/logger.js — logger persistente em arquivo com rotação diária.
 *
 * Em ambiente serverless (Vercel/AWS Lambda) o filesystem é read-only fora de
 * /tmp, então o file logging fica desativado e tudo cai apenas em stdout
 * (capturado pelos Runtime Logs da Vercel automaticamente).
 */
const fs   = require('fs');
const path = require('path');

const IS_SERVERLESS = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const LOG_DIR   = IS_SERVERLESS ? null : path.join(__dirname, '..', 'logs');
const KEEP_DAYS = Number(process.env.LOG_KEEP_DAYS) || 30;

let _fileLoggingEnabled = false;
if (!IS_SERVERLESS && LOG_DIR) {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    _fileLoggingEnabled = true;
  } catch (e) {
    console.warn(`[logger] file logging desativado: ${e.message}`);
  }
}

let _currentDate = '';
let _stream      = null;

function getStream() {
  if (!_fileLoggingEnabled) return null;
  const today = new Date().toISOString().slice(0, 10);
  if (today !== _currentDate) {
    if (_stream) { try { _stream.end(); } catch {} }
    _currentDate = today;
    try {
      _stream = fs.createWriteStream(
        path.join(LOG_DIR, `app-${today}.log`),
        { flags: 'a', encoding: 'utf8' }
      );
      rotate();
    } catch {
      _stream = null;
      _fileLoggingEnabled = false;
    }
  }
  return _stream;
}

function rotate() {
  if (!_fileLoggingEnabled || !LOG_DIR) return;
  try {
    const files = fs.readdirSync(LOG_DIR)
      .filter(f => f.startsWith('app-') && f.endsWith('.log'))
      .sort();
    const toDelete = files.slice(0, Math.max(0, files.length - KEEP_DAYS));
    toDelete.forEach(f => {
      try { fs.unlinkSync(path.join(LOG_DIR, f)); } catch {}
    });
  } catch {}
}

function writeLine(parts) {
  try {
    const ts   = new Date().toISOString();
    const line = `[${ts}] ${parts.join(' ')}\n`;
    process.stdout.write(line);
    const stream = getStream();
    if (stream) stream.write(line);
  } catch {}
}

/** Middleware Express: loga método, status, path e ms de cada request à API. */
function requestLogger(req, res, next) {
  const t0 = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api')) {
      writeLine([req.method.padEnd(6), res.statusCode, req.path, `${Date.now() - t0}ms`]);
    }
  });
  next();
}

/** Log de aplicação genérico. */
function log(level, ...args) {
  writeLine([`[${level.toUpperCase()}]`, ...args.map(String)]);
}

module.exports = { requestLogger, log, writeLine };
