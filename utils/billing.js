const db = require('../db');

// Tabela de Preços de Custo (Simulados em BRL para o Billing)
const COST_TABLE = {
    'VOICE_ELEVENLABS_GEN': 0.15, // R$0.15 por chamada
    'VIDEO_HEYGEN_GEN': 2.50,     // R$2.50 por vídeo gerado
    'LLM_OMNI_MEDIUM': 0.03,      // R$0.03 por requisição (Claude Sonnet / GPT-4o)
    'LLM_OMNI_HIGH': 0.10         // R$0.10 por requisição pesada (Opus / GOD_MODE)
};

/**
 * Motor de Faturamento (Metering)
 * Verifica se o workspace tem saldo. Se tiver, debita o custo. 
 * Se estourar o limite (Free Trial), ele bloqueia a ação e pede a chave própria ou upgrade de plano.
 */
async function checkAndCharge(workspace_id, actionType) {
    const cost = COST_TABLE[actionType] || 0;
    
    // Tenta ler o plano do cliente. Se a tabela não existir, simulamos o comportamento
    try {
        let billing = await db.get("SELECT plan_type, credits_limit, credits_used FROM workspace_billing WHERE workspace_id = $1", [workspace_id]);
        
        // Se cliente novo, cria plano TRIAL (Degustação com limite de R$ 5,00)
        if (!billing) {
            await db.run("INSERT INTO workspace_billing (workspace_id, plan_type, credits_limit, credits_used) VALUES ($1, 'TRIAL', 5.00, 0.00)", [workspace_id]);
            billing = { plan_type: 'TRIAL', credits_limit: 5.00, credits_used: 0.00 };
        }

        // Verifica se a ação vai ultrapassar o limite
        if ((billing.credits_used + cost) > billing.credits_limit) {
            throw new Error(`[PAYWALL] Limite do Plano Atingido! (Gasto: R$${billing.credits_used.toFixed(2)} / Limite: R$${billing.credits_limit.toFixed(2)}). 
            Por favor, adicione suas próprias chaves de API no painel de 'Integrações' (BYOK) ou assine o Plano NEXUS Master para limite estendido.`);
        }

        // Se tem limite, debita da cota do cliente.
        await db.run("UPDATE workspace_billing SET credits_used = credits_used + $1 WHERE workspace_id = $2", [cost, workspace_id]);
        
        console.log(`[BILLING] Debitado R$${cost.toFixed(2)} do Workspace ${workspace_id}. (Ação: ${actionType})`);
        return true;

    } catch (e) {
        // Se a tabela ainda não existir no Postgres, avisa mas não quebra o sistema.
        if (e.message.includes('relation "workspace_billing" does not exist')) {
            console.log(`[BILLING ALERTA] A tabela 'workspace_billing' ainda não foi criada no Supabase. Consumo não debitado.`);
            return true; 
        }
        throw e;
    }
}

module.exports = { checkAndCharge, COST_TABLE };
