const express = require('express');
const router = express.Router();
const db = require('../db');

// ----------------------------------------------------------------
// POST /api/heal/webhook
// Auto-Cura (Agentic DevOps) - Recebe logs de erro e conserta código
// ----------------------------------------------------------------
router.post('/webhook', async (req, res) => {
    try {
        const { error_message, stack_trace, file_path } = req.body;
        
        console.log(`[AUTO-HEAL] Falha crítica detectada em ${file_path || 'desconhecido'}`);
        
        // Pega chaves do DB (usa workspace_id = 1 como admin para DevOps)
        const settings = await db.all("SELECT key, value FROM workspace_settings WHERE workspace_id = 1");
        const getSetting = (k) => settings.find(s => s.key === k)?.value;
        
        const { generateWithOmniRouter } = require('../utils/omni-router');
        const keys = {
            GEMINI_API_KEY: getSetting('gemini.apiKey') || process.env.GEMINI_API_KEY,
            ANTHROPIC_API_KEY: getSetting('anthropic.apiKey'),
            OPENAI_API_KEY: getSetting('openai.apiKey')
        };

        const prompt = `Atue como um Engenheiro DevOps Sênior (GOD MODE).
O sistema de produção do NEXUS OS acabou de sofrer um crash crítico.
Erro: ${error_message}
Stack Trace: ${stack_trace}
Arquivo Suspeito: ${file_path}

Sua missão:
Analise o erro e escreva o patch exato (código modificado) para resolver esse problema para sempre.
NÃO explique, NÃO diga "aqui está o código". Retorne APENAS o JSON no formato:
{ "diagnostico": "motivo do erro", "codigo_corrigido": "código completo corrigido", "bash_command": "comando git commit/push sugerido" }`;

        console.log(`[AUTO-HEAL] Acordando OmniRouter em GOD_MODE para análise do Crash...`);
        let aiResponse = await generateWithOmniRouter(prompt, 'HIGH', keys);

        // Limpa possíveis marcações markdown do JSON retornado
        aiResponse = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const fixPlan = JSON.parse(aiResponse);

        console.log(`[AUTO-HEAL] Diagnóstico: ${fixPlan.diagnostico}`);
        console.log(`[AUTO-HEAL] Ação sugerida pronta para execução autônoma.`);

        // Em um ambiente de produção real com permissões de FS, o sistema faria:
        // fs.writeFileSync(file_path, fixPlan.codigo_corrigido);
        // require('child_process').execSync(fixPlan.bash_command);

        res.json({
            ok: true,
            status: "HEAL_PROTOCOL_ACTIVATED",
            diagnostico: fixPlan.diagnostico,
            next_action: "Aguardando aprovação humana para injetar o patch no Vercel",
            patch: fixPlan.codigo_corrigido
        });

    } catch (e) {
        console.error("[AUTO-HEAL ERROR]", e.message);
        res.status(500).json({ error: "Falha catastrófica até no sistema de cura." });
    }
});

module.exports = router;
