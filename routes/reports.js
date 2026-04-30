const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const aiConsultant = require('../services/aiConsultant');

const router = express.Router();

// 1. Generate a new report (Requires Auth)
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const { title, metrics } = req.body;
    const workspaceId = req.user.workspace_id;

    // Pedir para a IA gerar um resumo executivo baseado nas métricas
    const prompt = `Atue como um analista de marketing senior. Faça um resumo executivo focado e direto para um cliente leigo entender, baseado nestas KPIs: ${JSON.stringify(metrics)}. Use tom profissional e encorajador. Maximo de 3 paragrafos curtos.`;
    const aiSummary = await aiConsultant.generateInsight(prompt);

    const sql = `
      INSERT INTO reports (workspace_id, title, ai_summary, metrics_snapshot)
      VALUES ($1, $2, $3, $4) RETURNING uuid
    `;
    const row = await db.get(sql, workspaceId, title || 'Relatório de Tráfego', aiSummary, JSON.stringify(metrics));
    
    res.status(201).json({ ok: true, uuid: row.uuid });
  } catch (e) {
    console.error('Report Generation Error:', e);
    res.status(500).json({ error: 'Erro ao gerar relatório' });
  }
});

// 2. Fetch a public report (NO AUTH REQUIRED - for clients)
router.get('/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    
    // Join with workspaces to get branding
    const sql = `
      SELECT r.*, w.name as workspace_name, w.logo_url, w.theme_color
      FROM reports r
      LEFT JOIN workspaces w ON r.workspace_id = w.id
      WHERE r.uuid = $1
    `;
    const report = await db.get(sql, uuid);
    
    if (!report) {
      return res.status(404).json({ error: 'Relatório não encontrado' });
    }

    res.json(report);
  } catch (e) {
    console.error('Report Fetch Error:', e);
    res.status(500).json({ error: 'Erro ao buscar relatório' });
  }
});

module.exports = router;
