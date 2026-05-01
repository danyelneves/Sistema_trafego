/**
 * utils/sentry.js — wrapper opt-in para captura de erros via Sentry.
 *
 * Comportamento:
 *  - Se SENTRY_DSN está setado, inicializa @sentry/node uma vez.
 *  - Se não, todas as funções viram no-op silencioso (não quebra nada).
 *  - Sample rate de tracing pode ser ajustado via SENTRY_TRACES_SAMPLE_RATE (default 0.1).
 *
 * Setup operacional:
 *  1. Crie projeto Node.js em https://sentry.io (free tier serve)
 *  2. Copie o DSN do projeto
 *  3. Adicione SENTRY_DSN como env var na Vercel (escopo Production)
 *  4. Redeploy. Erros 5xx e exceções não capturadas começam a aparecer.
 */
let _sentry = null;
let _enabled = false;
let _initialized = false;

function init() {
  if (_initialized) return _sentry;
  _initialized = true;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return null;

  try {
    _sentry = require('@sentry/node');
    _sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
      release: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
      // Não captura local (a menos que setado explicitamente)
      enabled: !!dsn,
      // Filtra ruídos comuns
      ignoreErrors: [
        /ECONNRESET/,
        /ETIMEDOUT/,
        /Operation timed out/,
        /aborted/i,
      ],
    });
    _enabled = true;
    console.log(`[sentry] habilitado (env=${process.env.VERCEL_ENV || process.env.NODE_ENV})`);
  } catch (e) {
    // @sentry/node não instalado — segue silencioso
    _enabled = false;
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[sentry] desabilitado: ${e.message}`);
    }
  }
  return _sentry;
}

function isEnabled() {
  if (!_initialized) init();
  return _enabled;
}

function captureException(err, context = {}) {
  if (!isEnabled()) return;
  try {
    _sentry.withScope((scope) => {
      Object.entries(context || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null) scope.setExtra(k, v);
      });
      _sentry.captureException(err);
    });
  } catch { /* nunca deixa erro do Sentry quebrar o app */ }
}

function captureMessage(msg, level = 'info', context = {}) {
  if (!isEnabled()) return;
  try {
    _sentry.withScope((scope) => {
      scope.setLevel(level);
      Object.entries(context || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null) scope.setExtra(k, v);
      });
      _sentry.captureMessage(msg);
    });
  } catch { /* idem */ }
}

/** Middleware Express: captura erros não tratados e envia ao Sentry antes de responder. */
function errorHandler(err, req, res, next) {
  captureException(err, {
    path: req.path,
    method: req.method,
    requestId: req.requestId,
    workspaceId: req.user?.workspace_id,
    userId: req.user?.id,
  });
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Erro interno. Tente novamente em instantes.' : err.message,
    requestId: req.requestId,
  });
}

module.exports = { init, isEnabled, captureException, captureMessage, errorHandler };
