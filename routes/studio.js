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
        
        const ELEVEN_API_KEY = getSetting('elevenlabs.apiKey') || process.env.ELEVENLABS_API_KEY;
        const VOICE_ID = getSetting('elevenlabs.voiceId') || process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // Sarah (validada)
        
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
        let detail = e.message;
        if (e.response?.data) {
            try {
                const buf = Buffer.isBuffer(e.response.data) ? e.response.data : Buffer.from(e.response.data);
                detail = buf.toString('utf8');
            } catch { /* mantém e.message */ }
        }
        console.error("[STUDIO ERROR] Falha no ElevenLabs:", detail);
        res.status(500).json({ error: detail });
    }
});

// ----------------------------------------------------------------
// POST /api/studio/video
// Gera Vídeo Lip-Sync via HeyGen (Preparação da Rota)
// ----------------------------------------------------------------
router.post('/video', requireAuth, async (req, res) => {
    try {
        const { niche, target_audience } = req.body;
        
        const settings = await db.all("SELECT key, value FROM workspace_settings WHERE workspace_id = $1", [req.user.workspace_id]);
        const getSetting = (k) => settings.find(s => s.key === k)?.value;
        
        const HEYGEN_API_KEY = getSetting('heygen.apiKey') || process.env.HEYGEN_API_KEY;
        if (!HEYGEN_API_KEY) throw new Error("HeyGen API Key não configurada.");

        // 1. OmniRouter - Gerando o script da VSL
        const { generateWithOmniRouter } = require('../utils/omni-router');
        const keys = {
            GEMINI_API_KEY: getSetting('gemini.apiKey') || process.env.GEMINI_API_KEY,
            ANTHROPIC_API_KEY: getSetting('anthropic.apiKey') || process.env.ANTHROPIC_API_KEY,
            OPENAI_API_KEY: getSetting('openai.apiKey') || process.env.OPENAI_API_KEY,
        };

        const prompt = `Atue como um Copywriter Milionário especialista em Vídeos de Vendas (VSL).
Escreva o roteiro completo de um vídeo curto (até 60 segundos de fala) para o nicho de: ${niche}.
O público alvo que está assistindo ao vídeo agora é: ${target_audience}.
O tom deve ser incisivo, mostrando o problema oculto deles e chamando para clicar no botão da página.
Retorne APENAS o texto puro que o avatar deve falar. Sem marcações, sem explicações.`;

        console.log(`[STUDIO] Gerando script de VSL para ${target_audience} via OmniRouter...`);
        const scriptText = await generateWithOmniRouter(prompt, 'MEDIUM', keys);

        // 2. Integração com HeyGen (Avatar Video Generation)
        console.log(`[STUDIO] Disparando renderização no HeyGen...`);
        
        const heygenRes = await axios.post('https://api.heygen.com/v2/video/generate', {
            video_inputs: [
                {
                    character: {
                        type: "avatar",
                        avatar_id: "default_avatar_id", // Idealmente configurável
                        avatar_style: "normal"
                    },
                    voice: {
                        type: "text",
                        input_text: scriptText,
                        voice_id: "en-US-JennyNeural" // Fallback seguro
                    }
                }
            ],
            test: true // Em modo de teste para não gastar créditos reais acidentalmente
        }, {
            headers: { 'X-Api-Key': HEYGEN_API_KEY, 'Content-Type': 'application/json' }
        });

        const videoId = heygenRes.data.data.video_id;

        res.json({ ok: true, video_id: videoId, script: scriptText, status: "RENDER_QUEUED" });
    } catch(e) {
        console.error("[STUDIO ERROR]", e.message);
        res.status(500).json({ error: e.response?.data || e.message });
    }
});

module.exports = router;
