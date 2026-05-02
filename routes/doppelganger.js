const express = require('express');
const router = express.Router();
const db = require('../db');
const { generateWithOmniRouter } = require('../utils/omni-router');

const DEFAULT_PERSONA_NAME = 'o(a) CEO da empresa';
const DEFAULT_PERSONA_BIO = 'Atendente experiente em vendas consultivas, foco em automação e escala.';
const DEFAULT_PERSONA_TRAITS = `Tom: direto, cordial, resolutivo. Sem jargão técnico desnecessário.
Estilo: mensagens curtas de WhatsApp, sem soar robótico.
Objetivo: entender a necessidade do cliente e conduzir naturalmente para o fechamento.`;

// ----------------------------------------------------------------
// POST /api/doppelganger/chat
// Nexus Doppelgänger: clone digital configurável por workspace.
// Cada workspace define sua própria persona via workspace_settings:
//   doppelganger.persona_name   → nome do "clone" (ex: "Carlos")
//   doppelganger.persona_bio    → bio curta (ex: "Sócio da Acme, 10 anos no mercado")
//   doppelganger.persona_traits → tom, gírias, estilo de escrita
// ----------------------------------------------------------------
router.post('/chat', async (req, res) => {
    try {
        const incoming_message = req.body?.incoming_message || req.body?.message || '';
        const workspace_id = req.user ? req.user.workspace_id : 1;

        const settings = await db.all("SELECT key, value FROM workspace_settings WHERE workspace_id = $1", [workspace_id]);
        const getSetting = (k) => settings.find(s => s.key === k)?.value;

        const keys = {
            GEMINI_API_KEY: getSetting('gemini.apiKey') || process.env.GEMINI_API_KEY,
            ANTHROPIC_API_KEY: getSetting('anthropic.apiKey') || process.env.ANTHROPIC_API_KEY,
            OPENAI_API_KEY: getSetting('openai.apiKey') || process.env.OPENAI_API_KEY,
        };

        const personaName   = getSetting('doppelganger.persona_name')   || DEFAULT_PERSONA_NAME;
        const personaBio    = getSetting('doppelganger.persona_bio')    || DEFAULT_PERSONA_BIO;
        const personaTraits = getSetting('doppelganger.persona_traits') || DEFAULT_PERSONA_TRAITS;

        const prompt = `Atue EXATAMENTE como ${personaName}.
Bio: ${personaBio}

Características da personalidade:
${personaTraits}

Mensagem recebida: "${incoming_message}"
Responda de forma curta, no estilo de WhatsApp, mantendo a persona acima. Você é uma pessoa conversando, não um robô de vendas.`;

        console.log(`[DOPPELGÄNGER] Sintetizando resposta workspace=${workspace_id}`);
        const cloneReply = await generateWithOmniRouter(prompt, 'MEDIUM', keys);

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
