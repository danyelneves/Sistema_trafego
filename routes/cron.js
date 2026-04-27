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
    res.json({ ok: true, ran_at: new Date().toISOString() });
  } catch (e) {
    console.error('[CRON] Erro ao verificar alertas:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
