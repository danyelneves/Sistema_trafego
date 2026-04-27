/**
 * services/mailer.js — envio de e-mail via Gmail SMTP (nodemailer).
 *
 * Configuração no .env:
 *   SMTP_USER=seu@gmail.com
 *   SMTP_PASS=xxxx xxxx xxxx xxxx   (App Password do Gmail — 16 chars)
 *   SMTP_FROM="Maranet Tráfego <seu@gmail.com>"
 */
const nodemailer = require('nodemailer');

const { SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

let _transporter = null;

function getTransporter() {
  if (!_transporter) {
    if (!SMTP_USER || !SMTP_PASS) return null;
    _transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return _transporter;
}

/** Verifica se o mailer está configurado. */
function isConfigured() {
  return !!(SMTP_USER && SMTP_PASS);
}

/**
 * Envia um e-mail simples.
 * @param {{ to, subject, html, text }} opts
 */
async function send({ to, subject, html, text }) {
  const t = getTransporter();
  if (!t) throw new Error('SMTP não configurado. Defina SMTP_USER e SMTP_PASS no .env');
  return t.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to, subject,
    html: html || `<pre>${text}</pre>`,
    text: text || subject,
  });
}

/**
 * Envia alerta de KPI.
 */
async function sendKpiAlert({ to, metric, value, target, direction, channel, period, fmtValue, fmtTarget }) {
  const dirLabel  = direction === 'min' ? 'mínimo esperado' : 'máximo permitido';
  const status    = direction === 'min' ? '🔴 Abaixo da meta' : '🔴 Acima do limite';
  const metricMap = { cpl:'CPL', cpc:'CPC', ctr:'CTR', roas:'ROAS', spend:'Investimento', conversions:'Conversões', impressions:'Impressões', clicks:'Cliques' };
  const metricLabel = metricMap[metric] || metric;
  const channelLabel = channel === 'all' ? 'Consolidado' : (channel === 'google' ? 'Google Ads' : 'Meta Ads');

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="UTF-8"><style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#0a1929; color:#e8f4f8; margin:0; padding:0; }
      .container { max-width:520px; margin:32px auto; background:#0c2233; border-radius:12px; border:1px solid rgba(0,173,167,0.2); overflow:hidden; }
      .header { background:linear-gradient(135deg,#00ADA7,#0066cc); padding:24px 28px; }
      .header h1 { margin:0; font-size:18px; color:#fff; }
      .header p  { margin:4px 0 0; font-size:12px; color:rgba(255,255,255,0.75); }
      .body { padding:24px 28px; }
      .badge { display:inline-block; background:rgba(255,60,60,0.15); border:1px solid rgba(255,80,80,0.4); color:#ff6464; border-radius:6px; padding:4px 10px; font-size:12px; font-weight:600; margin-bottom:16px; }
      .metric { font-size:32px; font-weight:700; color:#00ADA7; margin:4px 0; }
      .sub { font-size:13px; color:#6b9aaa; margin-bottom:20px; }
      .detail { background:rgba(0,173,167,0.05); border:1px solid rgba(0,173,167,0.12); border-radius:8px; padding:16px; }
      .detail table { width:100%; border-collapse:collapse; }
      .detail td { padding:4px 0; font-size:13px; color:#a0bfcc; }
      .detail td:last-child { text-align:right; color:#e8f4f8; font-weight:500; }
      .footer { padding:16px 28px; font-size:11px; color:#4a7080; border-top:1px solid rgba(0,173,167,0.08); }
    </style></head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Maranet · Central de Tráfego</h1>
          <p>Alerta automático de KPI · ${period}</p>
        </div>
        <div class="body">
          <div class="badge">${status}</div>
          <div style="font-size:14px;color:#a0bfcc;margin-bottom:4px">${metricLabel} · ${channelLabel}</div>
          <div class="metric">${fmtValue}</div>
          <div class="sub">${dirLabel}: ${fmtTarget}</div>
          <div class="detail">
            <table>
              <tr><td>Período</td><td>${period}</td></tr>
              <tr><td>Canal</td><td>${channelLabel}</td></tr>
              <tr><td>Métrica</td><td>${metricLabel}</td></tr>
              <tr><td>Valor atual</td><td>${fmtValue}</td></tr>
              <tr><td>Meta (${dirLabel})</td><td>${fmtTarget}</td></tr>
            </table>
          </div>
        </div>
        <div class="footer">Enviado automaticamente pela Central de Tráfego · Maranet Telecom</div>
      </div>
    </body>
    </html>
  `;
  return send({
    to,
    subject: `[Alerta] ${metricLabel} ${status} — ${channelLabel} · ${period}`,
    html,
    text: `${status}\n${metricLabel} (${channelLabel}): ${fmtValue}\nMeta (${dirLabel}): ${fmtTarget}\nPeríodo: ${period}`,
  });
}

module.exports = { send, sendKpiAlert, isConfigured };
