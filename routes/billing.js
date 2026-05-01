const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const v = require('../utils/validate');
const log = require('../middleware/logger');
const audit = require('../utils/audit');

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

        // Tabela workspace_billing é criada via migrations/2026_security_hardening.sql

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
router.post('/upgrade', requireAuth, async (req, res, next) => {
    try {
        const { plan_name } = v.parse(req.body, {
            plan_name: v.enum(['STARTER', 'GROWTH', 'ELITE']),
        });

        // Puxa a chave do Mercado Pago do Dono do Sistema (Workspace 1)
        const ownerSettings = await db.all("SELECT key, value FROM workspace_settings WHERE workspace_id = 1");
        const ownerMpToken = ownerSettings.find(s => s.key === 'mercadopago.accessToken')?.value;

        if (!ownerMpToken || !ownerMpToken.startsWith('APP_USR')) {
            log.warn('Tentativa de upgrade com MP não configurado', { workspaceId: req.user.workspace_id });
            return res.status(503).json({
                error: 'Pagamento indisponível no momento. Contate o suporte.'
            });
        }

        const PLAN_PRICES = { STARTER: 97.00, GROWTH: 297.00, ELITE: 997.00 };
        const price = PLAN_PRICES[plan_name];

        const protocol = process.env.NODE_ENV === 'production' ? 'https' : req.protocol;
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
                    success: `${protocol}://${req.get('host')}/dashboard`,
                    failure: `${protocol}://${req.get('host')}/dashboard`,
                    pending: `${protocol}://${req.get('host')}/dashboard`
                },
                auto_return: "approved"
            })
        });
        const mpData = await mpRes.json();

        if (mpData.init_point) {
            log.info('Checkout MP gerado', { workspaceId: req.user.workspace_id, plan_name, price });
            audit.log('billing.upgrade.checkout_created', {
                workspaceId: req.user.workspace_id,
                userId: req.user.id,
                ip: req.ip,
                plan_name,
                price,
            });
            return res.json({ ok: true, checkout_url: mpData.init_point });
        }

        log.error('MP retornou sem init_point', null, { workspaceId: req.user.workspace_id, plan_name, mpResponse: mpData });
        return res.status(502).json({ error: 'Falha ao gerar checkout no Mercado Pago. Tente novamente em instantes.' });
    } catch (e) {
        next(e); // ValidationError vira 400, outros viram 500 com Sentry
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
