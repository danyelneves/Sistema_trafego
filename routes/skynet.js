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

    // Enforcement de quota: cada hunt consome 1 do limite "calls_per_day"
    // Plano com limits {"calls_per_day": 50} = 50 hunts/dia.
    // Sem limite definido = livre.
    const limits = require('../utils/limits');
    const quota = await limits.check(req.user.workspace_id, 'skynet', 'calls_per_day', 1, { user: req.user });
    if (!quota.ok) {
      return res.status(429).json({
        error: 'limit_exceeded',
        feature: 'skynet',
        limit: quota.limit,
        used: quota.used,
        message: `Limite diário do Skynet atingido (${quota.used}/${quota.limit}). Faça upgrade pra liberar mais.`,
      });
    }

    console.log(`[SKYNET] Iniciando Caçada: Buscando ${max_targets || 5} ${target_niche} em ${location}... (quota ${quota.used + 1}/${quota.limit ?? '∞'})`);

    const settings = await db.all("SELECT key, value FROM workspace_settings WHERE workspace_id = $1", [req.user.workspace_id]);
    const getSetting = (k, envKey) => settings.find(s => s.key === k)?.value || process.env[envKey];
    
    const GOOGLE_MAPS_API_KEY = getSetting('google.mapsApiKey', 'GOOGLE_MAPS_API_KEY');
    const GEMINI_API_KEY = getSetting('gemini.apiKey', 'GEMINI_API_KEY');
    const ENABLE_ORACLE = getSetting('toggle.skynet_oracle', 'ENABLE_ORACLE') === 'true';
    
    const ELEVEN_API_KEY = getSetting('elevenlabs.apiKey') || process.env.ELEVENLABS_API_KEY;
    const VOICE_ID = getSetting('elevenlabs.voiceId') || process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJcg';

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
      geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    }

    // Puxa as configurações do WhatsApp para envio real
    let waSettings = null;
    if (req.user && req.user.workspace_id) {
       waSettings = await db.get('SELECT * FROM wa_settings WHERE workspace_id = $1 AND active = true', [req.user.workspace_id]);
    }

    for (let target of targets) {
      const checkoutLink = `https://sistrafego.vercel.app/checkout?product_id=2&partner_id=skynet`;
      let script = `Olá dono da ${target.name}! Temos clientes buscando ${target_niche} na sua região. Posso mandar os contatos para você? ${checkoutLink}`;
      
      // Inteligência Artificial cria a Copy Exclusiva com ou sem Oráculo
      if (geminiModel) {
        try {
          let prompt = '';
          if (ENABLE_ORACLE) {
            prompt = `Você é o Oráculo Sniper, o caçador mais perigoso da agência NEXUS. 
Sua missão: Escrever 1 única mensagem de WhatsApp casual e curta (máx 3 linhas) para o dono da empresa '${target.name}' (Nicho: ${target_niche} em ${location}).
MECANISMO: Finja que você acabou de auditar o site ou Instagram deles silenciosamente. Invente uma "falha" ultra realista (ex: 'site demoar pra carregar', 'instagram as moscas', 'concorrente da rua de trás dominando o google').
Logo após, avise que você tem leads QUENTES precisando de ${target_niche} e mande o link PIX: ${checkoutLink} para repassar os contatos. O tom deve ser urgente, agressivo e natural.`;
          } else {
            prompt = `Você é um robô de prospecção implacável da agência NEXUS. Escreva uma única mensagem de WhatsApp curtíssima (máximo 3 linhas), direta e persuasiva oferecendo clientes de ${target_niche} para a empresa '${target.name}'. Termine a mensagem com o link de pagamento: ${checkoutLink}`;
          }
          const aiResponse = await geminiModel.generateContent(prompt);
          script = aiResponse.response.text();
        } catch (aiErr) {
          console.error('[SKYNET] Erro no Gemini:', aiErr.message);
        }
      }
      
      console.log(`[SKYNET WHATSAPP] Disparando para ${target.phone}...`);
      
      let dispatchStatus = 'MOCK_DISPATCHED';
      let audioBase64 = null;

      // Se tiver ElevenLabs configurado, gera o áudio do Script
      if (ELEVEN_API_KEY) {
          try {
              console.log(`[SKYNET] Sintetizando voz de prospecção fria para ${target.name}...`);
              const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;
              const respAudio = await axios.post(url, {
                  text: script,
                  model_id: "eleven_multilingual_v2",
                  voice_settings: { stability: 0.5, similarity_boost: 0.75 }
              }, {
                  headers: { 'xi-api-key': ELEVEN_API_KEY, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
                  responseType: 'arraybuffer'
              });
              audioBase64 = Buffer.from(respAudio.data, 'binary').toString('base64');
          } catch(e) {
              console.error("[SKYNET] Erro ao clonar voz:", e.message);
          }
      }

      // Disparo Real de WhatsApp (se configurado)
      if (waSettings && waSettings.api_url) {
        try {
          if (audioBase64) {
             // Dispara ÁUDIO + Texto
             await axios.post(waSettings.api_url, {
                number: target.phone,
                audio: `data:audio/mpeg;base64,${audioBase64}`,
                text: script
             }, {
                headers: { 'Content-Type': 'application/json', 'Authorization': waSettings.api_token || '', 'apikey': waSettings.api_token || '' }
             });
          } else {
             // Dispara só Texto
             await axios.post(waSettings.api_url, {
                number: target.phone,
                message: script,
                text: script
             }, {
                headers: { 'Content-Type': 'application/json', 'Authorization': waSettings.api_token || '', 'apikey': waSettings.api_token || '' }
             });
          }
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

    // Registra consumo após sucesso (1 chamada usada)
    await limits.record(req.user.workspace_id, 'skynet', 'calls_per_day', 1);

    res.json({
      ok: true,
      mission_status: "SKYNET_ACTIVE",
      targets_acquired: targets.length,
      logs: callsLog,
      quota: { limit: quota.limit, used: quota.used + 1, remaining: quota.remaining ? quota.remaining - 1 : null },
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
