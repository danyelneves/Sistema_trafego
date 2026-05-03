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
const audit = require('../utils/audit');

function requireFeature(featureKey) {
  return async (req, res, next) => {
    // Bypass pra crons internos (Vercel chama com Bearer CRON_SECRET)
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers.authorization === `Bearer ${cronSecret}`) {
      return next();
    }
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
