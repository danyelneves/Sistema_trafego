const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// ----------------------------------------------------------------
// 1. RECEBER NOVO LEAD (Webhook do Facebook Lead Ads ou Landing Page genérica)
// ----------------------------------------------------------------
router.post('/capture', async (req, res) => {
  try {
    const { workspace_id, niche, city, lead_name, lead_phone, captured_cost } = req.body;
    
    // Inserir lead no leilão
    const sqlInsert = `
      INSERT INTO market_leads (workspace_id, niche, city, lead_name, lead_phone, captured_cost) 
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
    `;
    const { rows } = await db.query(sqlInsert, [workspace_id, niche, city, lead_name, lead_phone, captured_cost]);
    const leadId = rows[0].id;

    // Buscar compradores interessados nesse nicho e cidade
    const sqlBuyers = `SELECT * FROM market_buyers WHERE workspace_id = $1 AND niche = $2 AND city = $3`;
    const buyers = await db.all(sqlBuyers, [workspace_id, niche, city]);

    // O sistema dispararia WhatsApp para cada comprador
    buyers.forEach(buyer => {
      // Usaria a API de Z-API / Evolution aqui
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      console.log(`[ZAP PARA ${buyer.buyer_phone}]: Olá ${buyer.company_name}! Um novo lead de ${niche} acabou de pedir orçamento em ${city}. Clique no link para comprar o contato por R$ 35: ${baseUrl}/api/market/buy/${leadId}/${buyer.id}`);
    });

    res.json({ ok: true, message: `Lead capturado. ${buyers.length} compradores notificados no leilão.` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ----------------------------------------------------------------
// 2. COMPRADOR PAGA E RECEBE O LEAD (A "Bolsa de Valores")
// ----------------------------------------------------------------
router.get('/buy/:lead_id/:buyer_id', async (req, res) => {
  try {
    const { lead_id, buyer_id } = req.params;

    // Verifica se o lead já foi vendido
    const lead = await db.get(`SELECT * FROM market_leads WHERE id = $1`, [lead_id]);
    if (!lead) return res.status(404).send('Lead não encontrado.');
    if (lead.status === 'SOLD') return res.status(400).send('<h1>Lento demais! Outra empresa já comprou este lead no leilão.</h1>');

    const buyer = await db.get(`SELECT * FROM market_buyers WHERE id = $1`, [buyer_id]);
    if (!buyer) return res.status(404).send('Comprador não encontrado.');

    // Simulação: O comprador fez um PIX de R$ 35
    const soldPrice = 35; // R$ 35 no leilão

    // Marca como vendido
    await db.run(`UPDATE market_leads SET status = 'SOLD', buyer_id = $1, sold_price = $2 WHERE id = $3`, [buyer_id, soldPrice, lead_id]);

    // O sistema lucrou: soldPrice - captured_cost. Pura arbitragem.
    
    // Entrega o lead na tela do cliente
    res.send(`
      <h1 style="color: green; font-family: sans-serif;">✅ Pagamento Confirmado!</h1>
      <p style="font-family: sans-serif; font-size: 18px;">Aqui está o seu Lead (Exclusivo):</p>
      <div style="background: #eee; padding: 20px; border-radius: 8px; max-width: 400px; font-family: sans-serif;">
        <strong>Nome:</strong> ${lead.lead_name}<br><br>
        <strong>Telefone / WhatsApp:</strong> ${lead.lead_phone}<br><br>
        <a href="https://wa.me/55${lead.lead_phone.replace(/\D/g, '')}" style="display:block; background:#25D366; color:#fff; text-align:center; padding:15px; text-decoration:none; font-weight:bold; border-radius:8px; margin-top:20px;">CHAMAR LEAD NO WHATSAPP AGORA</a>
      </div>
    `);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ----------------------------------------------------------------
// 3. DASHBOARD: RESUMO PARA O GESTOR (NEXUS OS)
// ----------------------------------------------------------------
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const leads = await db.all(`
      SELECT m.*, b.company_name as buyer_name 
      FROM market_leads m 
      LEFT JOIN market_buyers b ON m.buyer_id = b.id 
      WHERE m.workspace_id = $1 
      ORDER BY m.created_at DESC
    `, [req.user.workspace_id]);
    
    const profit = await db.get(`
      SELECT SUM(sold_price) as total_sold, SUM(captured_cost) as total_cost 
      FROM market_leads 
      WHERE workspace_id = $1 AND status = 'SOLD'
    `, [req.user.workspace_id]);

    res.json({
      leads: leads || [],
      revenue: profit.total_sold || 0,
      cost: profit.total_cost || 0,
      net_profit: (profit.total_sold || 0) - (profit.total_cost || 0)
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Adicionar um comprador na base
router.post('/buyers', requireAuth, async (req, res) => {
  try {
    const { company_name, buyer_phone, niche, city } = req.body;
    await db.run(
      `INSERT INTO market_buyers (workspace_id, company_name, buyer_phone, niche, city) VALUES ($1, $2, $3, $4, $5)`,
      [req.user.workspace_id, company_name, buyer_phone, niche, city]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
