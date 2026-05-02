const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');
const axios = require('axios');
const { checkWaRateLimit } = require('../middleware/ratelimit');
const { maskPhone } = require('../utils/mask');
const { dispatchOrder } = require('../services/poltergeist');
const audit = require('../utils/audit');
const log = require('../middleware/logger');

// Helper para Idempotência
async function checkIdempotency(provider, externalId, payload) {
  try {
    await db.run(
      'INSERT INTO webhook_events (provider, external_id, payload) VALUES ($1, $2, $3)',
      [provider, externalId, JSON.stringify(payload)]
    );
    return false; // Não é duplicado
  } catch (error) {
    if (error.code === '23505' || error.message.includes('unique constraint') || error.message.includes('UNIQUE')) {
      return true; // Duplicado
    }
    throw error;
  }
}

/**
 * POST /api/webhook/crm
 */
router.post('/crm', async (req, res) => {
  try {
    const providedToken = req.query.token || req.headers['authorization']?.replace('Bearer ', '');
    if (!providedToken) return res.status(401).json({ error: 'Unauthorized. Missing Webhook token.' });

    // Verifica token strict no workspace_settings
    const wsRow = await db.get("SELECT workspace_id FROM workspace_settings WHERE key = 'webhook.secret' AND value = $1", [providedToken]);
    if (!wsRow || !wsRow.workspace_id) {
      return res.status(401).json({ error: 'Unauthorized. Invalid Webhook token.' });
    }
    const workspace_id = wsRow.workspace_id;

    // Idempotência
    const { external_id, client_name, client_email, contract_value, status, utm_source, utm_campaign, utm_content, utm_term } = req.body;
    const extId = external_id || crypto.createHash('md5').update(JSON.stringify(req.body)).digest('hex');
    const isDuplicate = await checkIdempotency('crm', extId, req.body);
    if (isDuplicate) return res.status(200).json({ ok: true, duplicate: true });

    console.log(`[Webhook CRM] Nova venda recebida (Workspace ${workspace_id})`);

    // Apenas registra vendas "ganhas" (suporta variações de CRMs distintos)
    const WON_STATUSES = ['won', 'closed', 'paid', 'confirmed', 'success', 'approved', 'completed'];
    const normalizedStatus = (status || '').toString().toLowerCase().trim();
    if (normalizedStatus && !WON_STATUSES.includes(normalizedStatus)) {
      return res.status(200).json({ success: true, message: 'Ignorado: Venda não está com status ganho.' });
    }

    let channel = 'organic';
    const source = (utm_source || '').toLowerCase();
    if (source.includes('meta') || source.includes('fb') || source.includes('instagram') || source.includes('facebook')) channel = 'meta';
    else if (source.includes('google') || source.includes('adwords')) channel = 'google';

    const revenueVal = Number(contract_value) || 0;
    
    // PII (client_name/client_email) é gravada COMPLETA. maskText() é apenas para logs.
    await db.run(`
      INSERT INTO sales (workspace_id, external_id, client_name, client_email, contract_value, status, channel, utm_source, utm_campaign, utm_content, utm_term)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (external_id) DO NOTHING
    `, [
      workspace_id, extId, client_name || 'Desconhecido', client_email || '', revenueVal, status || 'won', channel, utm_source || '', utm_campaign || '', utm_content || '', utm_term || ''
    ]);

    let campaign_id = null;
    if (channel !== 'organic') {
      const campName = utm_campaign || `[Orgânico/Desconhecido] ${channel}`;
      let row = await db.get('SELECT id FROM campaigns WHERE workspace_id = $1 AND channel = $2 AND name ILIKE $3', [workspace_id, channel, campName]);
      if (!row) {
        const insertRes = await db.run(
          'INSERT INTO campaigns (workspace_id, channel, name, objective) VALUES ($1, $2, $3, $4) RETURNING id',
          [workspace_id, channel, campName, 'Vendas (Auto CRM)']
        );
        campaign_id = insertRes.rows ? insertRes.rows[0].id : insertRes.lastID;
      } else {
        campaign_id = row.id;
      }
    }

    if (campaign_id) {
      const today = new Date().toISOString().split('T')[0];
      await db.run(`
        INSERT INTO metrics_daily (date, campaign_id, sales, revenue)
        VALUES ($1, $2, 1, $3)
        ON CONFLICT (campaign_id, date) 
        DO UPDATE SET sales = COALESCE(metrics_daily.sales, 0) + 1, revenue = COALESCE(metrics_daily.revenue, 0) + EXCLUDED.revenue
      `, [today, campaign_id, revenueVal]);
    }

    res.status(201).json({ success: true, message: 'Venda registrada com sucesso no painel tático.' });
  } catch (error) {
    console.error('[Webhook CRM] Erro:', error.message);
    res.status(500).json({ error: 'Erro ao processar webhook do CRM' });
  }
});

/**
 * POST /api/webhook/whatsapp/:token
 */
router.post('/whatsapp/:token', checkWaRateLimit, async (req, res) => {
  try {
    const { token } = req.params;
    const { instance, data } = req.body;
    if (!data || !data.key || !data.message) return res.status(200).json({ ok: true, msg: "Ignorado" });
    
    const remoteJid = data.key.remoteJid;
    if (data.key.fromMe || remoteJid.includes('@g.us')) return res.status(200).json({ ok: true }); 
    
    let incomingText = data.message.conversation || data.message.extendedTextMessage?.text || '';
    if (!incomingText) return res.status(200).json({ ok: true });

    // Validar token PRIMEIRO (rápido + seguro: bloqueia atacantes antes de qualquer side-effect)
    const wsRow = await db.get("SELECT workspace_id FROM workspace_settings WHERE key = 'whatsapp.webhook.token' AND value = $1", [token]);
    if (!wsRow) return res.status(401).json({ error: 'Unauthorized. Invalid WhatsApp token.' });
    const workspace_id = wsRow.workspace_id;

    // Idempotência só DEPOIS do token validado (evita poluir webhook_events com requests não autorizadas)
    const isDuplicate = await checkIdempotency('whatsapp', data.key.id, req.body);
    if (isDuplicate) return res.status(200).json({ ok: true, duplicate: true });

    const settings = await db.all("SELECT key, value FROM workspace_settings WHERE workspace_id = $1", [workspace_id]);
    const getSetting = (k) => settings.find(s => s.key === k)?.value;

    const GEMINI_API_KEY = getSetting('gemini.apiKey') || process.env.GEMINI_API_KEY;
    const ANTHROPIC_API_KEY = getSetting('anthropic.apiKey');
    const ELEVEN_API_KEY = getSetting('elevenlabs.apiKey') || process.env.ELEVENLABS_API_KEY;
    const VOICE_ID = getSetting('elevenlabs.voiceId') || process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJcg';
    
    const waSettings = await db.get('SELECT * FROM wa_settings WHERE workspace_id = $1 AND active = true', [workspace_id]);
    if ((!GEMINI_API_KEY && !ANTHROPIC_API_KEY) || !waSettings) {
        return res.status(200).json({ ok: true, msg: "IA ou WhatsApp não configurados." });
    }

    console.log(`[FECHADOR NLP] Msg recebida Workspace ${workspace_id} - Número mascarado: ${maskPhone(remoteJid)}`);

    const MP_TOKEN = getSetting('mercadopago.accessToken');
    const USE_DOPPELGANGER = getSetting('toggle.doppelganger') === 'true';

    let basePersonality = "Você é um Closer (Fechador de Vendas) da empresa NEXUS. Sua missão: Responder o cliente, quebrar objeções usando persuasão.";
    if (USE_DOPPELGANGER) {
        basePersonality = "Atue EXATAMENTE como Daniel Neves, CEO da agência NEXUS. Você é direto, usa gírias como 'Mano', 'Sacada genial', 'Bora pra cima'. Tem pressa, resolve o problema, e quer fechar o negócio rápido. Cometa erros sutis de pontuação para parecer muito humano no WhatsApp.";
    }

    const prompt = `${basePersonality}\nCliente falou: "${incomingText}"\nREGRA DE GHOST CHECKOUT: Se o cliente falar que quer comprar, fechar, ou perguntar como pagar, e você perceber que ele está pronto, adicione EXATAMENTE a tag [GERAR_PIX] no final da sua resposta. O sistema irá interceptar essa tag e enviar a cobrança direto no WhatsApp dele. Responda de forma natural, curta e agressiva em vendas. Não pareça um robô.`;

    let responseText = "";
    
    if (ANTHROPIC_API_KEY) {
        try {
            const { Anthropic } = require('@anthropic-ai/sdk');
            const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY, timeout: 8000 });
            const msg = await anthropic.messages.create({
                model: "claude-sonnet-4-6",
                max_tokens: 300,
                messages: [{ role: "user", content: prompt }],
            });
            responseText = msg.content[0].text.trim();
        } catch(e) {
            console.error("[ROUTER ERRO] Falha no Claude. Caindo pro Gemini.");
        }
    }

    if (!responseText && GEMINI_API_KEY) {
        try {
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
            // Promise.race garante o timeout independente de suporte do SDK ao AbortSignal.
            const aiResponse = await Promise.race([
                model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini timeout 8s')), 8000)),
            ]);
            responseText = aiResponse.response.text().trim();
        } catch (e) {
            console.error("[ROUTER ERRO] Falha no Gemini.", e.message);
        }
    }
    
    let isGhostCheckout = false;
    let pixCode = "";
    
    if (responseText.includes('[GERAR_PIX]') && MP_TOKEN) {
        isGhostCheckout = true;
        responseText = responseText.replace('[GERAR_PIX]', '').trim();
        
        try {
            const numeroWs = remoteJid.replace(/[^0-9]/g, '');
            const ts = Date.now();
            const ghostAmount = Number(getSetting('ghost.default_amount')) || 97.00;
            const protocol = process.env.NODE_ENV === 'production' ? 'https' : req.protocol;
            const mpRes = await axios.post('https://api.mercadopago.com/v1/payments', {
                transaction_amount: ghostAmount,
                description: "NEXUS Automação Ghost",
                payment_method_id: "pix",
                external_reference: `GHOST_${workspace_id}_${numeroWs}_${ts}`,
                notification_url: `${protocol}://${req.get('host')}/api/webhook/mercadopago`,
                payer: { email: `wa-${numeroWs}@nexus-tenant.local` }
            }, {
              headers: { 
                'Authorization': `Bearer ${MP_TOKEN}`,
                'X-Idempotency-Key': `ghost-${workspace_id}-${numeroWs}-${ts}`
              },
              timeout: 8000
            });
            
            pixCode = mpRes.data.point_of_interaction.transaction_data.qr_code;
            
            if (getSetting('toggle.poltergeist') === 'true') {
                await dispatchOrder({
                    order_id: Math.floor(Math.random() * 10000),
                    total_amount: ghostAmount,
                    address: "Rua das Flores, 123"
                }).catch(err => console.error("[POLTERGEIST TRIGGER ERROR]", err.message));
            }
        } catch(e) {
            console.error("[GHOST CHECKOUT] Falha ao gerar PIX:", e.message);
        }
    }

    let audioBase64 = null;
    if (ELEVEN_API_KEY) {
        try {
            const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;
            const respAudio = await axios.post(url, {
                text: responseText,
                model_id: "eleven_multilingual_v2",
                voice_settings: { stability: 0.5, similarity_boost: 0.75 }
            }, {
                headers: { 'xi-api-key': ELEVEN_API_KEY, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
                responseType: 'arraybuffer',
                timeout: 8000
            });
            audioBase64 = Buffer.from(respAudio.data, 'binary').toString('base64');
        } catch(e) { console.error("[FECHADOR NLP] Erro clonagem de voz:", e.message); }
    }

    const waHeader = { headers: { 'Authorization': waSettings.api_token || '', 'apikey': waSettings.api_token || '' }};
    const waUrl = waSettings.api_url;
    const number = remoteJid.replace('@s.whatsapp.net', '');

    const sendMsg = async (payload) => {
        try {
            await axios.post(waUrl, payload, { ...waHeader, timeout: 8000 });
        } catch (e) {
            console.error("[WA API] Falha, tentando novamente...");
            await axios.post(waUrl, payload, { ...waHeader, timeout: 8000 });
        }
    };

    if (audioBase64) {
        await sendMsg({ number, audio: `data:audio/mpeg;base64,${audioBase64}`, text: responseText });
    } else if (responseText) {
        await sendMsg({ number, text: responseText });
    }

    if (isGhostCheckout && pixCode) {
        await new Promise(r => setTimeout(r, 2000)); 
        await sendMsg({ number, text: `Aqui está o Pix Copia e Cola:\n\n${pixCode}\n\nAssim que o banco confirmar, o sistema libera seu acesso na hora!` });
    }

    res.status(200).json({ success: true, ghost_checkout: isGhostCheckout });
  } catch (error) {
    console.error('[FECHADOR NLP] Erro:', error.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

/**
 * POST /api/webhook/mercadopago
 */
router.post('/mercadopago', async (req, res) => {
  try {
    const topic = req.query.topic || req.body.type;
    const paymentId = req.query.id || req.body.data?.id;

    if (!paymentId || (topic !== 'payment' && req.body.action !== 'payment.created' && req.body.action !== 'payment.updated')) {
      return res.status(200).json({ ok: true }); 
    }

    // HMAC Signature Validation
    const mpSecret = process.env.MP_WEBHOOK_SECRET;
    if (mpSecret) {
      const xSignature = req.headers['x-signature'];
      const xRequestId = req.headers['x-request-id'];
      if (!xSignature || !xRequestId) return res.status(401).json({ error: 'Missing MP signatures' });
      
      const parts = xSignature.split(',');
      let ts = '', hash = '';
      for (const p of parts) {
        const [k, v] = p.split('=');
        if (k === 'ts') ts = v;
        if (k === 'v1') hash = v;
      }
      
      const manifest = `id:${paymentId};request-id:${xRequestId};ts:${ts};`;
      const expectedHash = crypto.createHmac('sha256', mpSecret).update(manifest).digest('hex');
      
      try {
          if (!crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash))) {
              console.error(`[FRAUDE-MP] Assinatura inválida para paymentId ${paymentId}`);
              return res.status(401).json({ error: 'Invalid signature' });
          }
      } catch (e) {
          console.error(`[FRAUDE-MP] Falha ao verificar assinatura MP`, e.message);
          return res.status(401).json({ error: 'Signature check failed' });
      }
    }

    // Idempotency
    const isDuplicate = await checkIdempotency('mercadopago', paymentId, req.body);
    if (isDuplicate) return res.status(200).json({ ok: true, duplicate: true });

    const ownerSettings = await db.all("SELECT key, value FROM workspace_settings WHERE workspace_id = 1");
    const ownerMpToken = ownerSettings.find(s => s.key === 'mercadopago.accessToken')?.value;

    if (!ownerMpToken || !ownerMpToken.startsWith('APP_USR')) {
      console.error("[WEBHOOK MP] Chave MP não configurada em workspace_settings (workspace_id=1).");
      return res.status(503).json({ ok: false, error: 'MP not configured' });
    }

    const paymentResponse = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${ownerMpToken}` }, timeout: 8000
    });
    
    const paymentData = paymentResponse.data;

    // Validate collector ID
    const EXPECTED_COLLECTOR = process.env.MP_COLLECTOR_ID;
    if (EXPECTED_COLLECTOR && String(paymentData.collector_id) !== String(EXPECTED_COLLECTOR)) {
        console.error(`[FRAUDE-MP] Collector ID não confere. Esperado: ${EXPECTED_COLLECTOR}. Recebido: ${paymentData.collector_id}`);
        return res.status(401).json({ error: 'Invalid collector' });
    }

    // Validação estrita
    if (paymentData.status === 'approved') {
      const extRef = paymentData.external_reference || '';
      
      if (extRef.startsWith('UPGRADE_')) {
        const parts = extRef.split('_');
        const targetWorkspaceId = parseInt(parts[1], 10);
        const planName = parts[2]; 
        
        if (!['STARTER', 'GROWTH', 'ELITE'].includes(planName)) {
           console.error(`[FRAUDE-MP] Tentativa de forjar plano inválido: ${planName}`);
           return res.status(200).json({ ok: true });
        }

        // Verifica se workspace existe
        const wsExists = await db.get("SELECT id FROM workspaces WHERE id = $1", [targetWorkspaceId]);
        if (!wsExists) {
            console.error(`[FRAUDE-MP] Workspace ${targetWorkspaceId} não existe.`);
            return res.status(200).json({ ok: true });
        }

        const expectedPrices = { 'STARTER': 97.00, 'GROWTH': 297.00, 'ELITE': 997.00 };
        const price = expectedPrices[planName];
        
        if (Math.abs(Number(paymentData.transaction_amount) - price) > 0.01) {
            console.error(`[FRAUDE-MP] Valor transacionado não confere. Esperado: ${price}. Recebido: ${paymentData.transaction_amount}`);
            return res.status(200).json({ ok: true });
        }
        
        if (paymentData.currency_id !== 'BRL') {
            console.error(`[FRAUDE-MP] Moeda inválida: ${paymentData.currency_id}`);
            return res.status(200).json({ ok: true });
        }

        const newLimit = planName === 'ELITE' ? 200.00 : (planName === 'GROWTH' ? 50.00 : 0.00);

        await db.run("UPDATE workspace_billing SET plan_type = $1, credits_limit = $2 WHERE workspace_id = $3", [planName, newLimit, targetWorkspaceId]);
        await db.run("INSERT INTO payments_log (payment_id, workspace_id, plan, amount, status) VALUES ($1, $2, $3, $4, $5)", [String(paymentId), targetWorkspaceId, planName, price, 'approved']);

        log.info('Pagamento MP aprovado, workspace upgraded', {
          paymentId, workspaceId: targetWorkspaceId, plan: planName, amount: price,
        });
        audit.log('billing.upgrade.approved', {
          workspaceId: targetWorkspaceId,
          paymentId: String(paymentId),
          plan: planName,
          amount: price,
        });
      }
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    log.error('webhook MP falhou', err);
    // Retorna 200 mesmo em erro pra MP não ficar reentregando o webhook indefinidamente
    res.status(200).json({ error: 'Erro processado internamente' });
  }
});

module.exports = router;
