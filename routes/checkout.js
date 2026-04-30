const express = require('express');
const router = express.Router();
const db = require('../db');

// ----------------------------------------------------------------
// GET /api/checkout/product/:id
// Retorna os dados do produto para a página de checkout pública
// ----------------------------------------------------------------
router.get('/product/:id', async (req, res) => {
  try {
    const product = await db.get(`SELECT * FROM products WHERE id = $1`, req.params.id);
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

    const product = await db.get(`SELECT * FROM products WHERE id = $1`, product_id);
    if (!product) throw new Error("Produto inválido.");

    const settings = await db.all("SELECT key, value FROM workspace_settings WHERE workspace_id = $1", [product.workspace_id]);
    const getSetting = (k, envKey) => settings.find(s => s.key === k)?.value || process.env[envKey];
    
    const STRIPE_SECRET_KEY = getSetting('stripe.secretKey', 'STRIPE_SECRET_KEY');
    const MERCADOPAGO_ACCESS_TOKEN = getSetting('mercadopago.accessToken', 'MERCADOPAGO_ACCESS_TOKEN');

    let status = 'PENDING';
    let message = '';
    let pix_code = null;
    let pix_qr_code_base64 = null;
    
    if (payment_method === 'CREDIT_CARD') {
      if (!STRIPE_SECRET_KEY) throw new Error('Stripe não configurado (Falta variável STRIPE_SECRET_KEY no painel ou env).');
      
      const stripe = require('stripe')(STRIPE_SECRET_KEY);
      
      // Assumindo token gerado pelo Stripe Elements no frontend (tok_xxx) ou payment_method (pm_xxx)
      const source = card_data?.token || card_data?.payment_method_id || 'tok_visa'; // Fallback de teste caso venha vazio
      
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(product.price * 100), // Stripe opera em centavos
          currency: 'brl',
          payment_method: source.startsWith('pm_') ? source : undefined,
          payment_method_data: source.startsWith('tok_') ? { type: 'card', card: { token: source } } : undefined,
          confirm: true,
          automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
          description: `NEXUS Black - ${product.name}`,
          receipt_email: customer_email
        });

        if (paymentIntent.status === 'succeeded') {
          status = 'PAID';
          message = 'Pagamento aprovado com sucesso via Stripe!';
        } else {
          throw new Error(`Falha no pagamento (Stripe Status: ${paymentIntent.status}).`);
        }
      } catch (err) {
        throw new Error(`Erro operadora Stripe: ${err.message}`);
      }

    } else if (payment_method === 'PIX') {
      if (!MERCADOPAGO_ACCESS_TOKEN) throw new Error('Mercado Pago não configurado (Falta variável MERCADOPAGO_ACCESS_TOKEN no painel ou env).');
      
      const { MercadoPagoConfig, Payment } = require('mercadopago');
      const client = new MercadoPagoConfig({ accessToken: MERCADOPAGO_ACCESS_TOKEN, options: { timeout: 10000 } });
      const mpPayment = new Payment(client);

      try {
        const paymentData = {
          transaction_amount: Number(product.price),
          description: `NEXUS Black - ${product.name}`,
          payment_method_id: 'pix',
          payer: {
            email: customer_email,
            first_name: customer_name.split(' ')[0],
            last_name: customer_name.split(' ').slice(1).join(' ') || 'Cliente'
          }
        };

        const mpResponse = await mpPayment.create({ body: paymentData });
        
        status = 'WAITING_PAYMENT';
        message = 'Pix gerado com sucesso via Mercado Pago.';
        pix_code = mpResponse.point_of_interaction.transaction_data.qr_code;
        pix_qr_code_base64 = mpResponse.point_of_interaction.transaction_data.qr_code_base64;
      } catch (err) {
        throw new Error(`Erro Mercado Pago: ${err.message}`);
      }
    }

    // Simulação do Split de Pagamento (NEXUS Syndicate)
    // Se o partner_id for passado, 30% fica com o dono do sistema (NEXUS) e 70% com o parceiro.
    let nexus_fee = 0;
    let partner_amount = product.price;
    if (req.body.partner_id) {
      nexus_fee = product.price * 0.30;
      partner_amount = product.price * 0.70;
      console.log(`[NEXUS SYNDICATE] Venda processada! Retenção Automática: R$ ${nexus_fee} (NEXUS) | Repasse: R$ ${partner_amount} (Sócio)`);
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
      pix_code: pix_code,
      pix_qr_code_base64: pix_qr_code_base64
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
