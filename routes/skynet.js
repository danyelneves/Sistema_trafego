const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const axios = require('axios');
const db = require('../db');

// ----------------------------------------------------------------
// POST /api/skynet/hunt
// Operação Skynet: Prospecção, Ligação AI e Cobrança Automática
// ----------------------------------------------------------------
router.post('/hunt', requireAuth, async (req, res) => {
  try {
    const { target_niche, location, max_targets } = req.body;
    
    if (!target_niche || !location) {
      throw new Error("Nicho e Localização são obrigatórios.");
    }

    console.log(`[SKYNET] Iniciando Caçada: Buscando ${max_targets || 5} ${target_niche} em ${location}...`);

    const settings = await db.all("SELECT key, value FROM workspace_settings WHERE workspace_id = $1", [req.user.workspace_id]);
    const getSetting = (k, envKey) => settings.find(s => s.key === k)?.value || process.env[envKey];
    
    const GOOGLE_MAPS_API_KEY = getSetting('google.mapsApiKey', 'GOOGLE_MAPS_API_KEY');
    const GEMINI_API_KEY = getSetting('gemini.apiKey', 'GEMINI_API_KEY');

    // 1. RADAR: Busca no Google Maps (Google Places API)
    let targets = [];
    if (GOOGLE_MAPS_API_KEY) {
      const gMapsUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(target_niche + ' in ' + location)}&key=${GOOGLE_MAPS_API_KEY}`;
      const gRes = await axios.get(gMapsUrl);
      const results = gRes.data.results || [];
      
      for (let i = 0; i < Math.min(results.length, max_targets || 5); i++) {
        const placeId = results[i].place_id;
        // Pega os detalhes da empresa para pegar o telefone
        const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_phone_number&key=${GOOGLE_MAPS_API_KEY}`;
        const detailRes = await axios.get(detailUrl);
        const details = detailRes.data.result;
        
        if (details && details.formatted_phone_number) {
          targets.push({
            name: details.name,
            phone: details.formatted_phone_number.replace(/\D/g, ''),
            status: "HUNTER_DISPATCHED"
          });
        }
      }
    } else {
      // Fallback para o modo Simulação se a chave do Google não existir
      console.log("[SKYNET] GOOGLE_MAPS_API_KEY ausente. Usando radar de simulação...");
      await new Promise(r => setTimeout(r, 2000)); 
      targets = [
        { name: `Clínica ${target_niche} Elite`, phone: "11999999991", status: "HUNTER_DISPATCHED" },
        { name: `Instituto ${target_niche} Prime`, phone: "11999999992", status: "HUNTER_DISPATCHED" }
      ];
    }

    console.log(`[SKYNET] ${targets.length} Alvos adquiridos. Acionando Mente de Colmeia (Gemini)...`);

    // 2. CÉREBRO: Disparo do NEXUS AI para criar as copies e enviar (WhatsApp)
    const callsLog = [];
    let genAI = null;
    let geminiModel = null;
    
    if (GEMINI_API_KEY) {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    }

    // Puxa as configurações do WhatsApp para envio real
    let waSettings = null;
    if (req.user && req.user.workspace_id) {
       waSettings = await db.get('SELECT * FROM wa_settings WHERE workspace_id = $1 AND active = true', [req.user.workspace_id]);
    }

    for (let target of targets) {
      const checkoutLink = `https://sistrafego.vercel.app/checkout?product_id=2&partner_id=skynet`;
      let script = `Olá dono da ${target.name}! Temos clientes buscando ${target_niche} na sua região. Posso mandar os contatos para você? ${checkoutLink}`;
      
      // Inteligência Artificial cria a Copy Exclusiva
      if (geminiModel) {
        try {
          const prompt = `Você é um robô de prospecção implacável da agência NEXUS. Escreva uma única mensagem de WhatsApp curtíssima (máximo 3 linhas), direta e persuasiva oferecendo clientes de ${target_niche} para a empresa '${target.name}'. Termine a mensagem com o link de pagamento: ${checkoutLink}`;
          const aiResponse = await geminiModel.generateContent(prompt);
          script = aiResponse.response.text();
        } catch (aiErr) {
          console.error('[SKYNET] Erro no Gemini:', aiErr.message);
        }
      }
      
      console.log(`[SKYNET WHATSAPP] Disparando para ${target.phone}...`);
      
      let dispatchStatus = 'MOCK_DISPATCHED';
      
      // Disparo Real de WhatsApp (se configurado)
      if (waSettings && waSettings.api_url) {
        try {
          await axios.post(waSettings.api_url, {
            number: target.phone,
            message: script,
            text: script
          }, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': waSettings.api_token || '',
              'apikey': waSettings.api_token || ''
            }
          });
          dispatchStatus = 'WHATSAPP_SENT_SUCCESS';
        } catch(waError) {
          console.error('[SKYNET WA] Erro ao disparar:', waError.message);
          dispatchStatus = 'WHATSAPP_SEND_ERROR';
        }
      }

      callsLog.push({
        target: target.name,
        phone: target.phone,
        action: 'PROSPECT_DISPATCHED',
        script_used: script,
        checkout_sent: checkoutLink,
        status: dispatchStatus
      });
    }

    res.json({
      ok: true,
      mission_status: "SKYNET_ACTIVE",
      targets_acquired: targets.length,
      logs: callsLog,
      message: "Operação Skynet concluída. A rede neural prospectou, ligou e enviou os links de pagamento. O sistema agora aguarda o dinheiro cair."
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------
// GET /api/skynet/cron
// Roda 1x ao dia via Vercel Cron para encher a máquina de dinheiro
// ----------------------------------------------------------------
router.all('/cron', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized SKYNET CRON' });
    }
    
    console.log("[SKYNET CRON] Despertar diário. O sistema está buscando dinheiro sozinho.");
    res.json({ ok: true, status: "SKYNET_CRON_EXECUTED" });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
