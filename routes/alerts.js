/**
 * routes/alerts.js — CRUD de configurações de alertas de KPI por e-mail.
 */
const express = require('express');
const db      = require('../db');
const mailer  = require('../services/mailer');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const METRICS    = ['cpl','cpc','ctr','roas','spend','conversions','impressions','clicks'];
const CHANNELS   = ['google','meta','all'];
const DIRECTIONS = ['min','max'];

router.get('/config', async (req, res) => {
  try {
    res.json({
      configured: mailer.isConfigured(),
      alerts: await db.all('SELECT * FROM alert_configs ORDER BY id'),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/config', requireAdmin, async (req, res) => {
  const { metric, channel = 'all', threshold, direction = 'min', email } = req.body || {};
  if (!metric || threshold == null || !email)
    return res.status(400).json({ error: 'metric, threshold e email são obrigatórios' });
  if (!METRICS.includes(metric))       return res.status(400).json({ error: `metric inválido (${METRICS.join(', ')})` });
  if (!CHANNELS.includes(channel))     return res.status(400).json({ error: `channel inválido (${CHANNELS.join(', ')})` });
  if (!DIRECTIONS.includes(direction)) return res.status(400).json({ error: 'direction deve ser min ou max' });
  if (isNaN(Number(threshold)))        return res.status(400).json({ error: 'threshold deve ser numérico' });

  try {
    const row = await db.get(
      `INSERT INTO alert_configs (metric, channel, threshold, direction, email)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      metric, channel, Number(threshold), direction, email.trim()
    );
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/config/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const row = await db.get('SELECT * FROM alert_configs WHERE id = $1', id);
    if (!row) return res.status(404).json({ error: 'alerta não encontrado' });
    const { active } = req.body || {};
    const updated = await db.get(
      'UPDATE alert_configs SET active = $1 WHERE id = $2 RETURNING *',
      active ? 1 : 0, id
    );
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/config/:id', requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await db.run('DELETE FROM alert_configs WHERE id = $1', Number(req.params.id));
    if (!rowCount) return res.status(404).json({ error: 'alerta não encontrado' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/test', requireAdmin, async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email é obrigatório' });
  if (!mailer.isConfigured()) return res.status(503).json({ error: 'SMTP não configurado (verifique SMTP_USER e SMTP_PASS no .env)' });
  try {
    await mailer.send({
      to:      email,
      subject: '[Teste] Maranet · Central de Tráfego — Alertas configurados',
      html:    `<p>Este é um e-mail de teste do sistema de alertas da <strong>Central de Tráfego · Maranet</strong>.</p>
                <p>Os alertas de KPI estão configurados corretamente. ✓</p>`,
    });
    res.json({ ok: true, message: `E-mail de teste enviado para ${email}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/log', async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT l.*, a.metric, a.channel, a.email, a.direction, a.threshold
      FROM alert_log l
      JOIN alert_configs a ON a.id = l.alert_id
      ORDER BY l.sent_at DESC
      LIMIT 200
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
