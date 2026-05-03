const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');
const { checkKiwifyRateLimit } = require('../middleware/ratelimit');
const { maskPhone, maskText } = require('../utils/mask');
const { sendWhatsAppMessage } = require('../services/whatsapp');

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

// POST /api/webhooks/kiwify/:wsId
router.post('/kiwify/:wsId', checkKiwifyRateLimit, async (req, res) => {
  try {
    const { wsId } = req.params;
    const payload = req.body;

    // 1. Validar se o workspace existe e pegar secret da Kiwify
    const wsRow = await db.get("SELECT id FROM workspaces WHERE id = $1", [wsId]);
    if (!wsRow) {
        return res.status(401).json({ error: 'Unauthorized. Workspace invalid.' });
    }

    const wsSettingsRow = await db.get("SELECT value FROM workspace_settings WHERE workspace_id = $1 AND key = 'kiwify.webhook.secret'", [wsId]);
    const kiwifySecret = wsSettingsRow?.value;

    // 2. Validação HMAC SHA-1 da Kiwify (OBRIGATÓRIA — sem secret, sem processamento)
    if (!kiwifySecret) {
        console.error(`[FRAUDE-KIWIFY] Workspace ${wsId} sem secret configurado.`);
        return res.status(401).json({ error: 'Webhook secret not configured for workspace' });
    }

    const signature = (req.query.signature || req.headers['x-kiwify-signature'] || '').toString();
    if (!signature) {
        console.error(`[FRAUDE-KIWIFY] Assinatura ausente para wsId ${wsId}`);
        return res.status(401).json({ error: 'Missing HMAC signature' });
    }

    // Kiwify assina o BODY BRUTO com SHA-1. Usar req.rawBody capturado em server.js.
    if (!req.rawBody) {
        console.error(`[FRAUDE-KIWIFY] rawBody não disponível para wsId ${wsId}.`);
        return res.status(500).json({ error: 'Raw body unavailable' });
    }

    const expectedSignature = crypto.createHmac('sha1', kiwifySecret).update(req.rawBody).digest('hex');

    try {
        const sigBuf = Buffer.from(signature, 'hex');
        const expBuf = Buffer.from(expectedSignature, 'hex');
        if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
            console.error(`[FRAUDE-KIWIFY] Assinatura não confere para wsId ${wsId}.`);
            return res.status(401).json({ error: 'Invalid HMAC signature' });
        }
    } catch (e) {
        console.error(`[FRAUDE-KIWIFY] Erro ao comparar HMAC para wsId ${wsId}:`, e.message);
        return res.status(401).json({ error: 'Signature check failed' });
    }

    // 3. Idempotência
    const externalId = payload.order_id || crypto.createHash('md5').update(JSON.stringify(payload)).digest('hex');
    const isDuplicate = await checkIdempotency('kiwify', externalId, payload);
    if (isDuplicate) return res.status(200).json({ ok: true, duplicate: true });

    // Kiwify Order Approved Event: payload.order_status === 'paid'
    if (payload && (payload.order_status === 'paid' || payload.status === 'paid' || payload.type === 'OrderApproved')) {
      const value = parseFloat(payload.Commissions?.charge_amount || payload.amount || 0);
      const email = payload.Customer?.email || payload.email || 'webhook@kiwify.com';
      const url = `kiwify.com.br/order/${payload.order_id || 'unknown'}`;
      
      const utm_source = payload.TrackingParameters?.utm_source || null;
      const utm_campaign = payload.TrackingParameters?.utm_campaign || null;

      await db.run(`
        INSERT INTO pixel_events (workspace_id, event_type, url, utm_source, utm_campaign, created_at)
        VALUES ($1, 'purchase', $2, $3, $4, NOW())
      `, [wsId, url, utm_source, utm_campaign]);
      
      console.log(`[WEBHOOK] Kiwify Venda Registrada! R$${value} Workspace: ${wsId}`);
      require('../utils/audit').log('payment.kiwify.received', {
        workspaceId: wsId, actor: 'webhook:kiwify',
        amount: value, order_id: payload.order_id, product: payload.Product?.name,
      });

      // INICIO WA AUTOMATION (Speed-to-lead)
      try {
        const waSettings = await db.get('SELECT * FROM wa_settings WHERE workspace_id = $1 AND active = true', [wsId]);
        if(waSettings && waSettings.api_url) {
          const phone = payload.Customer?.mobile || payload.Customer?.phone || '';
          const name = payload.Customer?.full_name || 'Cliente';
          const prod = payload.Product?.name || 'nosso produto';
          
          if(phone) {
            const number = phone.replace(/\D/g, '');
            // Validação de número de telefone (10 a 13 dígitos)
            if (/^\d{10,13}$/.test(number)) {
                const message = `Fala ${name.split(' ')[0]}! Tudo bem? Vi que você acabou de garantir o ${prod}! Parabéns pela decisão. Precisa de alguma ajuda com o acesso?`;
                
                await sendWhatsAppMessage(waSettings.api_url, waSettings.api_token, number, message);
                console.log(`[WA] Mensagem de Speed-to-lead enviada para ${maskPhone(number)} (Cliente: ${maskText(name)})`);
            } else {
                console.log(`[WA] Número ignorado por falha na Regex: ${maskPhone(number)}`);
            }
          }
        }
      } catch(waError) {
        console.error('[WA] Erro ao disparar zap Kiwify:', waError.message);
      }
      // FIM WA AUTOMATION
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Webhook Kiwify] Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
