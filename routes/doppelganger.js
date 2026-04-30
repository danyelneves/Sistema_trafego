const express = require('express');
const router = express.Router();
const db = require('../db');
const { generateWithOmniRouter } = require('../utils/omni-router');

// ----------------------------------------------------------------
// POST /api/doppelganger/chat
// NEXUS Doppelgänger: Clone Digital baseado no estilo do dono
// ----------------------------------------------------------------
router.post('/chat', async (req, res) => {
    try {
        const { incoming_message } = req.body;
        const workspace_id = req.user ? req.user.workspace_id : 1;

        const settings = await db.all("SELECT key, value FROM workspace_settings WHERE workspace_id = $1", [workspace_id]);
        const getSetting = (k) => settings.find(s => s.key === k)?.value;

        const keys = {
            GEMINI_API_KEY: getSetting('gemini.apiKey') || process.env.GEMINI_API_KEY,
            ANTHROPIC_API_KEY: getSetting('anthropic.apiKey') || process.env.ANTHROPIC_API_KEY,
            OPENAI_API_KEY: getSetting('openai.apiKey') || process.env.OPENAI_API_KEY,
        };

        // Simulação de Ingestão de Banco de Dados Vetorial (RAG) da "Personalidade de Daniel"
        const personalityContext = `
Gírias comuns: "Mano", "Sacada genial", "Insano", "Bora pra cima".
Humor: Direto, gosta de resolver problemas rápido, fala muito sobre automação e escala.
Erros comuns (simulados para realismo): As vezes esquece vírgulas ou acentos em mensagens rápidas de WhatsApp.`;

        const prompt = `Atue EXATAMENTE como Daniel Neves, CEO de uma agência de automação extrema baseada em IA.
Aqui está a essência da sua personalidade extraída de milhares de mensagens reais do seu WhatsApp:
${personalityContext}

A mensagem que você recebeu foi: "${incoming_message}"
Responda a essa mensagem de forma curta, simulando exatamente o WhatsApp do Daniel. Use a personalidade fornecida.
Não seja um robô de vendas, você é uma pessoa conversando.`;

        console.log(`[DOPPELGÄNGER] Invocando rede neural para simular personalidade...`);
        const cloneReply = await generateWithOmniRouter(prompt, 'MEDIUM', keys); // Claude é perfeito pra isso

        res.json({
            ok: true,
            status: "CLONE_SYNCED",
            reply: cloneReply
        });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
