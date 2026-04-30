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
    }

    res.json({ received: true });
  } catch (e) {
    console.error('[WEBHOOK ERROR]', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
