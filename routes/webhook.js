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

    console.log(`[Webhook Sales] Venda registrada. Workspace: ${workspace_id} | Valor: ${contract_value} | Canal: ${channel}`);
    res.json({ success: true, external_id });
  } catch (e) {
    console.error('[Webhook Sales] Erro:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
