const db = require('../db');
const { fetchMetricsByDateRange } = require('../routes/metrics'); // Import the logic or do direct DB calls
// Em um sistema real, importariamos as SDKs do Meta e Google Ads aqui

async function runAutomations() {
  console.log('[Automations Engine] Iniciando varredura de Stop-Loss...');
  try {
    // Buscar automações ativas
    const activeRules = await db.all('SELECT * FROM automations WHERE active = true');
    if (!activeRules || activeRules.length === 0) {
      console.log('[Automations Engine] Nenhuma automação ativa.');
      return;
    }

    // Para cada automação, precisaríamos buscar os dados consolidados das campanhas do workspace dela.
    // Como simplificação (MVP para agência), vamos apenas registrar que o motor varreu e identificou as regras.
    for (const rule of activeRules) {
      console.log(`[Automations Engine] Avaliando regra ID ${rule.id} (${rule.name}) - Workspace ${rule.workspace_id}`);
      
      // Buscar métricas dos ultimos 7 dias para o workspace (Exemplo)
      const sqlMetrics = `
        SELECT campaign_name, SUM(spend) as total_spend, SUM(revenue) as total_revenue, SUM(leads) as total_leads, SUM(clicks) as total_clicks
        FROM api_metrics_cache
        WHERE workspace_id = $1 AND date >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY campaign_name
      `;
      const campaigns = await db.all(sqlMetrics, rule.workspace_id) || [];

      for (const camp of campaigns) {
        let metricVal = 0;
        if (rule.metric === 'spend') metricVal = camp.total_spend;
        if (rule.metric === 'roas') metricVal = camp.total_spend > 0 ? (camp.total_revenue / camp.total_spend) : 0;
        if (rule.metric === 'cpl') metricVal = camp.total_leads > 0 ? (camp.total_spend / camp.total_leads) : 0;
        if (rule.metric === 'cpc') metricVal = camp.total_clicks > 0 ? (camp.total_spend / camp.total_clicks) : 0;

        let shouldTrigger = false;
        if (rule.operator === '>' && metricVal > rule.value) shouldTrigger = true;
        if (rule.operator === '<' && metricVal < rule.value) shouldTrigger = true;

        if (shouldTrigger) {
          console.log(`[Automations Engine] ALERTA! Campanha '${camp.campaign_name}' atingiu o gatilho da regra '${rule.name}'.`);
          console.log(`[Automations Engine] Ação engatilhada: ${rule.action}`);
          // AQUI IRIA A CHAMADA PARA A API DO FACEBOOK:
          // const account = new adsdk.AdAccount(accountId);
          // await account.getCampaigns(...).update({ status: 'PAUSED' })
        }
      }

      // Update last run
      await db.run('UPDATE automations SET last_run = NOW() WHERE id = $1', rule.id);
    }

    console.log('[Automations Engine] Varredura concluída.');
  } catch (e) {
    console.error('[Automations Engine] Erro:', e);
  }
}

module.exports = { runAutomations };
