/**
 * utils/idempotency.js — verificação de idempotência de webhooks via tabela webhook_events.
 *
 * Uso (qualquer route handler de webhook):
 *   const { checkIdempotency } = require('../utils/idempotency');
 *   const isDup = await checkIdempotency('mercadopago', paymentId, req.body);
 *   if (isDup) return res.status(200).json({ ok: true, duplicate: true });
 *
 * A tabela webhook_events tem UNIQUE(provider, external_id). Qualquer INSERT duplicado
 * lança erro 23505 (unique_violation), que indica replay e retorna true.
 *
 * Outros erros (tabela não existe, rede caiu) lançam — quem chamou decide o que fazer.
 */
const db = require('../db');
const log = require('../middleware/logger');

async function checkIdempotency(provider, externalId, payload) {
  if (!provider || !externalId) {
    log.warn('checkIdempotency chamado sem provider ou externalId', { provider, externalId });
    return false; // sem chave, não dá pra deduplicar — deixa passar
  }

  try {
    await db.run(
      'INSERT INTO webhook_events (provider, external_id, payload) VALUES ($1, $2, $3)',
      [provider, String(externalId), JSON.stringify(payload || {})]
    );
    return false; // não é duplicado
  } catch (error) {
    if (error.code === '23505' || /unique constraint|UNIQUE/.test(error.message || '')) {
      log.debug('idempotency: duplicado', { provider, externalId });
      return true;
    }
    log.error('idempotency: falha inesperada', error, { provider, externalId });
    throw error;
  }
}

module.exports = { checkIdempotency };
