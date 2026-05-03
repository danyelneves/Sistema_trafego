/**
 * middleware/feature-gate.js — protege rotas por feature flag.
 *
 * Uso:
 *   app.use('/api/sentinel', requireAuth, requireFeature('sentinel'), require('./routes/sentinel'));
 *
 * Comportamento:
 *   - Owner (admin no workspace 1) sempre passa
 *   - Se feature habilitada para o workspace, passa
 *   - Senão: 403 + audit_log
 */
const { hasFeature } = require('../utils/features');
const { requireAuth } = require('./auth');
const audit = require('../utils/audit');

/**
 * Gate combinado: autentica + verifica feature.
 *
 * Comportamento:
 *   1. Se Bearer CRON_SECRET válido → bypass total (cron interno da Vercel)
 *   2. Senão, exige cookie JWT válido (requireAuth)
 *   3. Verifica se workspace tem a feature
 *   4. Owner (admin no ws=1) sempre passa
 */
function requireFeature(featureKey) {
  return async (req, res, next) => {
    // 1. Bypass pra crons internos
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers.authorization === `Bearer ${cronSecret}`) {
      return next();
    }

    // 2. Garante autenticação. requireAuth chama next() se ok ou response 401 se não.
    await new Promise((resolve, reject) => {
      requireAuth(req, res, (err) => {
        if (err || res.headersSent) return reject(err || new Error('auth-failed'));
        resolve();
      });
    }).catch(() => null);
    if (res.headersSent) return; // requireAuth já respondeu 401

    const wsId = req.user?.workspace_id;
    if (!wsId) return res.status(401).json({ error: 'unauthorized' });

    try {
      const ok = await hasFeature(wsId, featureKey, { user: req.user });
      if (ok) return next();

      audit.log('feature.access_denied', {
        ...audit.fromReq(req),
        feature: featureKey,
        path: req.originalUrl,
        method: req.method,
      });
      return res.status(403).json({
        error: 'feature_disabled',
        feature: featureKey,
        message: 'Este módulo não está incluído no seu plano. Faça upgrade pra liberar.',
      });
    } catch (err) {
      // Failsafe: se algo quebrar na verificação, deixa passar e loga.
      // Preferimos disponibilidade > rigor de gating em produção.
      audit.log('feature.gate_error', {
        ...audit.fromReq(req),
        feature: featureKey,
        error: err.message,
      });
      next();
    }
  };
}

module.exports = { requireFeature };
