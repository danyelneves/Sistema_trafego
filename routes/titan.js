const express = require('express');
const router = express.Router();
const db = require('../db');
const { generateWithOmniRouter } = require('../utils/omni-router');

// ----------------------------------------------------------------
// POST /api/titan/audit
// NEXUS Titan: CEO Autônomo e Serial
// ----------------------------------------------------------------
router.post('/audit', async (req, res) => {
    try {
        const { force_spin_off } = req.body;
        const workspace_id = req.user ? req.user.workspace_id : 1; // Fallback admin

        const settings = await db.all("SELECT key, value FROM workspace_settings WHERE workspace_id = $1", [workspace_id]);
        const getSetting = (k) => settings.find(s => s.key === k)?.value;

        const MP_TOKEN = getSetting('mercadopago.accessToken');
        if (!MP_TOKEN) throw new Error("Mercado Pago API Key necessária para auditoria do Titan.");

        const keys = {
            GEMINI_API_KEY: getSetting('gemini.apiKey') || process.env.GEMINI_API_KEY,
            ANTHROPIC_API_KEY: getSetting('anthropic.apiKey') || process.env.ANTHROPIC_API_KEY,
            OPENAI_API_KEY: getSetting('openai.apiKey') || process.env.OPENAI_API_KEY,
        };

        // 1. Simulação: Puxar Saldo do Mercado Pago
        // const axios = require('axios');
        // const balanceRes = await axios.get('https://api.mercadopago.com/v1/balance', { headers: { Authorization: `Bearer ${MP_TOKEN}` }});
        // const availableBalance = balanceRes.data.available_balance;
        const availableBalance = 15400.00; // Simulação de saldo alto
        const RISK_CAPITAL_THRESHOLD = 10000;
        const CAPITAL_TO_DEPLOY = 2000;

        console.log(`[NEXUS TITAN] Auditoria iniciada. Saldo atual: R$ ${availableBalance}`);

        if (availableBalance < RISK_CAPITAL_THRESHOLD && !force_spin_off) {
            return res.json({ ok: true, status: "HOLD", message: "Capital insuficiente para Spin-Off de risco." });
        }

        console.log(`[NEXUS TITAN] Orçamento liberado (R$ ${CAPITAL_TO_DEPLOY}). Iniciando pesquisa de mercado para fundar nova empresa...`);

        // 2. Definindo o novo nicho usando OMNI-ROUTER
        const promptNiche = `Atue como um Especialista em Tendências de Mercado Digital. 
Identifique o nicho MAIS lucrativo de produtos digitais hoje com baixa concorrência.
Responda apenas com o nome do nicho. (Ex: Cripto para Iniciantes, Queda de Cabelo, etc).`;
        const targetNiche = await generateWithOmniRouter(promptNiche, 'MEDIUM', keys);

        console.log(`[NEXUS TITAN] Nicho selecionado para nova empresa: ${targetNiche}`);

        // 3. OMNI-ROUTER (GOD_MODE) para arquitetar a empresa
        const promptCorp = `Atue como um Empreendedor Serial. 
Eu te dei R$ 2000 de capital de risco para o nicho de "${targetNiche}".
Gere um JSON com:
- "nome_empresa": Nome da nova marca
- "produto_digital": A ideia do infoproduto (Ex: Ebook passo a passo)
- "copy_anuncio": Copy matadora para Facebook Ads
- "meta_roas": ROAS alvo`;

        const corpBlueprintStr = await generateWithOmniRouter(promptCorp, 'HIGH', keys);
        const corpBlueprint = JSON.parse(corpBlueprintStr.replace(/```json/g, '').replace(/```/g, '').trim());

        console.log(`[NEXUS TITAN] Empresa Fundada! Nome: ${corpBlueprint.nome_empresa}`);

        res.json({
            ok: true,
            status: "SPIN_OFF_EXECUTED",
            financial_report: { available_balance: availableBalance, capital_deployed: CAPITAL_TO_DEPLOY },
            new_company: corpBlueprint
        });

    } catch (e) {
        console.error("[NEXUS TITAN ERROR]", e.message);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
