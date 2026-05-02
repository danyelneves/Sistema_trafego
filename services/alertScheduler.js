/**
 * services/alertScheduler.js — verifica KPIs × alertas configurados.
 *
 * Em produção (Vercel): chamado pelo Vercel Cron Job via GET /api/cron/alerts
 * Em desenvolvimento local: pode-se chamar manualmente ou manter o setInterval
 */

const { sendWhatsApp } = require('./whatsapp');
const db     = require('../db');
const mailer = require('./mailer');

const METRICS_MAP = {
  cpl:'CPL', cpc:'CPC', ctr:'CTR', roas:'ROAS',
  spend:'Investimento', conversions:'Conversões', impressions:'Impressões', clicks:'Cliques',
};

function fmtValue(metric, v) {
  v = Number(v) || 0;
  if (['spend','cpl','cpc'].includes(metric)) return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  if (['ctr','cvr'].includes(metric))         return (v * 100).toFixed(2) + '%';
  if (metric === 'roas')                      return v.toFixed(2) + 'x';
  return v.toLocaleString('pt-BR');
}

async function aggKpi(channel, window_days = 0) {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;
  const pad   = n => String(n).padStart(2, '0');
  
  let from, to;
  if (window_days > 0) {
    const past = new Date(now);
    past.setDate(now.getDate() - window_days);
    from = `${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}`;
    to   = `${year}-${pad(month)}-${pad(now.getDate())}`;
  } else {
    from  = `${year}-${pad(month)}-01`;
    const end   = new Date(year, month, 0).getDate();
    to    = `${year}-${pad(month)}-${pad(end)}`;
  }

  const args = [from, to];
  let channelClause = '';
  if (channel && channel !== 'all') { args.push(channel); channelClause = ` AND c.channel = $${args.length}`; }

  const r = await db.get(`
    SELECT
      COALESCE(SUM(m.impressions),0)::bigint AS impressions,
      COALESCE(SUM(m.clicks),0)::bigint      AS clicks,
      COALESCE(SUM(m.conversions),0)::bigint AS conversions,
      COALESCE(SUM(m.spend),0)::numeric      AS spend,
      COALESCE(SUM(m.revenue),0)::numeric    AS revenue
    FROM metrics_daily m
    JOIN campaigns c ON c.id = m.campaign_id
    WHERE m.date BETWEEN $1 AND $2
    ${channelClause}
  `, ...args) || {};

  const imp  = Number(r.impressions) || 0;
  const cli  = Number(r.clicks)      || 0;
  const conv = Number(r.conversions) || 0;
  const spend= Number(r.spend)       || 0;
  const rev  = Number(r.revenue)     || 0;
  return {
    impressions: imp, clicks: cli, conversions: conv, spend, revenue: rev,
    ctr:  imp  ? cli/imp    : 0,
    cpc:  cli  ? spend/cli  : 0,
    cvr:  cli  ? conv/cli   : 0,
    cpl:  conv ? spend/conv : 0,
    roas: spend? rev/spend  : 0,
  };
}

async function runChecks() {
  if (!mailer.isConfigured()) return;

  const alerts = await db.all('SELECT * FROM alert_configs WHERE active = 1');
  if (!alerts.length) return;

  const now    = new Date();
  const year   = now.getFullYear();
  const month  = now.getMonth() + 1;
  const period = `${String(month).padStart(2,'0')}/${year}`;

  for (const alert of alerts) {
    try {
      const kpis  = await aggKpi(alert.channel, alert.window_days);
      const value = kpis[alert.metric];
      if (value === undefined) continue;

      const triggered = alert.direction === 'min'
        ? value < Number(alert.threshold)
        : value > Number(alert.threshold);

      if (!triggered) continue;

      const already = await db.get(
        'SELECT id FROM alert_log WHERE alert_id = $1 AND year = $2 AND month = $3',
        alert.id, year, month
      );
      if (already) continue;

      if (alert.email) {
        await mailer.sendKpiAlert({
          to:        alert.email,
          metric:    alert.metric,
          value,
          target:    alert.threshold,
          direction: alert.direction,
          channel:   alert.channel,
          period,
          fmtValue:  fmtValue(alert.metric, value),
          fmtTarget: fmtValue(alert.metric, alert.threshold),
        });
      }

      if (alert.whatsapp) {
        const msg = `🚨 *Nexus Alerta: ${alert.channel.toUpperCase()}* 🚨\nA métrica *${METRICS_MAP[alert.metric]}* atingiu ${fmtValue(alert.metric, value)}.\nMeta configurada: ${alert.direction === 'min' ? 'Mínimo' : 'Máximo'} de ${fmtValue(alert.metric, alert.threshold)}.`;
        await sendWhatsApp(alert.whatsapp, msg);
      }

      if (alert.webhook_url) {
        try {
          await fetch(alert.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `🚨 *Nexus Alerta: ${alert.channel.toUpperCase()}* 🚨\nA métrica *${METRICS_MAP[alert.metric]}* atingiu ${fmtValue(alert.metric, value)}.\nMeta configurada: ${alert.direction === 'min' ? 'Mínimo' : 'Máximo'} de ${fmtValue(alert.metric, alert.threshold)}.`
            })
          });
        } catch (e) { console.error('[WEBHOOK] Erro ao enviar:', e.message); }
      }

      await db.run(
        `INSERT INTO alert_log (alert_id, year, month, value) VALUES ($1, $2, $3, $4)
         ON CONFLICT(alert_id, year, month) DO NOTHING`,
        alert.id, year, month, value
      );

      console.log(`[ALERT] Disparado alerta #${alert.id} → ${alert.email}`);
    } catch (e) {
      console.error(`[ALERT] Erro no alerta #${alert.id}: ${e.message}`);
    }
  }
}

/** Em desenvolvimento local: inicia verificação periódica via setInterval. */
function start() {
  if (process.env.NODE_ENV === 'production') return; // Vercel usa Cron Job
  setTimeout(async () => {
    await runChecks();
    setInterval(runChecks, 24 * 60 * 60 * 1000);
  }, 30_000);
}

module.exports = { start, runChecks };
