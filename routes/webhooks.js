const express = require('express');
const router = express.Router();
const db = require('../db');

// Exemplo: /api/webhooks/kiwify/:wsId
router.post('/kiwify/:wsId', async (req, res) => {
  try {
    const { wsId } = req.params;
    const payload = req.body;

    // Kiwify Order Approved Event: payload.order_status === 'paid'
    // This is a simplified check, adjust based on actual Kiwify payload.
    if (payload && (payload.order_status === 'paid' || payload.status === 'paid' || payload.type === 'OrderApproved')) {
      const value = parseFloat(payload.Commissions?.charge_amount || payload.amount || 0);
      const email = payload.Customer?.email || payload.email || 'webhook@kiwify.com';
      const url = `kiwify.com.br/order/${payload.order_id || 'unknown'}`;
      
      // Look for UTMs in the payload if Kiwify passed them
      const utm_source = payload.TrackingParameters?.utm_source || null;
      const utm_campaign = payload.TrackingParameters?.utm_campaign || null;

      await db.run(`
        INSERT INTO pixel_events (workspace_id, event_type, url, utm_source, utm_campaign, created_at)
        VALUES ($1, 'purchase', $2, $3, $4, NOW())
      `, [wsId, url, utm_source, utm_campaign]);
      
      // Em um cenário real, também adicionaríamos a receita real na api_metrics_cache
      // ou teríamos uma tabela transactions para bater com o DRE.
      
      console.log(`[WEBHOOK] Kiwify Venda Registrada! R$${value} Workspace: ${wsId}`);
    // INICIO WA AUTOMATION (Speed-to-lead)
    try {
      const waSettings = await db.get('SELECT * FROM wa_settings WHERE workspace_id = $1 AND active = true', [wsId]);
      if(waSettings && waSettings.api_url) {
        const phone = payload.Customer?.mobile || payload.Customer?.phone || '';
        const name = payload.Customer?.full_name || 'Cliente';
        const prod = payload.Product?.name || 'nosso produto';
        if(phone) {
          const number = phone.replace(/\D/g, '');
          const message = `Fala ${name.split(' ')[0]}! Tudo bem? Vi que você acabou de garantir o ${prod}! Parabéns pela decisão. Precisa de alguma ajuda com o acesso?`;
          
          await fetch(waSettings.api_url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': waSettings.api_token || '',
              'apikey': waSettings.api_token || ''
            },
            body: JSON.stringify({ number, message, text: message }) // Sending both message and text to support multiple apis (evolution/zapi)
          });
          console.log('[WA] Mensagem enviada para', number);
        }
      }
    } catch(waError) {
      console.error('[WA] Erro ao disparar zap:', waError.message);
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
