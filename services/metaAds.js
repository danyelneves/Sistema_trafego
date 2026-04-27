/**
 * services/metaAds.js — cliente Meta Marketing API (Graph API v21).
 * Busca métricas gerais + breakdown por platform/placement (Instagram, Facebook, Stories, Feed, Reels).
 */
const db = require('../db');

const API_VERSION = 'v21.0';
const BASE_URL    = `https://graph.facebook.com/${API_VERSION}`;

async function getSetting(key) {
  try { const r = await db.get('SELECT value FROM settings WHERE key=$1', key); return r?.value || ''; }
  catch { return ''; }
}

async function getCredentials() {
  return {
    accessToken: await getSetting('meta.accessToken') || process.env.META_ACCESS_TOKEN || '',
    adAccountId: await getSetting('meta.adAccountId') || process.env.META_AD_ACCOUNT_ID || '',
  };
}

async function isConfigured() {
  const c = await getCredentials();
  return !!(c.accessToken && c.adAccountId);
}

function getMissingFields() {
  const at = process.env.META_ACCESS_TOKEN;
  const ai = process.env.META_AD_ACCOUNT_ID;
  const missing = [];
  if (!at) missing.push('Access Token');
  if (!ai) missing.push('Ad Account ID');
  return missing;
}

async function graphGet(path, params = {}) {
  const { accessToken } = await getCredentials();
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

async function testConnection() {
  const { accessToken, adAccountId } = await getCredentials();
  if (!accessToken) throw new Error('Access Token não configurado');
  const tokenInfo = await graphGet('me', { fields: 'id,name' });
  let accountInfo = null;
  if (adAccountId) accountInfo = await graphGet(adAccountId, { fields: 'id,name,currency,account_status' });
  return { user: tokenInfo, account: accountInfo };
}

/** Extrai valor de uma action pelo tipo */
function actionVal(actions = [], ...types) {
  for (const t of types) {
    const a = actions.find(x => x.action_type === t);
    if (a) return Number(a.value) || 0;
  }
  return 0;
}

/**
 * Busca métricas gerais diárias por campanha (com campos Instagram extras).
 */
async function fetchMetrics(fromDate, toDate) {
  const { adAccountId } = await getCredentials();
  if (!await isConfigured()) throw new Error('Meta Marketing API não configurada.');

  const fields = [
    'campaign_id','campaign_name','date_start',
    'impressions','clicks','reach','frequency',
    'actions','video_play_actions','video_avg_time_watched_actions',
    'spend','purchase_roas',
  ].join(',');

  let allData = [], after = null;
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
    after = (data.paging?.cursors?.after && data.paging?.next) ? data.paging.cursors.after : null;
  } while (after);

  return allData.map(r => {
    const actions     = r.actions || [];
    const videoPlay   = r.video_play_actions || [];
    const leads       = actionVal(actions, 'lead','offsite_conversion.fb_pixel_lead','onsite_conversion.lead_grouped');
    const linkClicks  = actionVal(actions, 'link_click');
    const engagement  = actionVal(actions, 'post_engagement');
    const storyViews  = actionVal(videoPlay, 'video_view'); // stories são video_view em placements stories
    const videoViews  = Number(r.video_play_actions?.[0]?.value) || 0;
    const roas        = r.purchase_roas?.[0]?.value ? Number(r.purchase_roas[0].value) : 0;
    const spend       = Number(r.spend) || 0;
    return {
      campaignId:     r.campaign_id,
      campaignName:   r.campaign_name,
      date:           r.date_start,
      impressions:    Number(r.impressions) || 0,
      clicks:         Number(r.clicks)      || 0,
      reach:          Number(r.reach)       || 0,
      frequency:      Number(r.frequency)   || 0,
      videoViews,
      storyViews,
      linkClicks,
      postEngagement: engagement,
      conversions:    leads,
      spend,
      revenue:        spend * roas,
    };
  });
}

/**
 * Busca breakdown por publisher_platform + placement (Feed, Stories, Reels, etc.)
 */
async function fetchPlacementBreakdown(fromDate, toDate) {
  const { adAccountId } = await getCredentials();
  if (!await isConfigured()) throw new Error('Meta Marketing API não configurada.');

  const fields = [
    'campaign_id','campaign_name','date_start',
    'impressions','clicks','reach','spend','actions','video_play_actions',
  ].join(',');

  let allData = [], after = null;
  do {
    const params = {
      fields,
      breakdowns:     'publisher_platform,platform_position',
      time_range:     JSON.stringify({ since: fromDate, until: toDate }),
      time_increment: 1,
      level:          'campaign',
      limit:          500,
    };
    if (after) params.after = after;
    const data = await graphGet(`${adAccountId}/insights`, params);
    allData = allData.concat(data.data || []);
    after = (data.paging?.cursors?.after && data.paging?.next) ? data.paging.cursors.after : null;
  } while (after);

  return allData.map(r => ({
    campaignId:   r.campaign_id,
    campaignName: r.campaign_name,
    date:         r.date_start,
    platform:     r.publisher_platform || 'unknown',
    placement:    r.platform_position  || 'unknown',
    impressions:  Number(r.impressions) || 0,
    clicks:       Number(r.clicks)      || 0,
    reach:        Number(r.reach)       || 0,
    videoViews:   Number(r.video_play_actions?.[0]?.value) || 0,
    spend:        Number(r.spend) || 0,
    conversions:  actionVal(r.actions || [], 'lead','offsite_conversion.fb_pixel_lead','onsite_conversion.lead_grouped'),
  }));
}

async function fetchCampaigns() {
  const { adAccountId } = await getCredentials();
  if (!adAccountId) throw new Error('META_AD_ACCOUNT_ID não configurado');
  const data = await graphGet(`${adAccountId}/campaigns`, {
    fields: 'id,name,status,objective', limit: 500,
  });
  return (data.data || []).map(c => ({ id: c.id, name: c.name, status: c.status, objective: c.objective }));
}

module.exports = { isConfigured, getMissingFields, testConnection, fetchMetrics, fetchPlacementBreakdown, fetchCampaigns };
