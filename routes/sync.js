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
router.use(requireAuth, requireAdmin);

// ─────────────────────────────────────────────────────────────
// GET /api/sync/status
// ─────────────────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const setting = async (k) => {
      const row = await db.get('SELECT value FROM settings WHERE key=$1', k);
      return row?.value || '';
    };
    res.json({
      google: {
        configured:    googleAds.isConfigured(),
        missing:       googleAds.getMissingFields(),
        customerIdSet: !!(await setting('google.customerId') || process.env.GOOGLE_ADS_CUSTOMER_ID),
      },
      meta: {
        configured: metaAds.isConfigured(),
        missing:    metaAds.getMissingFields(),
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
            `INSERT INTO settings(key,value) VALUES($1,$2)
             ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value`,
            `${platform}.${k}`, String(v).trim()
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
      const info = await metaAds.testConnection();
      return res.json({ ok: true, user: info.user, account: info.account });
    }
    if (platform === 'google') {
      if (!googleAds.isConfigured())
        return res.status(503).json({ ok: false, error: 'Credenciais incompletas', missing: googleAds.getMissingFields() });
      const camps = await googleAds.fetchCampaigns();
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
router.get('/oauth/google', (req, res) => {
  const redirect = `${req.protocol}://${req.get('host')}/api/sync/oauth/google/callback`;
  try {
    const url = googleAds.getAuthUrl(redirect);
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
    await googleAds.exchangeCode(code, redirect);
    res.send(`<script>window.opener?.postMessage({type:'google_oauth_ok'},'*');window.close();</script>
              <p>✓ Autorização concluída! Pode fechar esta aba.</p>`);
  } catch (e) {
    res.status(400).send(`Erro: ${e.message}`);
  }
});

// ─────────────────────────────────────────────────────────────
// Upserta linhas de métricas no banco (com campos Instagram)
// ─────────────────────────────────────────────────────────────
async function upsertRows(rows, channel) {
  if (!rows.length) return 0;

  const existing = await db.all('SELECT id, name FROM campaigns WHERE channel = $1', channel);
  const cache = new Map();
  existing.forEach(c => cache.set(c.name.toLowerCase(), c.id));

  let inserted = 0;
  const tx = db.transaction(async (client) => {
    for (const r of rows) {
      const nameKey = r.campaignName.toLowerCase();
      let campId = cache.get(nameKey);
      if (!campId) {
        const row = await client.get(
          `INSERT INTO campaigns (channel, name, status, objective)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT(channel, name) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          channel, r.campaignName, r.campaignStatus || 'active', r.objective || null
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
async function upsertPlacement(rows, channel) {
  if (!rows.length) return 0;
  const existing = await db.all('SELECT id, name FROM campaigns WHERE channel = $1', channel);
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

// ─────────────────────────────────────────────────────────────
// Registra sync no histórico (salvo como JSON em settings)
// ─────────────────────────────────────────────────────────────
async function logSync(platform, from, to, fetched, inserted, status, error = null) {
  try {
    await db.run(
      `INSERT INTO settings(key, value) VALUES('sync.history','[]')
       ON CONFLICT(key) DO NOTHING`
    );
    const row     = await db.get("SELECT value FROM settings WHERE key='sync.history'");
    const history = JSON.parse(row?.value || '[]');
    history.unshift({
      platform, from, to, fetched, inserted, status,
      error: error ? String(error).slice(0, 200) : null,
      at: new Date().toISOString(),
    });
    if (history.length > 50) history.length = 50;
    await db.run(
      `INSERT INTO settings(key,value) VALUES('sync.history',$1)
       ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value`,
      JSON.stringify(history)
    );
  } catch {}
}

// ─────────────────────────────────────────────────────────────
// GET /api/sync/history
// ─────────────────────────────────────────────────────────────
router.get('/history', async (req, res) => {
  try {
    const row = await db.get("SELECT value FROM settings WHERE key='sync.history'");
    res.json(JSON.parse(row?.value || '[]'));
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
  if (!googleAds.isConfigured()) {
    return res.status(503).json({ error: 'Google Ads não configurado', missing: googleAds.getMissingFields() });
  }
  const { from, to } = req.body || {};
  if (!from || !to) return res.status(400).json({ error: 'from e to (YYYY-MM-DD) obrigatórios' });

  const stream = req.query.stream === '1';
  const send   = stream ? startSSE(res) : null;

  try {
    send?.('info', { message: `Google Ads: buscando dados de ${from} até ${to}…` });
    const rows      = await googleAds.fetchMetrics(from, to);
    const campaigns = [...new Set(rows.map(r => r.campaignName))];
    send?.('info', { message: `${rows.length} linhas encontradas em ${campaigns.length} campanhas` });
    const inserted = await upsertRows(rows, 'google');
    send?.('success', { message: `✓ ${inserted} registros importados com sucesso!`, fetched: rows.length, inserted });
    await logSync('google', from, to, rows.length, inserted, 'ok');
    if (stream) { send('done', { fetched: rows.length, inserted }); res.end(); }
    else res.json({ ok: true, fetched: rows.length, inserted, from, to });
  } catch (e) {
    await logSync('google', from, to, 0, 0, 'error', e.message);
    if (stream) { send?.('error', { message: `✗ Erro: ${e.message}` }); res.end(); }
    else res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/sync/meta
// ─────────────────────────────────────────────────────────────
router.post('/meta', async (req, res) => {
  if (!await metaAds.isConfigured()) {
    return res.status(503).json({ error: 'Meta Ads não configurado', missing: metaAds.getMissingFields() });
  }
  const { from, to } = req.body || {};
  if (!from || !to) return res.status(400).json({ error: 'from e to (YYYY-MM-DD) obrigatórios' });

  const stream = req.query.stream === '1';
  const send   = stream ? startSSE(res) : null;

  try {
    send?.('info', { message: `Meta Ads: buscando insights de ${from} até ${to}…` });
    const rows      = await metaAds.fetchMetrics(from, to);
    const campaigns = [...new Set(rows.map(r => r.campaignName))];
    send?.('info', { message: `${rows.length} linhas · ${campaigns.length} campanhas — salvando métricas…` });
    const inserted = await upsertRows(rows, 'meta');

    send?.('info', { message: 'Buscando breakdown por placement (Instagram/Facebook/Stories/Reels)…' });
    const plaRows = await metaAds.fetchPlacementBreakdown(from, to);
    const plaIns  = await upsertPlacement(plaRows, 'meta');

    send?.('success', { message: `✓ ${inserted} métricas + ${plaIns} placements importados!`, fetched: rows.length, inserted });
    await logSync('meta', from, to, rows.length, inserted, 'ok');
    if (stream) { send('done', { fetched: rows.length, inserted, placements: plaIns }); res.end(); }
    else res.json({ ok: true, fetched: rows.length, inserted, placements: plaIns, from, to });
  } catch (e) {
    await logSync('meta', from, to, 0, 0, 'error', e.message);
    if (stream) { send?.('error', { message: `✗ Erro: ${e.message}` }); res.end(); }
    else res.status(500).json({ error: e.message });
  }
});

module.exports = router;
