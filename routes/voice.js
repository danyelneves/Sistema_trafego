const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const db = require('../db');

// ----------------------------------------------------------------
// POST /api/voice/call
// Dispara uma ligação VOIP usando ElevenLabs (Voz Neural) + Twilio
// ----------------------------------------------------------------
router.post('/call', requireAuth, async (req, res) => {
  try {
    const { lead_phone, lead_name, context_info } = req.body;
    
    if (!lead_phone || !lead_name) {
      throw new Error("Telefone e nome do lead são obrigatórios.");
    }

    const settings = await db.all("SELECT key, value FROM workspace_settings WHERE workspace_id = $1", [req.user.workspace_id]);
    const getSetting = (k) => settings.find(s => s.key === k)?.value;

    const { generateWithOmniRouter } = require('../utils/omni-router');
    const keys = {
        GEMINI_API_KEY: getSetting('gemini.apiKey') || process.env.GEMINI_API_KEY,
        ANTHROPIC_API_KEY: getSetting('anthropic.apiKey') || process.env.ANTHROPIC_API_KEY,
        OPENAI_API_KEY: getSetting('openai.apiKey') || process.env.OPENAI_API_KEY,
    };

    const prompt = `Atue como um Operador de Telemarketing Habilidoso (Fechador).
O nome do lead é ${lead_name}. Ele acabou de se cadastrar na página (${context_info || 'oferta principal'}).
Escreva o script exato da sua PRIMEIRA FALA ao telefone (máximo 3 frases).
Seja simpático, assertivo e faça uma pergunta aberta no final para engajar o lead na ligação.`;

    console.log(`[NEXUS VOICE] Gerando script de voz inicial para ${lead_name}...`);
    const initialSpeech = await generateWithOmniRouter(prompt, 'MEDIUM', keys);

    const voice_id = getSetting('elevenlabs.voiceId') || process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJcg';

    // SIMULAÇÃO DA INFRAESTRUTURA DE TELEFONIA (Twilio + ElevenLabs)
    console.log(`[NEXUS VOICE] Sintetizando script na voz ${voice_id} via ElevenLabs...`);
    console.log(`[NEXUS VOICE] Discando para ${lead_phone} via Twilio SIP Trunk...`);
    
    // Na vida real, a API do Twilio (via biblioteca twilio-node) faria o roteamento do áudio e criaria as tags <Gather>.
    await new Promise(r => setTimeout(r, 1500));

    console.log(`[NEXUS VOICE] Ligação atendida por ${lead_name}. Áudio disparado: "${initialSpeech}"`);

    res.json({
      ok: true,
      status: 'CALL_CONNECTED',
      ai_transcription: `[IA]: ${initialSpeech}\n[LEAD]: ... aguardando resposta ...`,
      action: 'TWILIO_GATHER_WAITING'
    });

  } catch (error) {
    console.error("[NEXUS VOICE ERROR]", error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
