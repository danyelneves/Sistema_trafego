const express = require('express');
const router = express.Router();
const db = require('../db');
const { generateWithOmniRouter } = require('../utils/omni-router');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const audit = require('../utils/audit');

const PERSONA_KEYS = ['doppelganger.persona_name', 'doppelganger.persona_bio', 'doppelganger.persona_traits'];

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

// ----------------------------------------------------------------
// GET /api/doppelganger/persona
// Retorna a persona configurada do workspace + defaults Nexus.
// ----------------------------------------------------------------
router.get('/persona', requireAuth, async (req, res) => {
    try {
        const workspace_id = req.user.workspace_id;
        const rows = await db.all(
            "SELECT key, value FROM workspace_settings WHERE workspace_id = $1 AND key = ANY($2)",
            [workspace_id, PERSONA_KEYS]
        );
        const get = (k) => rows.find(r => r.key === k)?.value || '';
        res.json({
            ok: true,
            persona: {
                name:   get('doppelganger.persona_name'),
                bio:    get('doppelganger.persona_bio'),
                traits: get('doppelganger.persona_traits'),
            },
            defaults: {
                name:   DEFAULT_PERSONA_NAME,
                bio:    DEFAULT_PERSONA_BIO,
                traits: DEFAULT_PERSONA_TRAITS,
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ----------------------------------------------------------------
// PUT /api/doppelganger/persona
// Atualiza persona do workspace. Apenas admin pode alterar.
// Body: { name?, bio?, traits? } — strings vazias removem o override.
// ----------------------------------------------------------------
router.put('/persona', requireAuth, requireAdmin, async (req, res) => {
    try {
        const workspace_id = req.user.workspace_id;
        const { name, bio, traits } = req.body || {};
        const map = {
            'doppelganger.persona_name':   name,
            'doppelganger.persona_bio':    bio,
            'doppelganger.persona_traits': traits,
        };
        for (const [key, value] of Object.entries(map)) {
            if (value === undefined) continue;
            if (value === null || String(value).trim() === '') {
                await db.run(
                    'DELETE FROM workspace_settings WHERE workspace_id = $1 AND key = $2',
                    [workspace_id, key]
                );
            } else {
                await db.run(
                    `INSERT INTO workspace_settings (workspace_id, key, value) VALUES ($1, $2, $3)
                     ON CONFLICT (workspace_id, key) DO UPDATE SET value = EXCLUDED.value`,
                    [workspace_id, key, String(value).trim()]
                );
            }
        }
        audit.log('doppelganger.persona.updated', {
          ...audit.fromReq(req),
          changed: Object.keys(map).filter(k => map[k.replace('doppelganger.persona_','')] !== undefined),
        });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
