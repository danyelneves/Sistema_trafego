const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// ----------------------------------------------------------------
// GET /api/billing/master
// Visão de Administrador (NEXUS Master) para ver faturamento
// ----------------------------------------------------------------
router.get('/master', requireAuth, async (req, res) => {
    try {
        // Apenas o dono do sistema (Daniel) tem acesso a esse painel
        if (req.user.workspace_id !== 1) {
            return res.status(403).json({ error: "Acesso Negado. Apenas o Administrator (Workspace 1) pode ver o faturamento geral." });
        }

        // Se a tabela não existir, criar automaticamente na primeira vez
        await db.run(`
            CREATE TABLE IF NOT EXISTS workspace_billing (
                workspace_id INTEGER PRIMARY KEY,
                plan_type VARCHAR(50) DEFAULT 'TRIAL',
                credits_limit NUMERIC(10,2) DEFAULT 5.00,
                credits_used NUMERIC(10,2) DEFAULT 0.00
            )
        `);

        const tenants = await db.all(`
            SELECT 
                w.id as workspace_id, 
                w.name as workspace_name,
                b.plan_type, 
                b.credits_limit, 
                b.credits_used 
            FROM workspaces w
            LEFT JOIN workspace_billing b ON w.id = b.workspace_id
        `);

        // Calcula a margem de faturamento total do mês para o dono (Mark-up estimado)
        const totalApiCost = tenants.reduce((acc, t) => acc + parseFloat(t.credits_used || 0), 0);
        const overageBilled = totalApiCost * 1.30; // 30% de Mark-up em cima do que os clientes gastaram

        res.json({
            ok: true,
            total_customers: tenants.length,
            your_api_cost: `R$ ${totalApiCost.toFixed(2)}`,
            your_revenue_billed: `R$ ${overageBilled.toFixed(2)}`,
            profit: `R$ ${(overageBilled - totalApiCost).toFixed(2)}`,
            tenants: tenants
        });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ----------------------------------------------------------------
// POST /api/billing/upgrade
// Cliente pede Upgrade de Plano
// ----------------------------------------------------------------
router.post('/upgrade', requireAuth, async (req, res) => {
    try {
        const { plan_name } = req.body;
        
        // Puxa a chave do Mercado Pago do Dono do Sistema (Workspace 1)
        const ownerSettings = await db.all("SELECT key, value FROM workspace_settings WHERE workspace_id = 1");
        let ownerMpToken = ownerSettings.find(s => s.key === 'mercadopago.accessToken')?.value;
        
        // Fallback Global: Tenta puxar direto da Vercel se não tiver no banco de dados
        if (!ownerMpToken && process.env.MERCADOPAGO_ACCESS_TOKEN) {
            ownerMpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        }

        const newLimit = plan_name === 'ELITE' ? 200.00 : (plan_name === 'GROWTH' ? 50.00 : 0.00);
        const price = plan_name === 'ELITE' ? 997.00 : (plan_name === 'GROWTH' ? 297.00 : 97.00);

        if (ownerMpToken && ownerMpToken.startsWith('APP_USR')) {
            // Cria um link de Checkout real no Mercado Pago do Dono
            const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${ownerMpToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    items: [{
                        title: `NEXUS OS - Plano ${plan_name}`,
                        quantity: 1,
                        unit_price: price,
                        currency_id: 'BRL'
                    }],
                    external_reference: `UPGRADE_${req.user.workspace_id}_${plan_name}`,
                    back_urls: {
                        success: `${req.protocol}://${req.get('host')}/dashboard`,
                        failure: `${req.protocol}://${req.get('host')}/dashboard`,
                        pending: `${req.protocol}://${req.get('host')}/dashboard`
                    },
                    auto_return: "approved"
                })
            });
            const mpData = await mpRes.json();
            
            if (mpData.init_point) {
                // Removemos o "UPDATE provisório". O plano só vai mudar via Webhook após o pagamento.
                return res.json({ ok: true, checkout_url: mpData.init_point });
            }
        }

        // Fallback: Se o dono ainda não configurou o Mercado Pago, fazemos o upgrade "Fiado/Mock" para não travar os testes
        await db.run("UPDATE workspace_billing SET plan_type = $1, credits_limit = $2 WHERE workspace_id = $3", [plan_name, newLimit, req.user.workspace_id]);
        res.json({ ok: true, message: `Mock: Plano atualizado para ${plan_name}. Limite aumentado para R$${newLimit} (Adicione sua chave do MP para cobrar real).` });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// ----------------------------------------------------------------
// GET /api/billing/me
// O próprio cliente vê o seu consumo de IA e o limite de degustação
// ----------------------------------------------------------------
router.get('/me', requireAuth, async (req, res) => {
    try {
        let billing = await db.get("SELECT * FROM workspace_billing WHERE workspace_id = $1", [req.user.workspace_id]);
        
        if (!billing) {
            // Cria trial se não existir
            await db.run("INSERT INTO workspace_billing (workspace_id, plan_type, credits_limit, credits_used) VALUES ($1, 'TRIAL', 5.00, 0.00)", [req.user.workspace_id]);
            billing = { plan_type: 'TRIAL', credits_limit: 5.00, credits_used: 0.00 };
        }

        res.json({
            plan_type: billing.plan_type,
            credits_limit: parseFloat(billing.credits_limit),
            credits_used: parseFloat(billing.credits_used)
        });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
