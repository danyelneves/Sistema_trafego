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
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Você é a "Mente de Colmeia NEXUS", um supercomputador que rastreia trilhões de dados do Facebook Ads no Brasil.
Gere 3 tendências (anomalias de alta conversão) que foram detectadas AGORA MESMO no mercado brasileiro. 
Exemplos: 
- Vídeos curtos com filtro P&B reduziram CPA em 42% no nicho fitness.
- Landing Pages de fundo preto estão convertendo 3x mais que fundo branco para info-produtos.
Seja técnico, frio, e ultra-específico. 
Formate em HTML (apenas usando <p> e <strong>, sem blocos markdown).`;

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
