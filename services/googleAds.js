/**
 * services/googleAds.js — cliente Google Ads API v18.
 *
 * As credenciais são buscadas em dois lugares (em ordem):
 *  1. Banco de dados (tabela settings) — salvas via painel
 *  2. Variáveis de ambiente (.env)     — retrocompatível
 */
const db = require('../db');

const API_VERSION = 'v20';

function getCredentials() {
  // Lê do banco primeiro, fallback para env
  const setting = (key) => {
    try { return db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value || ''; }
    catch { return ''; }
  };

  const customerId = (setting('google.customerId') || process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '');
  // loginCustomerId = MCC se configurado, senão usa o próprio customerId
  const loginCustomerId = (setting('google.loginCustomerId') || process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || customerId).replace(/-/g, '');
  return {
    developerToken:  setting('google.developerToken') || process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
    clientId:        setting('google.clientId')       || process.env.GOOGLE_ADS_CLIENT_ID       || '',
    clientSecret:    setting('google.clientSecret')   || process.env.GOOGLE_ADS_CLIENT_SECRET   || '',
    refreshToken:    setting('google.refreshToken')   || process.env.GOOGLE_ADS_REFRESH_TOKEN   || '',
    customerId,
    loginCustomerId,
  };
}

function isConfigured() {
  const c = getCredentials();
  return !!(c.developerToken && c.clientId && c.clientSecret && c.refreshToken && c.customerId);
}

function getMissingFields() {
  const c = getCredentials();
  const missing = [];
  if (!c.developerToken) missing.push('Developer Token');
  if (!c.clientId)       missing.push('Client ID');
  if (!c.clientSecret)   missing.push('Client Secret');
  if (!c.refreshToken)   missing.push('Refresh Token');
  if (!c.customerId)     missing.push('Customer ID');
  return missing;
}

/** Obtém access_token via OAuth2 refresh. */
async function getAccessToken(creds) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
    }).toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OAuth2 Google falhou (${res.status}): ${err}`);
  }
  return (await res.json()).access_token;
}

/** Gera URL de autorização OAuth2 para obter refresh token. */
function getAuthUrl(redirectUri) {
  const c = getCredentials();
  const params = new URLSearchParams({
    client_id:     c.clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/adwords',
    access_type:   'offline',
    prompt:        'consent',
  });
  return `https://accounts.google.com/o/oauth2/auth?${params}`;
}

/** Troca authorization code por refresh_token. */
async function exchangeCode(code, redirectUri) {
  const c = getCredentials();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     c.clientId,
      client_secret: c.clientSecret,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
    }).toString(),
  });
  if (!res.ok) throw new Error(`Exchange code falhou: ${await res.text()}`);
  const data = await res.json();
  // Salva refresh token no banco
  db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)').run('google.refreshToken', data.refresh_token);
  return data;
}

/** Executa GAQL e retorna rows. */
async function query(gaql) {
  const c = getCredentials();
  if (!isConfigured()) throw new Error('Google Ads não configurado. Acesse Configurações de Integração.');
  const accessToken = await getAccessToken(c);
  const res = await fetch(
    `https://googleads.googleapis.com/${API_VERSION}/customers/${c.customerId}/googleAds:search`,
    {
      method:  'POST',
      headers: {
        'Authorization':     `Bearer ${accessToken}`,
        'developer-token':   c.developerToken,
        'Content-Type':      'application/json',
        'login-customer-id': c.loginCustomerId,
      },
      body: JSON.stringify({ query: gaql }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Ads API (${res.status}): ${err.slice(0, 400)}`);
  }
  return (await res.json()).results || [];
}

/**
 * Busca métricas diárias por campanha.
 * @param {string} fromDate  YYYY-MM-DD
 * @param {string} toDate    YYYY-MM-DD
 */
async function fetchMetrics(fromDate, toDate) {
  const results = await query(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${fromDate}' AND '${toDate}'
      AND campaign.status != 'REMOVED'
    ORDER BY segments.date, campaign.name
  `);
  return results.map(r => ({
    campaignId:   String(r.campaign.id),
    campaignName: r.campaign.name,
    campaignStatus: (r.campaign.status || 'ENABLED').toLowerCase().replace('enabled','active').replace('paused','paused'),
    objective:    r.campaign.advertisingChannelType || '',
    date:         r.segments.date,
    impressions:  r.metrics.impressions         || 0,
    clicks:       r.metrics.clicks             || 0,
    conversions:  r.metrics.conversions        || 0,
    spend:        (r.metrics.costMicros        || 0) / 1_000_000,
    revenue:      r.metrics.conversionsValue   || 0,
  }));
}

async function fetchCampaigns() {
  const results = await query(`
    SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type
    FROM campaign
    WHERE campaign.status != 'REMOVED'
    ORDER BY campaign.name
  `);
  return results.map(r => ({
    id:        String(r.campaign.id),
    name:      r.campaign.name,
    status:    r.campaign.status,
    objective: r.campaign.advertisingChannelType,
  }));
}

module.exports = { isConfigured, getMissingFields, getAuthUrl, exchangeCode, fetchMetrics, fetchCampaigns, query };
