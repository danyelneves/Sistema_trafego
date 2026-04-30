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

router.get('/alerts', async (req, res) => {
  // Verifica a chave secreta do cron (apenas em produção)
  if (process.env.NODE_ENV === 'production') {
    const auth = req.headers['authorization'] || '';
    const secret = process.env.CRON_SECRET;
    if (secret && auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  try {
    await runChecks();
    await runAutomations();
    res.json({ ok: true, ran_at: new Date().toISOString() });
  } catch (e) {
    console.error('[CRON] Erro ao verificar alertas:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get('/sync', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    const auth = req.headers['authorization'] || '';
    const secret = process.env.CRON_SECRET;
    if (secret && auth !== `Bearer ${secret}`) return res.status(401).json({ error: 'unauthorized' });
  }

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
