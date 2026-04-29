/**
 * services/metaAds.js — cliente Meta Marketing API (Graph API v21).
 * Busca métricas gerais + breakdown por platform/placement (Instagram, Facebook, Stories, Feed, Reels).
 */
const db = require('../db');

const API_VERSION = 'v21.0';
const BASE_URL    = `https://graph.facebook.com/${API_VERSION}`;

async function getSetting(workspaceId, key) {
  try { const r = await db.get('SELECT value FROM workspace_settings WHERE workspace_id=$1 AND key=$2', workspaceId, key); return r?.value || ''; }
  catch { return ''; }
}

async function getCredentials(workspaceId) {
  return {
    accessToken: await getSetting(workspaceId, 'meta.accessToken') || process.env.META_ACCESS_TOKEN || '',
    adAccountId: await getSetting(workspaceId, 'meta.adAccountId') || process.env.META_AD_ACCOUNT_ID || '',
  };
}

async function isConfigured(workspaceId) {
  const c = await getCredentials(workspaceId);
  return !!(c.accessToken && c.adAccountId);
}

async function getMissingFields(workspaceId) {
  const c = await getCredentials(workspaceId);
  const missing = [];
  if (!c.accessToken) missing.push('Access Token');
  if (!c.adAccountId) missing.push('Ad Account ID');
  return missing;
}

async function graphGet(workspaceId, path, params = {}) {
  const { accessToken } = await getCredentials(workspaceId);
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

async function testConnection(workspaceId) {
  const { accessToken, adAccountId } = await getCredentials(workspaceId);
  if (!accessToken) throw new Error('Access Token não configurado');
  const tokenInfo = await graphGet(workspaceId, 'me', { fields: 'id,name' });
  let accountInfo = null;
  if (adAccountId) accountInfo = await graphGet(workspaceId, adAccountId, { fields: 'id,name,currency,account_status' });
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
async function fetchMetrics(workspaceId, fromDate, toDate) {
  const { adAccountId } = await getCredentials(workspaceId);
  if (!await isConfigured(workspaceId)) throw new Error('Meta Marketing API não configurada.');

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
async function fetchPlacementBreakdown(workspaceId, fromDate, toDate) {
  const { adAccountId } = await getCredentials(workspaceId);
  if (!await isConfigured(workspaceId)) throw new Error('Meta Marketing API não configurada.');

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

/**
 * Busca breakdown demográfico (Região, Idade, Gênero)
 */
async function fetchDemographics(fromDate, toDate) {
  const { adAccountId } = await getCredentials();
  if (!await isConfigured()) return [];

  const fields = 'campaign_id,campaign_name,date_start,impressions,clicks,spend,actions';
  const baseParams = {
    fields,
    time_range: JSON.stringify({ since: fromDate, until: toDate }),
    time_increment: 1,
    level: 'campaign',
    limit: 500,
  };

  const fetchBreakdown = async (breakdowns, mapper) => {
    let allData = [], after = null;
    do {
      const params = { ...baseParams, breakdowns };
      if (after) params.after = after;
      const data = await graphGet(workspaceId, `${adAccountId}/insights`, params);
      allData = allData.concat(data.data || []);
      after = (data.paging?.cursors?.after && data.paging?.next) ? data.paging.cursors.after : null;
    } while (after);
    return allData.map(mapper);
  };

  // Region
  const regionData = await fetchBreakdown('region', r => ({
    campaignId:   r.campaign_id,
    campaignName: r.campaign_name,
    date:         r.date_start,
    type:         'region',
    dimension:    r.region || 'Unknown',
    impressions:  Number(r.impressions) || 0,
    clicks:       Number(r.clicks) || 0,
    spend:        Number(r.spend) || 0,
    conversions:  actionVal(r.actions || [], 'lead','offsite_conversion.fb_pixel_lead','onsite_conversion.lead_grouped'),
  }));

  // Age & Gender
  const ageGenderData = await fetchBreakdown('age,gender', r => {
    const age = {
      campaignId:   r.campaign_id,
      campaignName: r.campaign_name,
      date:         r.date_start,
      type:         'age',
      dimension:    r.age || 'Unknown',
      impressions:  Number(r.impressions) || 0,
      clicks:       Number(r.clicks) || 0,
      spend:        Number(r.spend) || 0,
      conversions:  actionVal(r.actions || [], 'lead','offsite_conversion.fb_pixel_lead','onsite_conversion.lead_grouped'),
    };
    const gender = { ...age, type: 'gender', dimension: r.gender || 'Unknown' };
    return [age, gender];
  });

  return [...regionData, ...ageGenderData.flat()];
}

/**
 * Busca métricas a nível de Anúncio (Criativos)
 */
async function fetchAds(fromDate, toDate) {
  const { adAccountId } = await getCredentials();
  if (!await isConfigured()) return [];

  const fields = [
    'campaign_id','campaign_name',
    'ad_id','ad_name',
    'date_start',
    'impressions','clicks','spend','actions',
  ].join(',');

  let allData = [], after = null;
  do {
    const params = {
      fields,
      time_range:     JSON.stringify({ since: fromDate, until: toDate }),
      time_increment: 1,
      level:          'ad',
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
    adId:         r.ad_id,
    adName:       r.ad_name,
    date:         r.date_start,
    impressions:  Number(r.impressions) || 0,
    clicks:       Number(r.clicks)      || 0,
    spend:        Number(r.spend) || 0,
    conversions:  actionVal(r.actions || [], 'lead','offsite_conversion.fb_pixel_lead','onsite_conversion.lead_grouped'),
  }));
}

module.exports = { isConfigured, getMissingFields, testConnection, fetchMetrics, fetchDemographics, fetchCampaigns, fetchAds };
