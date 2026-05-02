const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ----------------------------------------------------------------
// GET /api/hive/pulse
// Mente de Colmeia (Simulação de Anomalias Globais da Rede)
// ----------------------------------------------------------------
router.get('/pulse', requireAuth, async (req, res) => {
  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurada.");

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const db = require('../db');
    const anomaliesRows = await db.all(`SELECT value FROM workspace_settings WHERE key LIKE 'hive.anomaly.%' ORDER BY key DESC LIMIT 5`);
    const anomaliesStr = anomaliesRows.map(r => r.value).join('\n') || "Nenhuma anomalia de alta conversão registrada recentemente.";

    const prompt = `Você é a "Mente de Colmeia NEXUS", um supercomputador que rastreia trilhões de dados.
Os seguintes eventos acabaram de acontecer na nossa rede de clientes e franqueados (estes dados são REAIS e recém capturados do Meta Ads pelo Sentinel):
${anomaliesStr}

Com base nisso, escreva um "Boletim de Inteligência" (curto, 3 tópicos, formato HTML com <p> e <strong>) extraindo a lição aprendida e dizendo ao usuário o que ele deve replicar nas campanhas dele hoje. Se não houver anomalias reais, dê uma dica avançada genérica de Meta Ads. Não use markdown block.`;

    const result = await model.generateContent(prompt);
    let insights = await result.response.text();

    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      network_status: 'ACTIVE_ANOMALY',
      insights: insights
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
