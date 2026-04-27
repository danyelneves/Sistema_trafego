/**
 * services/metaAds.js — cliente Meta Marketing API (Graph API v21).
 *
 * Credenciais buscadas do banco primeiro, depois do .env.
 * Permissões necessárias no token: ads_read, read_insights, business_management
 */
const db = require('../db');

const API_VERSION = 'v21.0';
const BASE_URL    = `https://graph.facebook.com/${API_VERSION}`;

function getCredentials() {
  const setting = (key) => {
    try { return db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value || ''; }
    catch { return ''; }
  };
  return {
    accessToken: setting('meta.accessToken') || process.env.META_ACCESS_TOKEN   || '',
    adAccountId: setting('meta.adAccountId') || process.env.META_AD_ACCOUNT_ID  || '',
  };
}

function isConfigured() {
  const c = getCredentials();
  return !!(c.accessToken && c.adAccountId);
}

function getMissingFields() {
  const c = getCredentials();
  const missing = [];
  if (!c.accessToken)  missing.push('Access Token');
  if (!c.adAccountId)  missing.push('Ad Account ID');
  return missing;
}

async function graphGet(path, params = {}) {
  const { accessToken } = getCredentials();
  if (!accessToken) throw new Error('Meta: Access Token não configurado.');

  const url = new URL(`${BASE_URL}/${path}`);
  url.searchParams.set('access_token', accessToken);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Meta API (${res.status}): ${err?.error?.message || res.statusText}`);
  }
  return res.json();
}

/** Valida o token — retorna info da conta se ok. */
async function testConnection() {
  const { accessToken, adAccountId } = getCredentials();
  if (!accessToken) throw new Error('Access Token não configurado');

  // Verifica token
  const tokenInfo = await graphGet('me', { fields: 'id,name' });

  // Verifica conta de anúncios (se informada)
  let accountInfo = null;
  if (adAccountId) {
    accountInfo = await graphGet(adAccountId, { fields: 'id,name,currency,account_status' });
  }
  return { user: tokenInfo, account: accountInfo };
}

/**
 * Busca insights diários por campanha.
 */
async function fetchMetrics(fromDate, toDate) {
  const { adAccountId } = getCredentials();
  if (!isConfigured()) throw new Error('Meta Marketing API não configurada. Acesse Configurações de Integração.');

  const fields = [
    'campaign_id', 'campaign_name', 'date_start',
    'impressions', 'clicks', 'actions', 'spend', 'purchase_roas',
  ].join(',');

  let allData = [];
  let after   = null;

  do {
    const params = {
      fields,
      time_range:     JSON.stringify({ since: fromDate, until: toDate }),
      time_increment: 1,
      level:          'campaign',
      limit:          500,
    };
    if (after) params.after = after;

    const data = await graphGet(`${adAccountId}/insights`, params);
    allData = allData.concat(data.data || []);
    after   = (data.paging?.cursors?.after && data.paging?.next) ? data.paging.cursors.after : null;
  } while (after);

  return allData.map(r => {
    const leads       = (r.actions || []).find(a =>
      ['lead','offsite_conversion.fb_pixel_lead','onsite_conversion.lead_grouped'].includes(a.action_type)
    );
    const conversions = leads ? Number(leads.value) : 0;
    const roas        = r.purchase_roas?.[0]?.value ? Number(r.purchase_roas[0].value) : 0;
    const spend       = Number(r.spend) || 0;
    return {
      campaignId:   r.campaign_id,
      campaignName: r.campaign_name,
      date:         r.date_start,
      impressions:  Number(r.impressions) || 0,
      clicks:       Number(r.clicks)      || 0,
      conversions,
      spend,
      revenue: spend * roas,
    };
  });
}

async function fetchCampaigns() {
  const { adAccountId } = getCredentials();
  if (!adAccountId) throw new Error('META_AD_ACCOUNT_ID não configurado');

  const data = await graphGet(`${adAccountId}/campaigns`, {
    fields: 'id,name,status,objective',
    limit:  500,
  });
  return (data.data || []).map(c => ({
    id: c.id, name: c.name, status: c.status, objective: c.objective,
  }));
}

module.exports = { isConfigured, getMissingFields, testConnection, fetchMetrics, fetchCampaigns };
