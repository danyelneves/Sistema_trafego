/**
 * middleware/logger.js — logger persistente em arquivo com rotação diária.
 * Escreve em logs/app-YYYY-MM-DD.log e mantém até KEEP_DAYS arquivos.
 */
const fs   = require('fs');
const path = require('path');

const LOG_DIR   = path.join(__dirname, '..', 'logs');
const KEEP_DAYS = Number(process.env.LOG_KEEP_DAYS) || 30;

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

let _currentDate = '';
let _stream      = null;

function getStream() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== _currentDate) {
    if (_stream) _stream.end();
    _currentDate = today;
    _stream = fs.createWriteStream(
      path.join(LOG_DIR, `app-${today}.log`),
      { flags: 'a', encoding: 'utf8' }
    );
    rotate();
  }
  return _stream;
}

function rotate() {
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
    getStream().write(line);
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
