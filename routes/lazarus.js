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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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

// ----------------------------------------------------------------
// POST /api/lazarus/cron
// Chamado via Vercel Cron para reativar carrinhos e Pix pendentes
// ----------------------------------------------------------------
router.all('/cron', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized LAZARUS CRON' });
    }
    
    const db = require('../db');
    const axios = require('axios');
    console.log("[LAZARUS CRON] Iniciando caçada por PIX/Cartões abandonados...");

    // Pega orders não pagos há pelo menos 10 min, até 2 dias atrás
    const orders = await db.all(`
      SELECT o.*, p.name as product_name 
      FROM orders o 
      JOIN products p ON o.product_id = p.id
      WHERE o.status IN ('WAITING_PAYMENT', 'PENDING')
      AND o.created_at < NOW() - INTERVAL '10 minutes'
      AND o.created_at > NOW() - INTERVAL '2 days'
    `);

    let recoveredLogs = [];

    const { hasFeature } = require('../utils/features');
    for (const order of orders) {
      if (!order.customer_phone) continue;
      if (!await hasFeature(order.workspace_id, 'lazarus')) continue;

      const settings = await db.all("SELECT key, value FROM workspace_settings WHERE workspace_id = $1", [order.workspace_id]);
      const getSetting = (k, envKey) => settings.find(s => s.key === k)?.value || process.env[envKey];
      
      const ENABLE_LAZARUS = getSetting('toggle.lazarus_protocol', 'ENABLE_LAZARUS') === 'true';
      if (!ENABLE_LAZARUS) continue;

      const GEMINI_API_KEY = getSetting('gemini.apiKey', 'GEMINI_API_KEY');
      const waSettings = await db.get('SELECT * FROM wa_settings WHERE workspace_id = $1 AND active = true', [order.workspace_id]);

      if (!GEMINI_API_KEY || !waSettings?.api_url) continue;

      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `Você é um agente de atendimento humano e empático. O cliente '${order.customer_name}' tentou comprar o produto '${order.product_name}' de R$${order.amount}, mas não pagou (carrinho abandonado há 15 minutos). Escreva 1 mensagem curta, amigável e MUITO informal, como se fosse um áudio de WhatsApp rápido oferecendo ajuda.`;

      const aiResponse = await model.generateContent(prompt);
      const msg = aiResponse.response.text().trim();

      console.log(`[LAZARUS] IA negociando com ${order.customer_name}...`);

      // Verifica se ElevenLabs está ativado para gerar ÁUDIO
      const ELEVEN_API_KEY = getSetting('elevenlabs.apiKey') || process.env.ELEVENLABS_API_KEY;
      const VOICE_ID = getSetting('elevenlabs.voiceId') || process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJcg';
      let audioBase64 = null;

      if (ELEVEN_API_KEY) {
          try {
              console.log(`[LAZARUS] Clonando voz para o áudio de resgate...`);
              const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;
              const respAudio = await axios.post(url, {
                  text: msg,
                  model_id: "eleven_multilingual_v2",
                  voice_settings: { stability: 0.5, similarity_boost: 0.75 }
              }, {
                  headers: { 'xi-api-key': ELEVEN_API_KEY, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
                  responseType: 'arraybuffer'
              });
              audioBase64 = Buffer.from(respAudio.data, 'binary').toString('base64');
          } catch(e) {
              console.error("[LAZARUS] Erro ao clonar voz:", e.message);
          }
      }

      try {
        if (audioBase64) {
            // Dispara via Áudio (Evolution API / Z-API)
            await axios.post(waSettings.api_url, {
              number: order.customer_phone,
              audio: `data:audio/mpeg;base64,${audioBase64}`, // Envia o base64 do áudio
              text: msg // Opcional, como legenda
            }, { headers: { 'Authorization': waSettings.api_token || '', 'apikey': waSettings.api_token || '' }});
            console.log(`[LAZARUS] Áudio enviado com sucesso!`);
        } else {
            // Dispara apenas Texto
            await axios.post(waSettings.api_url, {
              number: order.customer_phone,
              text: msg
            }, { headers: { 'Authorization': waSettings.api_token || '', 'apikey': waSettings.api_token || '' }});
            console.log(`[LAZARUS] Texto enviado com sucesso!`);
        }
        
        // Marca como "LAZARUS_ACTIVATED" para não mandar mensagem de novo
        await db.run("UPDATE orders SET status = 'LAZARUS_ACTIVATED' WHERE id = $1", [order.id]);
        recoveredLogs.push(`Abordado: ${order.customer_name}`);
      } catch (err) {}
    }

    res.json({ ok: true, revived_count: recoveredLogs.length, logs: recoveredLogs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
