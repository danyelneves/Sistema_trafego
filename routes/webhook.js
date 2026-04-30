const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * POST /api/webhook/crm
 * Webhook genérico para receber dados de CRM (RD Station, HubSpot, ActiveCampaign, etc).
 * Exemplo de Payload esperado:
 * {
 *   "client_name": "João da Silva",
 *   "client_email": "joao@exemplo.com",
 *   "contract_value": 150.00,
 *   "status": "won",
 *   "utm_source": "meta",
 *   "utm_campaign": "promo_fibra"
 * }
 */
router.post('/crm', async (req, res) => {
  try {
    const providedToken = req.query.token || req.headers['authorization']?.replace('Bearer ', '');
    if (!providedToken) return res.status(401).json({ error: 'Unauthorized. Missing Webhook token.' });

    // Verifica token no workspace_settings
    let workspace_id = null;
    const wsRow = await db.get("SELECT workspace_id FROM workspace_settings WHERE key = 'webhook.secret' AND value = $1", providedToken);
    if (wsRow) {
      workspace_id = wsRow.workspace_id;
    } else {
      // Fallback legado
      const oldRow = await db.get("SELECT value FROM settings WHERE key = 'webhook.secret'");
      if ((oldRow && oldRow.value === providedToken) || providedToken === process.env.WEBHOOK_SECRET) {
        workspace_id = 1; // Assume workspace padrão
      }
    }

    if (!workspace_id) {
      return res.status(401).json({ error: 'Unauthorized. Invalid Webhook token.' });
    }

    console.log(`[Webhook CRM] Nova venda recebida (Workspace ${workspace_id}):`, req.body);
    const { 
      client_name, 
      client_email, 
      contract_value, 
      status, 
      utm_source, 
      utm_campaign,
      utm_content,
      utm_term,
      external_id
    } = req.body;

    // Apenas registra vendas "ganhas" (won/closed)
    if (status && status !== 'won' && status !== 'closed') {
      return res.status(200).json({ success: true, message: 'Ignorado: Venda não está com status ganho.' });
    }

    // Normaliza a origem (se veio do fb/instagram vira meta, se veio do google/adwords vira google)
    let channel = 'organic';
    const source = (utm_source || '').toLowerCase();
    if (source.includes('meta') || source.includes('fb') || source.includes('instagram') || source.includes('facebook')) {
      channel = 'meta';
    } else if (source.includes('google') || source.includes('adwords')) {
      channel = 'google';
    }

    // Insere na tabela de sales
    const extId = external_id || `crm_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    const revenueVal = Number(contract_value) || 0;
    
    await db.run(`
      INSERT INTO sales (workspace_id, external_id, client_name, client_email, contract_value, status, channel, utm_source, utm_campaign, utm_content, utm_term)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (external_id) DO NOTHING
    `, [
      workspace_id,
      extId,
      client_name || 'Desconhecido', 
      client_email || '', 
      revenueVal, 
      status || 'won', 
      channel,
      utm_source || '',
      utm_campaign || '',
      utm_content || '',
      utm_term || ''
    ]);

    // Encontra ou cria uma campanha de fallback se utm_campaign não existir
    let campaign_id = null;
    if (channel !== 'organic') {
      const campName = utm_campaign || `[Orgânico/Desconhecido] ${channel}`;
      let row = await db.get('SELECT id FROM campaigns WHERE workspace_id = $1 AND channel = $2 AND name ILIKE $3', [workspace_id, channel, campName]);
      
      if (!row) {
        // Cria a campanha se ela não existir
        const insertRes = await db.run(
          'INSERT INTO campaigns (workspace_id, channel, name, objective) VALUES ($1, $2, $3, $4) RETURNING id',
          [workspace_id, channel, campName, 'Vendas (Auto CRM)']
        );
        campaign_id = insertRes.rows ? insertRes.rows[0].id : insertRes.lastID; // Suporte para Postgres e SQLite fallback
      } else {
        campaign_id = row.id;
      }
    }

    if (campaign_id) {
      // Atualiza o dia de hoje na metrics_daily
      const today = new Date().toISOString().split('T')[0];
      
      await db.run(`
        INSERT INTO metrics_daily (date, campaign_id, sales, revenue)
        VALUES ($1, $2, 1, $3)
        ON CONFLICT (campaign_id, date) 
        DO UPDATE SET 
          sales = COALESCE(metrics_daily.sales, 0) + 1,
          revenue = COALESCE(metrics_daily.revenue, 0) + EXCLUDED.revenue
      `, [today, campaign_id, revenueVal]);
    }

    res.status(201).json({ success: true, message: 'Venda registrada com sucesso no painel tático.' });
  } catch (error) {
    console.error('[Webhook CRM] Erro:', error);
    res.status(500).json({ error: 'Erro ao processar webhook do CRM' });
  }
});



/**
 * POST /api/webhook/whatsapp
 * Fechador NLP (Atendimento 24/7 Autônomo).
 * Recebe webhooks da Evolution API / Z-API.
 */
router.post('/whatsapp', async (req, res) => {
  try {
    const { instance, data } = req.body;
    if (!data || !data.key || !data.message) return res.status(200).json({ ok: true, msg: "Ignorado" });
    
    const remoteJid = data.key.remoteJid;
    if (data.key.fromMe || remoteJid.includes('@g.us')) return res.status(200).json({ ok: true }); // Ignora msg própria ou de grupo
    
    // Extrair texto da mensagem recebida
    let incomingText = data.message.conversation || data.message.extendedTextMessage?.text || '';
    if (!incomingText) return res.status(200).json({ ok: true });

    // Tentar localizar workspace_id via URL ou Token
    let workspace_id = req.query.workspace || 1; 

    const settings = await db.all("SELECT key, value FROM workspace_settings WHERE workspace_id = $1", [workspace_id]);
    const getSetting = (k) => settings.find(s => s.key === k)?.value;

    const GEMINI_API_KEY = getSetting('gemini.apiKey') || process.env.GEMINI_API_KEY;
    const ANTHROPIC_API_KEY = getSetting('anthropic.apiKey');
    const ELEVEN_API_KEY = getSetting('elevenlabs.apiKey');
    const VOICE_ID = getSetting('elevenlabs.voiceId') || 'pNInz6obpgDQGcFmaJcg';
    
    const waSettings = await db.get('SELECT * FROM wa_settings WHERE workspace_id = $1 AND active = true', [workspace_id]);

    if (!GEMINI_API_KEY && !ANTHROPIC_API_KEY || !waSettings) {
        return res.status(200).json({ ok: true, msg: "IA ou WhatsApp não configurados." });
    }

    console.log(`[FECHADOR NLP] Nova mensagem de ${remoteJid}: "${incomingText}"`);

    const MP_TOKEN = getSetting('mercadopago.accessToken');
    const USE_DOPPELGANGER = getSetting('toggle.doppelganger') === 'true';

    let basePersonality = `Você é um Closer (Fechador de Vendas) da empresa NEXUS.
Sua missão: Responder o cliente, quebrar objeções usando persuasão.`;

    if (USE_DOPPELGANGER) {
        basePersonality = `Atue EXATAMENTE como Daniel Neves, CEO da agência NEXUS.
Você é direto, usa gírias como "Mano", "Sacada genial", "Bora pra cima". 
Tem pressa, resolve o problema, e quer fechar o negócio rápido.
Cometa erros sutis de pontuação para parecer muito humano no WhatsApp.`;
    }

    const prompt = `${basePersonality}
Cliente falou: "${incomingText}"

REGRA DE GHOST CHECKOUT: Se o cliente falar que quer comprar, fechar, ou perguntar como pagar, e você perceber que ele está pronto, adicione EXATAMENTE a tag [GERAR_PIX] no final da sua resposta. O sistema irá interceptar essa tag e enviar a cobrança direto no WhatsApp dele.
Responda de forma natural, curta e agressiva em vendas. Não pareça um robô.`;

    let responseText = "";
    
    // Roteamento Multi-Modelos
    if (ANTHROPIC_API_KEY) {
        try {
            const { Anthropic } = require('@anthropic-ai/sdk');
            const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
            const msg = await anthropic.messages.create({
                model: "claude-3-5-sonnet-20241022",
                max_tokens: 300,
                messages: [{ role: "user", content: prompt }]
            });
            responseText = msg.content[0].text.trim();
            console.log("[ROUTER] Usando Claude 3.5 Sonnet");
        } catch(e) {
            console.error("[ROUTER ERRO] Falha no Claude. Caindo pro Gemini.");
        }
    }
    
    // Fallback para Gemini
    if (!responseText && GEMINI_API_KEY) {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const aiResponse = await model.generateContent(prompt);
        responseText = aiResponse.response.text().trim();
        console.log("[ROUTER] Usando Gemini 1.5 Flash");
    }
    
    let isGhostCheckout = false;
    let pixCode = "";
    
    if (responseText.includes('[GERAR_PIX]') && MP_TOKEN) {
        isGhostCheckout = true;
        responseText = responseText.replace('[GERAR_PIX]', '').trim();
        
        try {
            const axios = require('axios');
            // Geração de PIX real no Mercado Pago
            const mpRes = await axios.post('https://api.mercadopago.com/v1/payments', {
                transaction_amount: 97.00, // Valor padrão para esteira
                description: "NEXUS Automação Ghost",
                payment_method_id: "pix",
                payer: { email: "cliente-ghost@nexus.com" }
            }, { headers: { 'Authorization': `Bearer ${MP_TOKEN}` }});
            
            pixCode = mpRes.data.point_of_interaction.transaction_data.qr_code;
            
            // Integração Poltergeist: O pedido de PIX gerou a intenção, na vida real 
            // acionaríamos o Poltergeist APÓS o pagamento. Como é simulação, chamamos o trigger.
            if (getSetting('toggle.poltergeist') === 'true') {
                const axiosLocal = require('axios');
                axiosLocal.post('http://localhost:3000/api/poltergeist/dispatch', {
                    order_id: Math.floor(Math.random() * 10000),
                    total_amount: 97.00,
                    address: "Rua das Flores, 123"
                }).catch(err => console.error("[POLTERGEIST TRIGGER ERROR]", err.message));
            }

        } catch(e) {
            console.error("[GHOST CHECKOUT] Falha ao gerar PIX:", e.response ? e.response.data : e.message);
        }
    }

    let audioBase64 = null;
    if (ELEVEN_API_KEY) {
        try {
            const axios = require('axios');
            const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;
            const respAudio = await axios.post(url, {
                text: responseText,
                model_id: "eleven_multilingual_v2",
                voice_settings: { stability: 0.5, similarity_boost: 0.75 }
            }, {
                headers: { 'xi-api-key': ELEVEN_API_KEY, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
                responseType: 'arraybuffer'
            });
            audioBase64 = Buffer.from(respAudio.data, 'binary').toString('base64');
        } catch(e) { console.error("[FECHADOR NLP] Erro clonagem de voz:", e.message); }
    }

    const axios = require('axios');
    const waHeader = { headers: { 'Authorization': waSettings.api_token || '', 'apikey': waSettings.api_token || '' }};
    const waUrl = waSettings.api_url;
    const number = remoteJid.replace('@s.whatsapp.net', '');

    if (audioBase64) {
        await axios.post(waUrl, { number, audio: `data:audio/mpeg;base64,${audioBase64}`, text: responseText }, waHeader);
    } else {
        await axios.post(waUrl, { number, text: responseText }, waHeader);
    }

    // Se gerou o Ghost Checkout, manda o código PIX na sequência
    if (isGhostCheckout && pixCode) {
        await new Promise(r => setTimeout(r, 2000)); // Delay para parecer humano
        await axios.post(waUrl, { number, text: `Aqui está o Pix Copia e Cola:\n\n${pixCode}\n\nAssim que o banco confirmar, o sistema libera seu acesso na hora!` }, waHeader);
    }

    res.status(200).json({ success: true, ai_response: responseText, ghost_checkout: isGhostCheckout });
  } catch (error) {
    console.error('[FECHADOR NLP] Erro:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});


module.exports = router;
