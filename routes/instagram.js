/**
 * routes/instagram.js — endpoints de dados específicos do Instagram.
 *
 * GET /api/instagram/overview?from=&to=         — KPIs Instagram consolidado
 * GET /api/instagram/placements?from=&to=       — breakdown Feed/Stories/Reels
 * GET /api/instagram/campaigns?from=&to=        — por campanha
 * GET /api/instagram/trend?from=&to=            — evolução diária
 */
const express = require('express');
const db      = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// ─── Helpers ──────────────────────────────────────────────────────────────
function dateParams(req) {
  const { from, to, year, month } = req.query;
  if (from && to) return { from, to };
  const y = Number(year) || new Date().getFullYear();
  const m = Number(month);
  if (m) {
    const f = `${y}-${String(m).padStart(2,'0')}-01`;
    const last = new Date(y, m, 0).getDate();
    const t = `${y}-${String(m).padStart(2,'0')}-${String(last).padStart(2,'0')}`;
    return { from: f, to: t };
  }
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

// ─── GET /api/instagram/overview ──────────────────────────────────────────
router.get('/overview', async (req, res) => {
  const { from, to } = dateParams(req);
  try {
    // Totais gerais das campanhas Meta
    const totals = await db.get(`
      SELECT
        COALESCE(SUM(md.impressions),0)     AS impressions,
        COALESCE(SUM(md.clicks),0)          AS clicks,
        COALESCE(SUM(md.conversions),0)     AS conversions,
        COALESCE(SUM(md.spend),0)           AS spend,
        COALESCE(SUM(md.reach),0)           AS reach,
        COALESCE(SUM(md.video_views),0)     AS video_views,
        COALESCE(SUM(md.story_views),0)     AS story_views,
        COALESCE(SUM(md.link_clicks),0)     AS link_clicks,
        COALESCE(SUM(md.post_engagement),0) AS post_engagement,
        COALESCE(AVG(md.frequency),0)       AS frequency
      FROM metrics_daily md
      JOIN campaigns c ON c.id = md.campaign_id
      WHERE c.channel = 'meta' AND md.date BETWEEN $1 AND $2
    `, from, to);

    // Totais apenas Instagram (da tabela placement)
    const instagram = await db.get(`
      SELECT
        COALESCE(SUM(impressions),0)  AS impressions,
        COALESCE(SUM(clicks),0)       AS clicks,
        COALESCE(SUM(conversions),0)  AS conversions,
        COALESCE(SUM(spend),0)        AS spend,
        COALESCE(SUM(reach),0)        AS reach,
        COALESCE(SUM(video_views),0)  AS video_views
      FROM metrics_placement mp
      JOIN campaigns c ON c.id = mp.campaign_id
      WHERE c.channel = 'meta' AND mp.platform = 'instagram'
        AND mp.date BETWEEN $1 AND $2
    `, from, to);

    const igSpend = Number(instagram?.spend || 0);
    const igConv  = Number(instagram?.conversions || 0);
    const totSpend = Number(totals?.spend || 0);

    res.json({
      period: { from, to },
      meta: {
        impressions:    Number(totals?.impressions || 0),
        clicks:         Number(totals?.clicks || 0),
        conversions:    Number(totals?.conversions || 0),
        spend:          Number(totals?.spend || 0),
        reach:          Number(totals?.reach || 0),
        videoViews:     Number(totals?.video_views || 0),
        storyViews:     Number(totals?.story_views || 0),
        linkClicks:     Number(totals?.link_clicks || 0),
        postEngagement: Number(totals?.post_engagement || 0),
        frequency:      Number(totals?.frequency || 0),
      },
      instagram: {
        impressions: Number(instagram?.impressions || 0),
        clicks:      Number(instagram?.clicks || 0),
        conversions: igConv,
        spend:       igSpend,
        reach:       Number(instagram?.reach || 0),
        videoViews:  Number(instagram?.video_views || 0),
        cpl:         igConv ? igSpend / igConv : 0,
        shareOfSpend: totSpend ? (igSpend / totSpend) * 100 : 0,
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── GET /api/instagram/placements ────────────────────────────────────────
router.get('/placements', async (req, res) => {
  const { from, to } = dateParams(req);
  try {
    const rows = await db.all(`
      SELECT
        mp.platform,
        mp.placement,
        COALESCE(SUM(mp.impressions),0) AS impressions,
        COALESCE(SUM(mp.clicks),0)      AS clicks,
        COALESCE(SUM(mp.reach),0)       AS reach,
        COALESCE(SUM(mp.video_views),0) AS video_views,
        COALESCE(SUM(mp.spend),0)       AS spend,
        COALESCE(SUM(mp.conversions),0) AS conversions
      FROM metrics_placement mp
      JOIN campaigns c ON c.id = mp.campaign_id
      WHERE c.channel = 'meta' AND mp.date BETWEEN $1 AND $2
      GROUP BY mp.platform, mp.placement
      ORDER BY mp.platform, SUM(mp.impressions) DESC
    `, from, to);
    res.json({ period: { from, to }, placements: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── GET /api/instagram/campaigns ─────────────────────────────────────────
router.get('/campaigns', async (req, res) => {
  const { from, to } = dateParams(req);
  try {
    const rows = await db.all(`
      SELECT
        c.id, c.name,
        COALESCE(SUM(mp.impressions),0) AS impressions,
        COALESCE(SUM(mp.clicks),0)      AS clicks,
        COALESCE(SUM(mp.reach),0)       AS reach,
        COALESCE(SUM(mp.video_views),0) AS video_views,
        COALESCE(SUM(mp.spend),0)       AS spend,
        COALESCE(SUM(mp.conversions),0) AS conversions
      FROM metrics_placement mp
      JOIN campaigns c ON c.id = mp.campaign_id
      WHERE c.channel = 'meta' AND mp.platform = 'instagram'
        AND mp.date BETWEEN $1 AND $2
      GROUP BY c.id, c.name
      ORDER BY SUM(mp.impressions) DESC
    `, from, to);

    res.json({ period: { from, to }, campaigns: rows.map(r => ({
      id:          r.id,
      name:        r.name,
      impressions: Number(r.impressions),
      clicks:      Number(r.clicks),
      reach:       Number(r.reach),
      videoViews:  Number(r.video_views),
      spend:       Number(r.spend),
      conversions: Number(r.conversions),
      ctr:         r.impressions ? (r.clicks / r.impressions) * 100 : 0,
      cpl:         r.conversions ? r.spend / r.conversions : 0,
    }))});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── GET /api/instagram/trend ─────────────────────────────────────────────
router.get('/trend', async (req, res) => {
  const { from, to } = dateParams(req);
  try {
    const rows = await db.all(`
      SELECT
        mp.date,
        mp.placement,
        COALESCE(SUM(mp.impressions),0) AS impressions,
        COALESCE(SUM(mp.clicks),0)      AS clicks,
        COALESCE(SUM(mp.video_views),0) AS video_views,
        COALESCE(SUM(mp.spend),0)       AS spend,
        COALESCE(SUM(mp.conversions),0) AS conversions
      FROM metrics_placement mp
      JOIN campaigns c ON c.id = mp.campaign_id
      WHERE c.channel = 'meta' AND mp.platform = 'instagram'
        AND mp.date BETWEEN $1 AND $2
      GROUP BY mp.date, mp.placement
      ORDER BY mp.date ASC, mp.placement
    `, from, to);
    res.json({ period: { from, to }, trend: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
