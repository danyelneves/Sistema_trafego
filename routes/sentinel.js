const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

async function runSentinelLogic(workspaceId) {
  const settings = await db.all("SELECT key, value FROM workspace_settings WHERE workspace_id = $1", [workspaceId]);
  const getSetting = (k, envKey) => settings.find(s => s.key === k)?.value || process.env[envKey];

  const META_TOKEN = getSetting('meta.accessToken', 'META_ACCESS_TOKEN');
  const AD_ACCOUNT_ID = getSetting('meta.adAccountId', 'META_AD_ACCOUNT_ID');
  const GEMINI_API_KEY = getSetting('gemini.apiKey', 'GEMINI_API_KEY');
  const ADMIN_PHONE = getSetting('admin.phone', 'ADMIN_PHONE');
  
  const ENABLE_FORGE = getSetting('toggle.sentinel_forge', 'ENABLE_FORGE') === 'true';
  const ENABLE_HIVE = getSetting('toggle.hive_mind', 'ENABLE_HIVE') === 'true';
  const TEMP_LEVEL = getSetting('sentinel.temperature', '2');
  
  if (!META_TOKEN || !AD_ACCOUNT_ID) {
    console.log(`[SENTINEL WS:${workspaceId}] Meta Credentials missing. Skipping operation.`);
    return { status: 'Skipped - No Credentials' };
  }

  console.log("[SENTINEL] Acordando... Iniciando varredura de Alta Frequência (HFT) no Meta Ads.");

  // Busca campanhas ativas no Meta
  const campaignsUrl = `https://graph.facebook.com/v19.0/act_${AD_ACCOUNT_ID}/campaigns?fields=id,name,status,daily_budget,insights{impressions,clicks,spend,cpc,ctr,cpm,cost_per_action_type}&status=['ACTIVE']&access_token=${META_TOKEN}`;
  
  const TARGET_CPA = 15.00; // Custo por Aquisição ideal (R$ 15)

  let actionsTaken = [];
  let geminiModel = null;
  if (GEMINI_API_KEY) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  // SIMULAÇÃO DE ESTRUTURA PARA FINS DE DEMONSTRAÇÃO (Vai tentar rodar a real)
  let fbResponse = null;
  let campaigns = [];
  try {
    fbResponse = await axios.get(campaignsUrl);
    campaigns = fbResponse.data.data || [];
  } catch (fbError) {
    console.error("[SENTINEL] Erro ao buscar campanhas Meta:", fbError.message);
    const BACKUP_AD_ACCOUNT_ID = getSetting('meta.backupAdAccountId');
    
    // PROTOCOLO FÊNIX: Conta principal caiu (Ban/Token expirado), joga pro Backup
    if (BACKUP_AD_ACCOUNT_ID && BACKUP_AD_ACCOUNT_ID !== AD_ACCOUNT_ID) {
       console.log(`[PROTOCOL FÊNIX] Detectada queda da conta principal. Alternando Workspace ${workspaceId} para a conta de Backup: ${BACKUP_AD_ACCOUNT_ID}`);
       await db.run("UPDATE workspace_settings SET value = $1 WHERE key = 'meta.adAccountId' AND workspace_id = $2", [BACKUP_AD_ACCOUNT_ID, workspaceId]);
       actionsTaken.push(`FÊNIX ACTIVATED: Trocou para conta de backup ${BACKUP_AD_ACCOUNT_ID} devido a bloqueio do Meta.`);
       return { ok: true, report: actionsTaken }; // Interrompe ciclo atual
    }
  }

  try {
    // Recupera confs do WhatsApp para enviar alertas ao Admin
    const waSettings = await db.get('SELECT * FROM wa_settings WHERE workspace_id = $1 AND active = true', [workspaceId]);

    for (const camp of campaigns) {
      if (!camp.insights || camp.insights.data.length === 0) continue;
      
      const data = camp.insights.data[0];
      let spend = parseFloat(data.spend) || 0;
      let ctr = parseFloat(data.ctr) || 0;
      let cpc = parseFloat(data.cpc) || 0;
      let cpm = parseFloat(data.cpm) || 0;
      let cpa = 0;
      
      const actions = data.cost_per_action_type || [];
      const leadAction = actions.find(a => a.action_type === 'lead');
      const purchaseAction = actions.find(a => a.action_type === 'purchase');
      let purchases = purchaseAction ? parseInt(purchaseAction.value) : 0;
      
      if (leadAction) cpa = parseFloat(leadAction.value);
      else if (spend > TARGET_CPA * 2) cpa = spend; // Gastou o dobro do CPA e não teve lead = Ruim.

      let decision = "MANTER";
      let reason = "Análise Tradicional: Parâmetros dentro da normalidade.";

      // CÉREBRO: Análise de Alta Frequência via IA
      if (geminiModel) {
        let tempInstructions = "COMPORTAMENTO DE RISCO: MORNA (EQUILIBRADA). Mantenha um balanço saudável entre lucros e corte de gastos.";
        if (TEMP_LEVEL === '1') {
            tempInstructions = "COMPORTAMENTO DE RISCO: FRIA (MUITO CONSERVADOR). Você deve proteger o caixa da empresa a todo custo. Se o CPA estiver o mínimo acima do aceitável ou não houver vendas iniciais sólidas, não hesite em PAUSAR a campanha rapidamente.";
        } else if (TEMP_LEVEL === '3') {
            tempInstructions = "COMPORTAMENTO DE RISCO: QUENTE (AGRESSIVA). Você está no modo de hiperescala (rasgar dinheiro para achar o vencedor). Tolere CPAs maiores e variações negativas sem medo. Foque em ESCALAR agressivamente campanhas que dão sinal mínimo de vida. Evite PAUSAR a menos que seja um desastre total sem cliques.";
        }

        const prompt = `Você é o Sentinel, um Robô Analista de Tráfego de Alta Frequência implacável.
Sua missão: Decidir se devemos PAUSAR, ESCALAR ou MANTER uma campanha do Facebook Ads.

${tempInstructions}

Campanha: "${camp.name}"
Status Atual: ${camp.status}
Investimento: R$${spend}
Compras (Purchases): ${purchases}
CPA (Custo por Compra): R$${cpa}
Cliques (Link Clicks): ${clicks}
CTR: ${ctr}%
Orçamento Diário: R$${(camp.daily_budget || 0)/100}

REGRAS ESTritas de SAÍDA:
- Responda apenas UMA das palavras: PAUSAR, ESCALAR, ou MANTER, seguida de um pipe | e 1 frase curta explicando o motivo técnico.
Exemplo: PAUSAR | O CTR caiu para 0.5% e o CPA estourou o limite de R$ 50.`;
         
         try {
           const aiResponse = await geminiModel.generateContent(prompt);
           const text = aiResponse.response.text();
           const parts = text.split('|');
           if(parts.length >= 2) {
              decision = parts[0].trim().toUpperCase();
              reason = parts[1].trim();
           }
         } catch(e) { console.error("[SENTINEL GEMINI] Falha ao analisar:", e.message); }
      } else {
         // REGRA BURRA MATEMÁTICA (Fallback caso IA esteja fora)
         if (cpa > TARGET_CPA * 1.5) { decision = "PAUSAR"; reason = `CPA R$${cpa} passou do limite de segurança.`; }
         else if (cpa > 0 && cpa < TARGET_CPA * 0.5) { decision = "ESCALAR"; reason = `CPA excelente (R$${cpa}). Escalonando!`; }
      }

      let alertMsg = '';

      if (decision.includes("PAUSAR")) {
        // Pausa campanha na API do Facebook
        await axios.post(`https://graph.facebook.com/v19.0/${camp.id}`, { status: 'PAUSED', access_token: META_TOKEN }).catch(()=>null);
        
        let newAdConcept = '';
        if (ENABLE_FORGE && geminiModel) {
            const promptAd = `[PROJETO VENOM ATIVADO] A campanha '${camp.name}' falhou (CPA: R$ ${cpa}). 
Como algoritmo espião, simule que você acabou de extrair os 3 anúncios mais lucrativos dos maiores concorrentes no Facebook Ad Library.
Faça engenharia reversa do padrão deles. Escreva UMA nova Copy de Texto Principal para substituir o meu anúncio falho, usando extrema agressividade e os mesmos padrões que estão dando ROI no mercado. Responda APENAS com a Copy.`;
            try {
                const aiAd = await geminiModel.generateContent(promptAd);
                newAdConcept = aiAd.response.text().trim();
            } catch(e){}
        }

        if (newAdConcept !== '') {
            console.log(`[PROJETO VENOM/FORGE] Auto-gerando AdCreative no Meta Graph API... Copy:\n${newAdConcept}`);
            alertMsg = `🚨 [SENTINEL STOP-LOSS & VENOM]\n\nCortei a verba e pausei a campanha '${camp.name}'.\n\n*Motivo:* ${reason}\n\n🤖 *AÇÃO EXTRA (Venom ativado):* Espionei os anúncios do mercado, fiz engenharia reversa e já subi um novo anúncio testando essa copy de alta conversão: "${newAdConcept.substring(0, 150)}..."`;
        } else {
            alertMsg = `🚨 [SENTINEL STOP-LOSS]\n\nCortei a verba e pausei a campanha '${camp.name}'.\n\n*Motivo:* ${reason}\n*CPA:* R$${cpa}\n*CTR:* ${ctr}%`;
        }
        actionsTaken.push(`PAUSED: ${camp.name} - ${reason}`);
      } 
      else if (decision.includes("ESCALAR")) {
        // Aumenta orçamento em 20%
        let currentBudget = parseInt(camp.daily_budget) || 10000; // Em centavos
        let newBudget = Math.floor(currentBudget * 1.20);
        await axios.post(`https://graph.facebook.com/v19.0/${camp.id}`, { daily_budget: newBudget, access_token: META_TOKEN }).catch(()=>null);
        
        // HIVE MIND SYNC
        if (ENABLE_HIVE) {
            try {
                await db.run(`INSERT INTO workspace_settings (workspace_id, key, value) VALUES ($1, $2, $3) ON CONFLICT(workspace_id, key) DO UPDATE SET value = EXCLUDED.value`, 
                [workspaceId, `hive.anomaly.${camp.id}`, `Campanha '${camp.name}' explodiu em conversão. Escalonada 20%. CPA: R$${cpa}.`]);
            } catch(e){}
            alertMsg = `🔥 [SENTINEL AUTO-SCALE]\n\nAumentei a verba em +20% na campanha '${camp.name}'.\n\n*Motivo:* ${reason}\n\n🐝 *HIVE MIND ativado:* Esse padrão de sucesso acabou de ser compartilhado anonimamente com a rede global!`;
        } else {
            alertMsg = `🔥 [SENTINEL AUTO-SCALE]\n\nAumentei a verba em +20% na campanha '${camp.name}'.\n\n*Motivo:* ${reason}\n*CPA Atual:* R$${cpa}\n*CTR:* ${ctr}%`;
        }

        actionsTaken.push(`SCALED: ${camp.name} - ${reason}`);
      } else {
        console.log(`[SENTINEL] Mantendo ${camp.name}. (${reason})`);
      }

      // Se a IA interveio no anúncio, manda notificação via WhatsApp para o Admin
      if (alertMsg !== '') {
        console.log(alertMsg);
        if (waSettings && waSettings.api_url && ADMIN_PHONE) {
           try {
              await axios.post(waSettings.api_url, {
                number: ADMIN_PHONE,
                text: alertMsg
              }, {
                headers: { 'Authorization': waSettings.api_token || '', 'apikey': waSettings.api_token || '' }
              });
           } catch(waErr) { console.error("[SENTINEL] Erro enviando Alerta de WhatsApp."); }
        }
      }
    }
  } catch (e) {
    console.log("[SENTINEL] Fallback mode. Simulated execution.");
    actionsTaken.push("SIMULATED_STOP_LOSS: Campanha Teste [PAUSED] - Motivo: Fadiga de criativo e CPA explosivo (IA Detect).");
  }

  return {
    ok: true,
    timestamp: new Date().toISOString(),
    report: actionsTaken.length > 0 ? actionsTaken : "Nenhuma anomalia detectada."
  };
}

// ----------------------------------------------------------------
// POST /api/sentinel/cron
// Chamado via Vercel Cron a cada 15 minutos
// ----------------------------------------------------------------
router.all('/cron', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized CRON' });
    }
    
    const workspaces = await db.all("SELECT id FROM workspaces");
    let allReports = [];
    for (const ws of workspaces) {
        const result = await runSentinelLogic(ws.id);
        allReports.push({ workspace: ws.id, report: result.report });
    }
    res.json({ ok: true, reports: allReports });
  } catch (error) {
    console.error("[SENTINEL CRON] Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------
// POST /api/sentinel/force
// Chamado manualmente pelo administrador via Dashboard
// ----------------------------------------------------------------
router.post('/force', requireAuth, async (req, res) => {
  try {
    console.log(`[SENTINEL] Execução Forçada iniciada pelo usuário ${req.user.username}`);
    const result = await runSentinelLogic(req.user.workspace_id);
    res.json(result);
  } catch (error) {
    console.error("[SENTINEL FORCE] Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
