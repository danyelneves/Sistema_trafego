const db = require('../db');


async function analyzeMetrics(workspaceId, channel = 'all') {
  // Fetch last 7 days and previous 7 days
  const today = new Date();
  const d7 = new Date(today); d7.setDate(d7.getDate() - 7);
  const d14 = new Date(today); d14.setDate(d14.getDate() - 14);

  const curFrom = d7.toISOString().split('T')[0];
  const curTo = today.toISOString().split('T')[0];
  const prevFrom = d14.toISOString().split('T')[0];
  const prevTo = d7.toISOString().split('T')[0];

  const argsCur = [workspaceId, curFrom, curTo];
  const argsPrev = [workspaceId, prevFrom, prevTo];
  
  let chanFilter = '';
  if (channel !== 'all') {
    chanFilter = `AND c.channel = '${channel}'`;
  }

  const query = `
    SELECT 
      COALESCE(SUM(m.spend),0)::numeric AS spend,
      COALESCE(SUM(m.conversions),0)::bigint AS conversions,
      COALESCE(SUM(m.revenue),0)::numeric AS revenue,
      COALESCE(SUM(m.impressions),0)::bigint AS impressions,
      COALESCE(SUM(m.clicks),0)::bigint AS clicks
    FROM metrics_daily m
    JOIN campaigns c ON c.id = m.campaign_id
    WHERE c.workspace_id = $1 AND m.date >= $2 AND m.date <= $3 ${chanFilter}
  `;

  const [cur, prev] = await Promise.all([
    db.get(query, ...argsCur),
    db.get(query, ...argsPrev)
  ]);

  const curCpl = cur.conversions > 0 ? cur.spend / cur.conversions : 0;
  const prevCpl = prev.conversions > 0 ? prev.spend / prev.conversions : 0;
  
  const curRoas = cur.spend > 0 ? cur.revenue / cur.spend : 0;
  const prevRoas = prev.spend > 0 ? prev.revenue / prev.spend : 0;

  const curCtr = cur.impressions > 0 ? cur.clicks / cur.impressions : 0;
  const prevCtr = prev.impressions > 0 ? prev.clicks / prev.impressions : 0;

  const insights = [];

  // Rules Engine
  // 1. CPL Check
  if (curCpl > prevCpl * 1.25 && prevCpl > 0) {
    insights.push({
      type: 'warning',
      metric: 'CPL',
      title: 'Custo por Lead em Alta',
      message: `Seu CPL subiu ${( ((curCpl/prevCpl)-1)*100 ).toFixed(0)}% nos últimos 7 dias. Recomendamos revisar criativos ou públicos fadigados.`,
      action: 'Otimizar Segmentação'
    });
  } else if (curCpl < prevCpl * 0.85 && curCpl > 0) {
    insights.push({
      type: 'success',
      metric: 'CPL',
      title: 'Custo por Lead em Baixa',
      message: `Excelente! O CPL caiu ${( (1-(curCpl/prevCpl))*100 ).toFixed(0)}%. As campanhas estão ganhando eficiência. Avalie escalar o orçamento.`,
      action: 'Escalar Orçamento'
    });
  }

  // 2. ROAS Check
  if (curRoas < 1.0 && cur.spend > 50) {
    insights.push({
      type: 'danger',
      metric: 'ROAS',
      title: 'ROAS Negativo',
      message: `Retorno sobre investimento crítico (${curRoas.toFixed(2)}x). A operação está dando prejuízo nesta semana. Pause campanhas ineficientes.`,
      action: 'Pausar Ineficientes'
    });
  } else if (curRoas > 3.0) {
    insights.push({
      type: 'success',
      metric: 'ROAS',
      title: 'Alto Retorno (ROAS)',
      message: `ROAS excepcional de ${curRoas.toFixed(2)}x. Lucratividade validada. Considere injetar mais capital nas campanhas top performers.`,
      action: 'Maximizar Lucro'
    });
  }

  // 3. Bleeding Spend Check
  if (cur.spend > 100 && cur.conversions === 0) {
    insights.push({
      type: 'danger',
      metric: 'Conversão',
      title: 'Gasto Sem Retorno',
      message: `R$${Number(cur.spend).toFixed(2)} gastos sem gerar nenhum lead/venda nos últimos 7 dias. Verifique se a página de destino está funcionando e o pixel disparando.`,
      action: 'Verificar Tracking/LP'
    });
  }

  // 4. CTR Drop
  if (curCtr < prevCtr * 0.7 && prevCtr > 0) {
    insights.push({
      type: 'warning',
      metric: 'CTR',
      title: 'Queda Drástica de CTR',
      message: `O CTR (Taxa de Clique) caiu ${( (1-(curCtr/prevCtr))*100 ).toFixed(0)}%. Seus anúncios estão perdendo relevância (fadiga criativa).`,
      action: 'Renovar Criativos'
    });
  }

  if (insights.length === 0) {
    insights.push({
      type: 'info',
      metric: 'Estabilidade',
      title: 'Métricas Estáveis',
      message: 'O ecossistema de campanhas está operando de forma estável e consistente em comparação à semana passada.',
      action: 'Manter Estratégia'
    });
  }

  return { cur, prev, insights };
}

module.exports = { analyzeMetrics };
