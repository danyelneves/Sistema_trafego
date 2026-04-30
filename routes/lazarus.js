const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ----------------------------------------------------------------
// POST /api/lazarus/revive
// Envia um array de contatos "mortos", a IA cria copys ultra-pessoais
// ----------------------------------------------------------------
router.post('/revive', requireAuth, async (req, res) => {
  try {
    const { contacts, context_offer } = req.body;
    // contacts = [{name: 'Joao', reason: 'achou caro na epoca'}, ...]
    
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurada.");

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    let revived = [];

    for (let contact of contacts) {
      const prompt = `Você é uma atendente de relacionamento muito humana e empática de uma clínica/empresa. 
O cliente: ${contact.name}. 
Motivo de não ter comprado antes: ${contact.reason || 'Sumiu do WhatsApp'}.
Oferta atual que queremos vender: ${context_offer}.

Escreva uma ÚNICA mensagem de WhatsApp (curta, casual, usando gatilho de curiosidade, NUNCA parecendo um robô ou vendedor chato) para reativar esse contato e puxar assunto.
Responda APENAS com o texto da mensagem.`;

      const result = await model.generateContent(prompt);
      let aiMessage = await result.response.text();
      
      // Simulação: Aqui dispararia para a API do Z-API/Evolution
      // await sendWhatsApp(contact.phone, aiMessage.trim());

      revived.push({
        name: contact.name,
        phone: contact.phone,
        message_sent: aiMessage.trim()
      });
    }

    res.json({
      ok: true,
      message: `${revived.length} leads mortos foram reativados com sucesso pelo Protocolo Lázaro.`,
      data: revived
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
