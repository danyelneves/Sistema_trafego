const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const db = require('../db');

// Cria as tabelas do NEXUS Pay se não existirem
async function setupPayTables() {
  const sql = `
  CREATE TABLE IF NOT EXISTS pay_transactions (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
    client_name VARCHAR(100),
    amount NUMERIC,
    nexus_fee NUMERIC,
    net_amount NUMERIC,
    status VARCHAR(50) DEFAULT 'PENDING',
    pix_code VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  `;
  await db.run(sql).catch(e => console.error("NEXUS Pay setup error:", e.message));
}
setupPayTables();

// ----------------------------------------------------------------
// POST /api/pay/charge
// Gera a cobrança (Pix) para o cliente da agência.
// ----------------------------------------------------------------
router.post('/charge', requireAuth, async (req, res) => {
  try {
    const { client_name, amount, description } = req.body;
    
    if (!amount || amount <= 0) throw new Error("Valor inválido.");

    const fee_percent = 0.025; // NEXUS toma 2.5% de pedágio em tudo que passar aqui
    const fee_amount = amount * fee_percent;
    const net_amount = amount - fee_amount;

    // Simula a geração de um PIX Copia e Cola via MercadoPago/Asaas
    const pixCode = `00020101021126580014br.gov.bcb.pix0136${Math.random().toString(36).substring(2)}5204000053039865405${amount.toFixed(2)}5802BR5910NEXUS_PAY6009SAO_PAULO62140510LAZARUS${Math.floor(Math.random()*1000)}6304${Math.floor(Math.random()*9999)}`;

    const insertSql = `
      INSERT INTO pay_transactions (workspace_id, client_name, amount, nexus_fee, net_amount, status, pix_code) 
      VALUES ($1, $2, $3, $4, $5, 'PENDING', $6) RETURNING id
    `;
    const { rows } = await db.query(insertSql, [req.user.workspace_id, client_name, amount, fee_amount, net_amount, pixCode]);

    res.json({
      ok: true,
      transaction_id: rows[0].id,
      client_name,
      gross_amount: amount,
      nexus_fee: fee_amount,
      net_to_agency: net_amount,
      pix_code: pixCode,
      message: `Cobrança de R$ ${amount.toFixed(2)} gerada para ${client_name}.`
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------
// GET /api/pay/statement
// Extrato da Agência no NEXUS Pay
// ----------------------------------------------------------------
router.get('/statement', requireAuth, async (req, res) => {
  try {
    const txs = await db.all(`SELECT * FROM pay_transactions WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 50`, [req.user.workspace_id]);
    
    let balance = 0;
    txs.forEach(t => {
      if(t.status === 'PAID') balance += Number(t.net_amount);
    });

    res.json({ ok: true, balance, transactions: txs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
