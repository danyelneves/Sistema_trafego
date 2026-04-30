const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const axios = require('axios');
const db = require('../db');

// ----------------------------------------------------------------
// POST /api/studio/audio
// Gera Áudio hiper-realista com ElevenLabs (Clonagem de Voz)
// ----------------------------------------------------------------
router.post('/audio', requireAuth, async (req, res) => {
    try {
        const { text } = req.body;
        
        const settings = await db.all("SELECT key, value FROM workspace_settings WHERE workspace_id = $1", [req.user.workspace_id]);
        const getSetting = (k) => settings.find(s => s.key === k)?.value;
        
        const ELEVEN_API_KEY = getSetting('elevenlabs.apiKey');
        const VOICE_ID = getSetting('elevenlabs.voiceId') || 'pNInz6obpgDQGcFmaJcg'; // Fallback
        
        if (!ELEVEN_API_KEY) {
            return res.status(400).json({error: "ElevenLabs API Key não configurada no workspace."});
        }

        console.log(`[STUDIO] Sintetizando voz (ElevenLabs) para o texto: "${text.substring(0, 30)}..."`);

        const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;
        
        const response = await axios.post(url, {
            text: text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75
            }
        }, {
            headers: {
                'xi-api-key': ELEVEN_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'audio/mpeg'
            },
            responseType: 'arraybuffer' // Para pegar o áudio em binário
        });

        const base64Audio = Buffer.from(response.data, 'binary').toString('base64');
        const audioDataUri = `data:audio/mpeg;base64,${base64Audio}`;

        res.json({ ok: true, audio_base64: audioDataUri });
    } catch(e) {
        console.error("[STUDIO ERROR] Falha no ElevenLabs:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// ----------------------------------------------------------------
// POST /api/studio/video
// Gera Vídeo Lip-Sync via HeyGen (Preparação da Rota)
// ----------------------------------------------------------------
router.post('/video', requireAuth, async (req, res) => {
    try {
        // ... Preparação para a arquitetura HeyGen ...
        res.json({ ok: true, status: "EM CONSTRUÇÃO" });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
