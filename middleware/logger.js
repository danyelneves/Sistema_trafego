/**
 * middleware/logger.js — logger estruturado para serverless e dev local.
 *
 * Em produção (Vercel/Lambda): emite JSON em uma linha por log.
 *   - Stdout é capturado pelos Runtime Logs da Vercel.
 *   - Sentry captura warn/error automaticamente se SENTRY_DSN estiver setado.
 *   - File logging desativado (filesystem read-only fora de /tmp).
 *
 * Em dev local: emite formato colorido legível e grava em logs/app-YYYY-MM-DD.log
 * com rotação diária (mantém últimos LOG_KEEP_DAYS dias).
 *
 * API:
 *   const log = require('./middleware/logger');
 *   log.info('mensagem', { workspaceId: 1, extra: 'data' });
 *   log.warn('algo estranho', { paymentId: 'abc' });
 *   log.error('falha', err, { context: 'webhook-mp' });
 *   log.debug('detalhe verbose');
 *
 * Compatibilidade legada: ainda exporta log(level, ...args), writeLine, requestLogger.
 */
const fs   = require('fs');
const path = require('path');

const IS_SERVERLESS = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const IS_PROD       = process.env.VERCEL_ENV === 'production' || (!IS_SERVERLESS && process.env.NODE_ENV === 'production');
const LOG_DIR       = IS_SERVERLESS ? null : path.join(__dirname, '..', 'logs');
const KEEP_DAYS     = Number(process.env.LOG_KEEP_DAYS) || 30;
const MIN_LEVEL     = (process.env.LOG_LEVEL || (IS_PROD ? 'info' : 'debug')).toLowerCase();
const LEVELS        = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL_NUM = LEVELS[MIN_LEVEL] || LEVELS.info;

// File logging só em dev local
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

const COLORS = {
  reset: '\x1b[0m', dim: '\x1b[2m',
  debug: '\x1b[90m', info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m',
};

function safeStringify(obj) {
  try {
    return JSON.stringify(obj, (_k, v) => {
      if (v instanceof Error) {
        return { name: v.name, message: v.message, stack: v.stack, code: v.code };
      }
      return v;
    });
  } catch {
    try { return JSON.stringify({ unserializable: String(obj) }); } catch { return '"<unserializable>"'; }
  }
}

function emit(level, message, context) {
  const levelNum = LEVELS[level] || LEVELS.info;
  if (levelNum < MIN_LEVEL_NUM) return;

  const ts = new Date().toISOString();
  const ctx = context && typeof context === 'object' ? context : {};

  if (IS_PROD || IS_SERVERLESS) {
    // JSON estruturado: 1 linha por log, fácil de filtrar nos Runtime Logs da Vercel
    const payload = { ts, level, msg: message, ...ctx };
    const line = safeStringify(payload);
    process.stdout.write(line + '\n');
  } else {
    // Dev: legível e colorido
    const c = COLORS[level] || '';
    const reset = COLORS.reset;
    const ctxStr = Object.keys(ctx).length ? ` ${COLORS.dim}${safeStringify(ctx)}${reset}` : '';
    const line = `${COLORS.dim}[${ts}]${reset} ${c}${level.toUpperCase().padEnd(5)}${reset} ${message}${ctxStr}`;
    process.stdout.write(line + '\n');
    const stream = getStream();
    if (stream) stream.write(`[${ts}] ${level.toUpperCase().padEnd(5)} ${message}${ctxStr.replace(/\x1b\[\d+m/g, '')}\n`);
  }

  // Sentry (lazy-loaded, opt-in via SENTRY_DSN)
  if (levelNum >= LEVELS.warn) {
    try {
      const sentry = require('../utils/sentry');
      if (sentry && sentry.isEnabled()) {
        if (level === 'error' && ctx.err instanceof Error) {
          sentry.captureException(ctx.err, { ...ctx, message });
        } else {
          sentry.captureMessage(message, level, ctx);
        }
      }
    } catch { /* sentry opcional */ }
  }
}

const log = {
  debug: (msg, ctx) => emit('debug', msg, ctx),
  info:  (msg, ctx) => emit('info',  msg, ctx),
  warn:  (msg, ctx) => emit('warn',  msg, ctx),
  error: (msg, errOrCtx, maybeCtx) => {
    let ctx = {};
    if (errOrCtx instanceof Error) {
      ctx = { ...(maybeCtx || {}), err: errOrCtx, errCode: errOrCtx.code };
    } else if (errOrCtx && typeof errOrCtx === 'object') {
      ctx = errOrCtx;
    }
    emit('error', msg, ctx);
  },
};

/** Middleware Express: estrutura cada request HTTP com requestId, ms, status. */
function requestLogger(req, res, next) {
  const t0 = Date.now();
  // Preserva x-vercel-id se existir (rastreamento cross-function da Vercel)
  req.requestId = req.headers['x-vercel-id'] || req.headers['x-request-id'] || `req_${Math.random().toString(36).slice(2, 11)}`;

  res.on('finish', () => {
    if (!req.path.startsWith('/api')) return;
    const ms = Date.now() - t0;
    const ctx = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms,
      requestId: req.requestId,
    };
    if (res.statusCode >= 500) emit('error', `${req.method} ${req.path}`, ctx);
    else if (res.statusCode >= 400) emit('warn', `${req.method} ${req.path}`, ctx);
    else emit('info', `${req.method} ${req.path}`, ctx);
  });
  next();
}

/** Compatibilidade legada: log(level, ...args) e writeLine. */
function legacyLog(level, ...args) {
  emit(String(level || 'info').toLowerCase(), args.map(String).join(' '));
}

function writeLine(parts) {
  emit('info', Array.isArray(parts) ? parts.join(' ') : String(parts));
}

module.exports = {
  // API estruturada (preferida)
  debug: log.debug,
  info: log.info,
  warn: log.warn,
  error: log.error,
  // Compatibilidade legada
  log: legacyLog,
  writeLine,
  requestLogger,
};
