const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const rateLimit = require('express-rate-limit');

// Bloqueia se um atacante tentar bater mais de 3 vezes em 10 minutos
const vendingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, 
  max: 3, 
  message: { error: 'Calma lá! Muitos pedidos de robô. Tente novamente mais tarde.' }
});

// ----------------------------------------------------------------
// POST /api/vending/checkout
// Endpoint chamado quando o Dentista/Advogado paga pelo Pix
// ----------------------------------------------------------------
router.post('/checkout', vendingLimiter, async (req, res) => {
  try {
    const { business_type, city, phone, amount_paid } = req.body;

    if (!business_type || !city) {
      return res.status(400).json({ error: 'Faltam dados do negócio.' });
    }

    const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || 'SUA_CHAVE_DE_ACESSO_AQUI';
    const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || 'act_123456789';
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurada.");

    // 1. GERAR A CAMPANHA COM IA (Sem toque humano)
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `Atue como um copywriter hiper-agressivo para negócios locais.
Preciso de uma campanha de anúncios do Facebook para: "${business_type}" na cidade de "${city}".
Responda APENAS em formato JSON estrito:
{
  "campaign_name": "[NEXUS-AUTO] ${business_type} - ${city}",
  "headline": "Título curto e magnético",
  "copy_body": "Texto do anúncio focado na dor do cliente e urgência, convidando para o WhatsApp"
}`;

    const result = await model.generateContent(prompt);
    let text = await result.response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const aiData = JSON.parse(text);

    // 2. ORÇAMENTO AUTÔNOMO (Arbitragem: Cliente paga R$ 500, Gastamos R$ 200 no Meta)
    const adBudget = amount_paid * 0.4; // Gasta 40% do que o cliente pagou, 60% de lucro líquido.

    // 3. PUBLICAR NO FACEBOOK VIA API
    if (ACCESS_TOKEN !== 'SUA_CHAVE_DE_ACESSO_AQUI') {
      const fbApiUrl = `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}`;
      
      const campaignPayload = new URLSearchParams({
        name: aiData.campaign_name,
        objective: 'OUTCOME_LEADS', // Objetivo de geração de leads/mensagens
        status: 'PAUSED', // Criado pausado por segurança no MVP
        special_ad_categories: 'NONE',
        access_token: ACCESS_TOKEN
      });

      await fetch(`${fbApiUrl}/campaigns`, { method: 'POST', body: campaignPayload });
      // Na vida real, criaríamos AdSet segmentado para a cidade e o Ad com a Copy.
    }

    // 4. DISPARAR WHATSAPP AVISANDO O CLIENTE
    // (Simulação de requisição para Z-API/Evolution)
    console.log(`[ZAP ENVIADO PARA ${phone}]: Fala parceiro! Sou o robô do NEXUS. O seu dinheiro caiu e eu já criei a campanha '${aiData.campaign_name}'. Em algumas horas os clientes começarão a te chamar.`);

    // 5. RETORNAR SUCESSO
    res.json({
      ok: true,
      message: 'Impressora de dinheiro ativada. Campanha gerada e lançada.',
      profit_margin: `R$ ${amount_paid - adBudget}`,
      ad_details: aiData
    });

  } catch (error) {
    console.error('Erro na Vending Machine:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
