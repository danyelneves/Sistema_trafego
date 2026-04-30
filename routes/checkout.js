const express = require('express');
const router = express.Router();
const db = require('../db');

// ----------------------------------------------------------------
// GET /api/checkout/product/:id
// Retorna os dados do produto para a página de checkout pública
// ----------------------------------------------------------------
router.get('/product/:id', async (req, res) => {
  try {
    const product = await db.get(`SELECT * FROM products WHERE id = $1`, [req.params.id]);
    if (!product) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------
// POST /api/checkout/process
// O "Gateway de Pagamento" Nativo. Recebe cartão ou Pix.
// ----------------------------------------------------------------
router.post('/process', async (req, res) => {
  try {
    const { product_id, customer_name, customer_email, customer_phone, payment_method, card_data } = req.body;

    const product = await db.get(`SELECT * FROM products WHERE id = $1`, [product_id]);
    if (!product) throw new Error("Produto inválido.");

    // SIMULAÇÃO DE GATEWAY (Stripe / Mercado Pago)
    let status = 'PENDING';
    let message = '';
    
    if (payment_method === 'CREDIT_CARD') {
      // Simula autorização do cartão
      if (card_data && card_data.number.startsWith('4')) {
        status = 'PAID'; // Sucesso instantâneo para VISA
        message = 'Pagamento aprovado com sucesso no Cartão de Crédito!';
      } else {
        throw new Error('Cartão recusado pela operadora.');
      }
    } else if (payment_method === 'PIX') {
      status = 'WAITING_PAYMENT';
      message = 'Pix gerado com sucesso. Aguardando pagamento.';
    }

    // Simulação do Split de Pagamento (NEXUS Syndicate)
    // Se o partner_id for passado, 30% fica com o dono do sistema (NEXUS) e 70% com o parceiro.
    let nexus_fee = 0;
    let partner_amount = product.price;
    if (req.body.partner_id) {
      nexus_fee = product.price * 0.30;
      partner_amount = product.price * 0.70;
      console.log(`[NEXUS SYNDICATE] Venda processada! Retenção Automática: R$ \${nexus_fee} (NEXUS) | Repasse: R$ \${partner_amount} (Sócio)`);
    }

    // Grava a Ordem de Compra
    const sqlInsert = `
      INSERT INTO orders (product_id, workspace_id, customer_name, customer_email, customer_phone, amount, payment_method, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
    `;
    const { rows } = await db.query(sqlInsert, [
      product.id, product.workspace_id, customer_name, customer_email, customer_phone, product.price, payment_method, status
    ]);

    const orderId = rows[0].id;

    // Se pago com sucesso, dispara liberação de acesso na "Área de Membros"
    if (status === 'PAID') {
      console.log(`[ÁREA DE MEMBROS]: Gerando senha para ${customer_email}... Disparando Z-API para ${customer_phone}...`);
      console.log(`[FINANCEIRO]: R$ ${product.price} adicionado ao saldo do NEXUS. Zero taxas Kiwify.`);
    }

    res.json({
      ok: true,
      order_id: orderId,
      status: status,
      message: message,
      pix_code: payment_method === 'PIX' ? `00020101021126580014br.gov.bcb.pix0136NEXUS${orderId}` : null
    });

  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ----------------------------------------------------------------
// GET /api/checkout/orders
// Lista as vendas do NEXUS Black para o Dashboard
// ----------------------------------------------------------------
const { requireAuth } = require('../middleware/auth');
router.get('/orders', requireAuth, async (req, res) => {
  try {
    const orders = await db.all(`
      SELECT o.*, p.name as product_name 
      FROM orders o 
      JOIN products p ON o.product_id = p.id 
      WHERE o.workspace_id = $1 
      ORDER BY o.created_at DESC LIMIT 50
    `, [req.user.workspace_id]);
    
    let totalSales = 0;
    orders.forEach(o => { if(o.status === 'PAID') totalSales += Number(o.amount); });

    res.json({ ok: true, total: totalSales, orders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
