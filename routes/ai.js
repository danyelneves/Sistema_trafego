const express = require('express');
const router = express.Router();
const { analyzeMetrics } = require('../services/aiConsultant.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { requireAuth } = require('../middleware/auth');

// ----------------------------------------------------------------
// GET /api/ai/insights
// ----------------------------------------------------------------
router.get('/insights', requireAuth, async (req, res) => {
  const { channel } = req.query;
  
  try {
    const data = await analyzeMetrics(req.user.workspace_id, channel || 'all');
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ----------------------------------------------------------------
// POST /api/ai/chat
// ----------------------------------------------------------------
router.post('/chat', async (req, res) => {
  const { message, contextData } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ 
      error: 'GEMINI_API_KEY não configurada no servidor. O Copilot está desativado.' 
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Format context for the LLM
    const contextPrompt = `
Você é o "Maranet Copilot", um consultor de tráfego pago especialista e analista de dados avançado para uma agência de performance (modo Brutalista/Hacker).
Aqui está o contexto de dados do cliente logado no painel atual:
- Impressões totais: ${contextData.impressions || 0}
- Cliques totais: ${contextData.clicks || 0}
- Conversões/Leads: ${contextData.conversions || 0}
- Vendas reais (CRM): ${contextData.sales || 0}
- Investimento (Gasto): R$ ${contextData.spend || 0}
- Faturamento (Receita): R$ ${contextData.revenue || 0}
- ROAS Atual: ${contextData.spend > 0 ? (contextData.revenue / contextData.spend).toFixed(2) : 0}x
- CAC (Custo de Aquisição): R$ ${contextData.sales > 0 ? (contextData.spend / contextData.sales).toFixed(2) : 0}
- Custo por Lead: R$ ${contextData.conversions > 0 ? (contextData.spend / contextData.conversions).toFixed(2) : 0}

Seja direto, técnico e focado em lucro. O usuário fará perguntas sobre a operação dele. Responda usando os dados acima. Se perguntar algo fora do contexto de tráfego/vendas/dados, não responda. Use quebras de linha para formatar. Nunca gere HTML ou Markdown além de negrito e quebras de linha.

Pergunta do cliente: "${message}"
`;

    const result = await model.generateContent(contextPrompt);
    const response = await result.response;
    res.json({ text: response.text() });
  } catch (e) {
    console.error('Gemini Error:', e);
    res.status(500).json({ error: 'Erro ao conectar com o motor de IA.' });
  }
});

module.exports = router;
