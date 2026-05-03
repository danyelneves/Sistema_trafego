/**
 * routes/cron.js — endpoint chamado pelo Vercel Cron Job.
 *
 * Configurado em vercel.json:
 *   { "path": "/api/cron/alerts", "schedule": "0 11 * * *" }
 *
 * A Vercel assina a requisição com o header:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Configure CRON_SECRET nas env vars da Vercel para proteger o endpoint.
 */
const express = require('express');
const { runChecks } = require('../services/alertScheduler');
const { runAutomations } = require('../services/automationsRunner');

const router = express.Router();

function requireCronAuth(req, res) {
  if (process.env.NODE_ENV !== 'production') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.status(503).json({ error: 'CRON_SECRET not configured' });
    return false;
  }
  if ((req.headers['authorization'] || '') !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

router.get('/alerts', async (req, res) => {
  if (!requireCronAuth(req, res)) return;

  try {
    const db = require('../db');
    await runChecks();
    await runAutomations();
    
    // Limpeza mensal/diária de webhooks muito antigos (90 dias)
    await db.run("DELETE FROM webhook_events WHERE processed_at < NOW() - INTERVAL '90 days'");

    // Retenção do audit_log (default 90d, configurável via AUDIT_RETENTION_DAYS)
    const auditDeleted = await require('../utils/audit').cleanup();

    res.json({ ok: true, ran_at: new Date().toISOString(), audit_cleanup: auditDeleted });
  } catch (e) {
    console.error('[CRON] Erro ao verificar alertas:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get('/sync', async (req, res) => {
  if (!requireCronAuth(req, res)) return;

  try {
    const db = require('../db');
    const { runGoogleSync, runMetaSync } = require('./sync');
    const workspaces = await db.all('SELECT id FROM workspaces WHERE active = true');

    const today = new Date().toISOString().split('T')[0];
    const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const results = [];
    for (const ws of workspaces) {
      const googleRes = await runGoogleSync(ws.id, firstDay, today).catch(e => ({ error: e.message }));
      const metaRes = await runMetaSync(ws.id, firstDay, today).catch(e => ({ error: e.message }));
      results.push({ workspace_id: ws.id, google: googleRes, meta: metaRes });
    }

    res.json({ ok: true, ran_at: new Date().toISOString(), results });
  } catch (e) {
    console.error('[CRON SYNC] Erro ao sincronizar dados:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
