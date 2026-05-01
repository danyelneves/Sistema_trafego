/**
 * utils/retry.js — wrapper de retry com exponential backoff para chamadas externas.
 *
 * Uso:
 *   const { retry } = require('../utils/retry');
 *   const data = await retry(() => axios.get(url, { timeout: 8000 }), {
 *     attempts: 3,
 *     baseDelayMs: 500,
 *     onRetry: (err, attempt) => log.warn('retry', { attempt, err: err.message }),
 *   });
 *
 * Retentativa só em erros transientes (timeout, 5xx, ECONNRESET).
 * 4xx (cliente) NÃO é retentado — é erro nosso, retry não vai consertar.
 */
const log = require('../middleware/logger');

const TRANSIENT_CODES = new Set(['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ENOTFOUND']);

function isTransientError(err) {
  if (!err) return false;
  if (TRANSIENT_CODES.has(err.code)) return true;
  if (err.message && /timeout|aborted|network/i.test(err.message)) return true;
  // axios: status 5xx é transient, 4xx não
  const status = err.response?.status;
  if (typeof status === 'number') {
    if (status >= 500 && status < 600) return true;
    if (status === 429) return true; // rate limit
    return false;
  }
  return true; // sem status (provavelmente network) → transient
}

async function retry(fn, opts = {}) {
  const {
    attempts = 3,
    baseDelayMs = 500,
    maxDelayMs = 8000,
    factor = 2,
    onRetry = null,
    shouldRetry = isTransientError,
  } = opts;

  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isLast = attempt === attempts;
      const transient = shouldRetry(err);

      if (isLast || !transient) {
        if (transient) log.warn('retry esgotado', { attempts, err: err.message, code: err.code });
        throw err;
      }

      const delay = Math.min(maxDelayMs, baseDelayMs * Math.pow(factor, attempt - 1));
      const jitter = Math.random() * delay * 0.2; // até 20% jitter pra evitar thundering herd
      const wait = Math.floor(delay + jitter);

      if (onRetry) {
        try { onRetry(err, attempt, wait); } catch {}
      } else {
        log.debug('retry', { attempt, attempts, wait_ms: wait, err: err.message });
      }

      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

module.exports = { retry, isTransientError };
