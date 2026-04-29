/**
 * routes/sync.js — API de integração e importação de dados.
 *
 * GET  /api/sync/status
 * POST /api/sync/credentials
 * POST /api/sync/test/:platform
 * POST /api/sync/google?stream=1
 * POST /api/sync/meta?stream=1
 * GET  /api/sync/history
 * GET  /api/sync/oauth/google
 * GET  /api/sync/oauth/google/callback
 */
const express   = require('express');
const db        = require('../db');
const googleAds = require('../services/googleAds');
const metaAds   = require('../services/metaAds');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Aplica autenticação em todas as rotas, EXCETO no callback (onde o Google redireciona sem cookies)
router.use((req, res, next) => {
  if (req.path === '/oauth/google/callback') return next();
  requireAuth(req, res, () => requireAdmin(req, res, next));
});

// ─────────────────────────────────────────────────────────────
// GET /api/sync/status
// ─────────────────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const setting = async (k) => {
      const row = await db.get('SELECT value FROM workspace_settings WHERE workspace_id=$1 AND key=$2', req.user.workspace_id, k);
      return row?.value || '';
    };
    res.json({
      google: {
        configured:    await googleAds.isConfigured(req.user.workspace_id),
        missing:       await googleAds.getMissingFields(req.user.workspace_id),
        customerIdSet: !!(await setting('google.customerId') || process.env.GOOGLE_ADS_CUSTOMER_ID),
      },
      meta: {
        configured: await metaAds.isConfigured(req.user.workspace_id),
        missing:    await metaAds.getMissingFields(req.user.workspace_id),
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// POST /api/sync/credentials
// ─────────────────────────────────────────────────────────────
router.post('/credentials', async (req, res) => {
  const { platform, fields } = req.body || {};
  if (!['google','meta'].includes(platform)) return res.status(400).json({ error: 'platform deve ser google ou meta' });
  if (!fields || typeof fields !== 'object')  return res.status(400).json({ error: 'fields obrigatório' });

  try {
    const tx = db.transaction(async (client) => {
      for (const [k, v] of Object.entries(fields)) {
        if (v && String(v).trim()) {
          await client.run(
            `INSERT INTO workspace_settings(workspace_id, key, value) VALUES($1,$2,$3)
             ON CONFLICT(workspace_id, key) DO UPDATE SET value = EXCLUDED.value`,
            req.user.workspace_id, `${platform}.${k}`, String(v).trim()
          );
        }
      }
    });
    await tx();
    res.json({ ok: true, platform, saved: Object.keys(fields).length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// POST /api/sync/test/:platform
// ─────────────────────────────────────────────────────────────
router.post('/test/:platform', async (req, res) => {
  const { platform } = req.params;
  try {
    if (platform === 'meta') {
      const info = await metaAds.testConnection(req.user.workspace_id);
      return res.json({ ok: true, user: info.user, account: info.account });
    }
    if (platform === 'google') {
      if (!(await googleAds.isConfigured(req.user.workspace_id)))
        return res.status(503).json({ ok: false, error: 'Credenciais incompletas', missing: await googleAds.getMissingFields(req.user.workspace_id) });
      const camps = await googleAds.fetchCampaigns(req.user.workspace_id);
      return res.json({ ok: true, campaigns: camps.length });
    }
    res.status(400).json({ error: 'Platform inválida' });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────
// OAuth2 Google
// ─────────────────────────────────────────────────────────────
router.get('/oauth/google', async (req, res) => {
  const redirect = `${req.protocol}://${req.get('host')}/api/sync/oauth/google/callback`;
  try {
    const url = await googleAds.getAuthUrl(req.user.workspace_id, redirect);
    res.json({ url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/oauth/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Código ausente');
  const redirect = `${req.protocol}://${req.get('host')}/api/sync/oauth/google/callback`;
  try {
    await googleAds.exchangeCode(req.user.workspace_id, code, redirect);
    res.send(`<script>window.opener?.postMessage({type:'google_oauth_ok'},'*');window.close();</script>
              <p>✓ Autorização concluída! Pode fechar esta aba.</p>`);
  } catch (e) {
    res.status(400).send(`Erro: ${e.message}`);
  }
});

// ─────────────────────────────────────────────────────────────
// Upserta linhas de métricas no banco (com campos Instagram)
// ─────────────────────────────────────────────────────────────
async function upsertRows(workspaceId, rows, channel) {
  if (!rows.length) return 0;

  const existing = await db.all('SELECT id, name FROM campaigns WHERE workspace_id = $1 AND channel = $2', workspaceId, channel);
  const cache = new Map();
  existing.forEach(c => cache.set(c.name.toLowerCase(), c.id));

  let inserted = 0;
  const tx = db.transaction(async (client) => {
    for (const r of rows) {
      const nameKey = r.campaignName.toLowerCase();
      let campId = cache.get(nameKey);
      if (!campId) {
        const row = await client.get(
          `INSERT INTO campaigns (workspace_id, channel, name, status, objective)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT(workspace_id, channel, name) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          workspaceId, channel, r.campaignName, r.campaignStatus || 'active', r.objective || null
        );
        campId = row?.id;
        if (campId) cache.set(nameKey, campId);
      }
      if (campId) {
        await client.run(`
          INSERT INTO metrics_daily
            (campaign_id, date, impressions, clicks, conversions, spend, revenue,
             reach, frequency, video_views, story_views, link_clicks, post_engagement)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          ON CONFLICT(campaign_id, date) DO UPDATE SET
            impressions     = EXCLUDED.impressions,
            clicks          = EXCLUDED.clicks,
            conversions     = EXCLUDED.conversions,
            spend           = EXCLUDED.spend,
            revenue         = EXCLUDED.revenue,
            reach           = EXCLUDED.reach,
            frequency       = EXCLUDED.frequency,
            video_views     = EXCLUDED.video_views,
            story_views     = EXCLUDED.story_views,
            link_clicks     = EXCLUDED.link_clicks,
            post_engagement = EXCLUDED.post_engagement,
            updated_at      = NOW()
        `, campId, r.date, r.impressions, r.clicks, r.conversions, r.spend, r.revenue || 0,
           r.reach || 0, r.frequency || 0, r.videoViews || 0,
           r.storyViews || 0, r.linkClicks || 0, r.postEngagement || 0);
        inserted++;
      }
    }
  });
  await tx();
  return inserted;
}

// Upserta breakdown por placement
async function upsertPlacement(workspaceId, rows, channel) {
  if (!rows.length) return 0;
  const existing = await db.all('SELECT id, name FROM campaigns WHERE workspace_id = $1 AND channel = $2', workspaceId, channel);
  const cache = new Map();
  existing.forEach(c => cache.set(c.name.toLowerCase(), c.id));
  let inserted = 0;
  const tx = db.transaction(async (client) => {
    for (const r of rows) {
      const campId = cache.get(r.campaignName.toLowerCase());
      if (!campId) continue;
      const plat = ['instagram','facebook','audience_network','messenger'].includes(r.platform)
        ? r.platform : 'facebook';
      await client.run(`
        INSERT INTO metrics_placement
          (campaign_id, date, platform, placement, impressions, clicks, reach, video_views, spend, conversions)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT(campaign_id, date, platform, placement) DO UPDATE SET
          impressions = EXCLUDED.impressions, clicks = EXCLUDED.clicks,
          reach = EXCLUDED.reach, video_views = EXCLUDED.video_views,
          spend = EXCLUDED.spend, conversions = EXCLUDED.conversions,
          updated_at = NOW()
      `, campId, r.date, plat, r.placement || 'feed',
         r.impressions, r.clicks, r.reach, r.videoViews, r.spend, r.conversions);
      inserted++;
    }
  });
  await tx();
  return inserted;
}

// Upserta dados demográficos (região, idade, gênero)
async function upsertDemographics(workspaceId, rows, channel) {
  if (!rows.length) return 0;
  const existing = await db.all('SELECT id, name FROM campaigns WHERE workspace_id = $1 AND channel = $2', workspaceId, channel);
  const cache = new Map();
  existing.forEach(c => cache.set(c.name.toLowerCase(), c.id));
  let inserted = 0;
  const tx = db.transaction(async (client) => {
    for (const r of rows) {
      const campId = cache.get(r.campaignName.toLowerCase());
      if (!campId) continue;
      await client.run(`
        INSERT INTO metrics_demographics
          (campaign_id, date, type, dimension, impressions, clicks, spend, conversions)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT(campaign_id, date, type, dimension) DO UPDATE SET
          impressions = EXCLUDED.impressions, clicks = EXCLUDED.clicks,
          spend = EXCLUDED.spend, conversions = EXCLUDED.conversions
      `, campId, r.date, r.type, r.dimension,
         r.impressions || 0, r.clicks || 0, r.spend || 0, r.conversions || 0);
      inserted++;
    }
  });
  await tx();
  return inserted;
}

// Upserta dados a nível de anúncio (criativos)
async function upsertAds(workspaceId, rows, channel) {
  if (!rows.length) return 0;
  const existing = await db.all('SELECT id, name FROM campaigns WHERE workspace_id = $1 AND channel = $2', workspaceId, channel);
  const cache = new Map();
  existing.forEach(c => cache.set(c.name.toLowerCase(), c.id));
  let inserted = 0;
  const tx = db.transaction(async (client) => {
    for (const r of rows) {
      const campId = cache.get(r.campaignName?.toLowerCase());
      if (!campId) continue;
      await client.run(`
        INSERT INTO metrics_ads
          (campaign_id, ad_id, ad_name, date, impressions, clicks, spend, conversions)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT(campaign_id, ad_id, date) DO UPDATE SET
          ad_name = EXCLUDED.ad_name,
          impressions = EXCLUDED.impressions, clicks = EXCLUDED.clicks,
          spend = EXCLUDED.spend, conversions = EXCLUDED.conversions,
          updated_at = NOW()
      `, campId, r.adId, r.adName, r.date,
         r.impressions || 0, r.clicks || 0, r.spend || 0, r.conversions || 0);
      inserted++;
    }
  });
  await tx();
  return inserted;
}

// ─────────────────────────────────────────────────────────────
// Registra sync no histórico (salvo como JSON em settings)
// ─────────────────────────────────────────────────────────────
async function logSync(workspaceId, platform, from, to, fetched, inserted, status, error = null) {
  try {
    const key = `sync.history.${platform}`;
    await db.run(
      `INSERT INTO workspace_settings(workspace_id, key, value) VALUES($1, $2, '[]')
       ON CONFLICT(workspace_id, key) DO NOTHING`,
      workspaceId, key
    );
    const row     = await db.get("SELECT value FROM workspace_settings WHERE workspace_id=$1 AND key=$2", workspaceId, key);
    const history = JSON.parse(row?.value || '[]');
    history.unshift({
      platform, from, to, fetched, inserted, status,
      error: error ? String(error).slice(0, 200) : null,
      at: new Date().toISOString(),
    });
    if (history.length > 50) history.length = 50;
    await db.run(
      `INSERT INTO workspace_settings(workspace_id, key, value) VALUES($1, $2, $3)
       ON CONFLICT(workspace_id, key) DO UPDATE SET value = EXCLUDED.value`,
      workspaceId, key, JSON.stringify(history)
    );
  } catch {}
}

// ─────────────────────────────────────────────────────────────
// GET /api/sync/history
// ─────────────────────────────────────────────────────────────
router.get('/history', async (req, res) => {
  try {
    const rowM = await db.get("SELECT value FROM workspace_settings WHERE workspace_id=$1 AND key='sync.history.meta'", req.user.workspace_id);
    const rowG = await db.get("SELECT value FROM workspace_settings WHERE workspace_id=$1 AND key='sync.history.google'", req.user.workspace_id);
    const history = [
      ...JSON.parse(rowM?.value || '[]'),
      ...JSON.parse(rowG?.value || '[]')
    ].sort((a,b) => new Date(b.at) - new Date(a.at)).slice(0, 50);
    res.json(history);
  } catch { res.json([]); }
});

// ─────────────────────────────────────────────────────────────
// SSE helpers
// ─────────────────────────────────────────────────────────────
function startSSE(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  return (type, data) => res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
}

// ─────────────────────────────────────────────────────────────
// POST /api/sync/google
// ─────────────────────────────────────────────────────────────
router.post('/google', async (req, res) => {
  if (!(await googleAds.isConfigured(req.user.workspace_id))) {
    return res.status(503).json({ error: 'Google Ads não configurado', missing: await googleAds.getMissingFields(req.user.workspace_id) });
  }
  const { from, to } = req.body || {};
  if (!from || !to) return res.status(400).json({ error: 'from e to (YYYY-MM-DD) obrigatórios' });

  const stream = req.query.stream === '1';
  const send   = stream ? startSSE(res) : null;

  try {
    send?.('info', { message: `Google Ads: buscando dados de ${from} até ${to}…` });
    const rows      = await googleAds.fetchMetrics(req.user.workspace_id, from, to);
    const campaigns = [...new Set(rows.map(r => r.campaignName))];
    send?.('info', { message: `${rows.length} linhas encontradas em ${campaigns.length} campanhas` });
    const inserted = await upsertRows(req.user.workspace_id, rows, 'google');
    send?.('info', { message: 'Buscando dados demográficos (Região)…' });
    const demoRows = await googleAds.fetchDemographics(req.user.workspace_id, from, to);
    const demoIns  = await upsertDemographics(req.user.workspace_id, demoRows, 'google');

    send?.('info', { message: 'Buscando métricas de Anúncios (Criativos)…' });
    const adsRows = await googleAds.fetchAds(req.user.workspace_id, from, to);
    const adsIns  = await upsertAds(req.user.workspace_id, adsRows, 'google');

    send?.('success', { message: `✓ ${inserted} registros, ${demoIns} demográficos e ${adsIns} anúncios importados!`, fetched: rows.length, inserted, demo: demoIns, ads: adsIns });
    await logSync(req.user.workspace_id, 'google', from, to, rows.length, inserted, 'ok');
    if (stream) { send('done', { fetched: rows.length, inserted, demo: demoIns, ads: adsIns }); res.end(); }
    else res.json({ ok: true, fetched: rows.length, inserted, demo: demoIns, ads: adsIns, from, to });
  } catch (e) {
    await logSync(req.user.workspace_id, 'google', from, to, 0, 0, 'error', e.message);
    if (stream) { send?.('error', { message: `✗ Erro: ${e.message}` }); res.end(); }
    else res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/sync/meta
// ─────────────────────────────────────────────────────────────
router.post('/meta', async (req, res) => {
  if (!await metaAds.isConfigured(req.user.workspace_id)) {
    return res.status(503).json({ error: 'Meta Ads não configurado', missing: await metaAds.getMissingFields(req.user.workspace_id) });
  }
  const { from, to } = req.body || {};
  if (!from || !to) return res.status(400).json({ error: 'from e to (YYYY-MM-DD) obrigatórios' });

  const stream = req.query.stream === '1';
  const send   = stream ? startSSE(res) : null;

  try {
    send?.('info', { message: `Meta Ads: buscando insights de ${from} até ${to}…` });
    const rows      = await metaAds.fetchMetrics(req.user.workspace_id, from, to);
    const campaigns = [...new Set(rows.map(r => r.campaignName))];
    send?.('info', { message: `${rows.length} linhas · ${campaigns.length} campanhas — salvando métricas…` });
    const inserted = await upsertRows(req.user.workspace_id, rows, 'meta');

    send?.('info', { message: 'Buscando breakdown por placement (Instagram/Facebook/Stories/Reels)…' });
    const plaRows = await metaAds.fetchPlacementBreakdown(req.user.workspace_id, from, to);
    const plaIns  = await upsertPlacement(req.user.workspace_id, plaRows, 'meta');

    send?.('info', { message: 'Buscando dados demográficos (Região, Idade, Gênero)…' });
    const demoRows = await metaAds.fetchDemographics(req.user.workspace_id, from, to);
    const demoIns  = await upsertDemographics(req.user.workspace_id, demoRows, 'meta');

    send?.('info', { message: 'Buscando métricas de Anúncios (Criativos)…' });
    const adsRows = await metaAds.fetchAds(req.user.workspace_id, from, to);
    const adsIns  = await upsertAds(req.user.workspace_id, adsRows, 'meta');

    send?.('success', { message: `✓ ${inserted} métricas + ${plaIns} placements + ${demoIns} demográficos + ${adsIns} anúncios!`, fetched: rows.length, inserted });
    await logSync(req.user.workspace_id, 'meta', from, to, rows.length, inserted, 'ok');
    if (stream) { send('done', { fetched: rows.length, inserted, placements: plaIns, demo: demoIns, ads: adsIns }); res.end(); }
    else res.json({ ok: true, fetched: rows.length, inserted, placements: plaIns, demo: demoIns, ads: adsIns, from, to });
  } catch (e) {
    await logSync(req.user.workspace_id, 'meta', from, to, 0, 0, 'error', e.message);
    if (stream) { send?.('error', { message: `✗ Erro: ${e.message}` }); res.end(); }
    else res.status(500).json({ error: e.message });
  }
});

module.exports = router;
