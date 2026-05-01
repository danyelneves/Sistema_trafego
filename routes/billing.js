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
        // Na vida real, redirecionaria pro Checkout da Stripe
        // Aqui simulamos o limite sendo aumentado
        const newLimit = plan_name === 'ELITE' ? 200.00 : (plan_name === 'GROWTH' ? 50.00 : 0.00);
        
        await db.run("UPDATE workspace_billing SET plan_type = $1, credits_limit = $2 WHERE workspace_id = $3", [plan_name, newLimit, req.user.workspace_id]);
        
        res.json({ ok: true, message: `Plano atualizado para ${plan_name}. Limite de Inteligência Artificial aumentado para R$${newLimit}.` });
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
