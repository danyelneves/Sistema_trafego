/**
 * routes/metrics.js — métricas diárias e agregações.
 *
 * Todos os strftime('%Y'/'%m', date) do SQLite foram convertidos para
 * EXTRACT(year/month FROM date) do PostgreSQL.
 */
const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function buildChannelFilter(args, channel, alias = 'c') {
  if (channel && channel !== 'all') {
    args.push(channel);
    return ` AND ${alias}.channel = $${args.length}`;
  }
  return '';
}

const AGG = `
  COALESCE(SUM(m.impressions),0)::bigint AS impressions,
  COALESCE(SUM(m.clicks),0)::bigint      AS clicks,
  COALESCE(SUM(m.conversions),0)::bigint AS conversions,
  COALESCE(SUM(m.spend),0)::numeric      AS spend,
  COALESCE(SUM(m.revenue),0)::numeric    AS revenue,
  COALESCE(SUM(m.sales),0)::bigint       AS sales,
  COALESCE(SUM(m.reach),0)::bigint       AS reach,
  COALESCE(SUM(m.video_views),0)::bigint AS video_views,
  COALESCE(SUM(m.story_views),0)::bigint AS story_views,
  COALESCE(SUM(m.link_clicks),0)::bigint AS link_clicks,
  COALESCE(SUM(m.post_engagement),0)::bigint AS post_engagement
`;

function deriveKpis(r) {
  const imp  = Number(r.impressions) || 0;
  const cli  = Number(r.clicks)      || 0;
  const conv = Number(r.conversions) || 0;
  const spend= Number(r.spend)       || 0;
  const rev  = Number(r.revenue)     || 0;
  const sales= Number(r.sales)       || 0;
  const reach= Number(r.reach)       || 0;
  const videoViews = Number(r.video_views) || 0;
  const storyViews = Number(r.story_views) || 0;
  const linkClicks = Number(r.link_clicks) || 0;
  const postEngagement = Number(r.post_engagement) || 0;

  const ctr  = imp   ? cli/imp    : 0;
  const cpc  = cli   ? spend/cli  : 0;
  const cvr  = cli   ? conv/cli   : 0;
  const cpl  = conv  ? spend/conv : 0;
  const cac  = sales ? spend/sales: 0;
  const roas = spend ? rev/spend  : 0;
  const frequency = reach ? imp/reach : 0;
  return { 
    ...r, 
    impressions: imp, clicks: cli, conversions: conv, spend, revenue: rev, sales,
    reach, videoViews, storyViews, linkClicks, postEngagement,
    ctr, cpc, cvr, cpl, cac, roas, frequency
  };
}

// ----------------------------------------------------------------
// GET /api/metrics/daily
// ----------------------------------------------------------------
router.get('/daily', async (req, res) => {
  const { from, to, channel, campaign_id } = req.query;
  const limit  = Math.min(Number(req.query.limit)  || 500, 5000);
  const offset = Number(req.query.offset) || 0;

  const args = [req.user.workspace_id];
  let where = 'WHERE c.workspace_id = $1';

  if (from)        { args.push(from);             where += ` AND m.date >= $${args.length}`; }
  if (to)          { args.push(to);               where += ` AND m.date <= $${args.length}`; }
  if (campaign_id) { args.push(Number(campaign_id)); where += ` AND m.campaign_id = $${args.length}`; }
  if (channel && channel !== 'all') { args.push(channel); where += ` AND c.channel = $${args.length}`; }

  const base = `
    FROM metrics_daily m
    JOIN campaigns c ON c.id = m.campaign_id
    ${where}
  `;

  try {
    const countArgs = [...args];
    const { rows: [{ n }] } = await db.query(`SELECT COUNT(*) AS n ${base}`, countArgs);

    const dataArgs = [...args, limit, offset];
    const dataRows = await db.all(
      `SELECT m.*, c.channel, c.name AS campaign_name, c.objective ${base} ORDER BY m.date, c.channel, c.name LIMIT $${dataArgs.length - 1} OFFSET $${dataArgs.length}`,
      ...dataArgs
    );

    res.json({ total: Number(n), limit, offset, rows: dataRows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ----------------------------------------------------------------
// POST /api/metrics/daily  (upsert)
// ----------------------------------------------------------------
router.post('/daily', requireAdmin, async (req, res) => {
  const { campaign_id, date } = req.body || {};
  let { impressions = 0, clicks = 0, conversions = 0, spend = 0, revenue = 0 } = req.body || {};
  if (!campaign_id || !date) return res.status(400).json({ error: 'campaign_id e date são obrigatórios' });
  if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) return res.status(400).json({ error: 'date deve ser YYYY-MM-DD' });

  [impressions, clicks, conversions, spend, revenue] = [impressions, clicks, conversions, spend, revenue].map(Number);
  if ([impressions, clicks, conversions, spend, revenue].some(isNaN))
    return res.status(400).json({ error: 'valores numéricos inválidos' });

  try {
    const camp = await db.get('SELECT id FROM campaigns WHERE id = $1', campaign_id);
    if (!camp) return res.status(404).json({ error: 'campanha inexistente' });

    const row = await db.get(`
      INSERT INTO metrics_daily (campaign_id, date, impressions, clicks, conversions, spend, revenue)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT(campaign_id, date) DO UPDATE SET
        impressions = EXCLUDED.impressions,
        clicks      = EXCLUDED.clicks,
        conversions = EXCLUDED.conversions,
        spend       = EXCLUDED.spend,
        revenue     = EXCLUDED.revenue,
        updated_at  = NOW()
      RETURNING *
    `, campaign_id, date, impressions, clicks, conversions, spend, revenue);

    const result = await db.get(`
      SELECT m.*, c.channel, c.name AS campaign_name
        FROM metrics_daily m JOIN campaigns c ON c.id = m.campaign_id
       WHERE m.campaign_id = $1 AND m.date = $2
    `, campaign_id, date);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ----------------------------------------------------------------
// POST /api/metrics/bulk  (upsert em lote)
// ----------------------------------------------------------------
router.post('/bulk', requireAdmin, async (req, res) => {
  const rows = Array.isArray(req.body) ? req.body : req.body?.rows;
  if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: 'envie um array de linhas' });

  try {
    const tx = db.transaction(async (client) => {
      for (const r of rows) {
        await client.run(`
          INSERT INTO metrics_daily (campaign_id, date, impressions, clicks, conversions, spend, revenue)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT(campaign_id, date) DO UPDATE SET
            impressions = EXCLUDED.impressions,
            clicks      = EXCLUDED.clicks,
            conversions = EXCLUDED.conversions,
            spend       = EXCLUDED.spend,
            revenue     = EXCLUDED.revenue,
            updated_at  = NOW()
        `, r.campaign_id, r.date, r.impressions||0, r.clicks||0, r.conversions||0, r.spend||0, r.revenue||0);
      }
    });
    await tx();
    res.json({ ok: true, inserted: rows.length });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ----------------------------------------------------------------
// DELETE /api/metrics/daily/:id
// ----------------------------------------------------------------
router.delete('/daily/:id', requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await db.run('DELETE FROM metrics_daily WHERE id = $1', Number(req.params.id));
    if (!rowCount) return res.status(404).json({ error: 'não encontrada' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ----------------------------------------------------------------
// GET /api/metrics/monthly
// ----------------------------------------------------------------
router.get('/monthly', async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const { channel } = req.query;

  const args = [req.user.workspace_id, year];
  let channelClause = '';
  if (channel && channel !== 'all') { args.push(channel); channelClause = ` AND c.channel = $${args.length}`; }

  try {
    const rows = (await db.all(`
      SELECT
        EXTRACT(month FROM m.date)::int AS month,
        c.channel,
        ${AGG}
      FROM metrics_daily m
      JOIN campaigns c ON c.id = m.campaign_id
      WHERE c.workspace_id = $1 AND EXTRACT(year FROM m.date) = $2
      ${channelClause}
      GROUP BY EXTRACT(month FROM m.date), c.channel
      ORDER BY month, c.channel
    `, ...args)).map(r => deriveKpis({ ...r, month: Number(r.month) }));
    res.json({ year, rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ----------------------------------------------------------------
// GET /api/metrics/summary
// ----------------------------------------------------------------
router.get('/summary', async (req, res) => {
  const year  = Number(req.query.year) || new Date().getFullYear();
  const month = req.query.month ? Number(req.query.month) : null;
  const { channel } = req.query;

  try {
    if (month) {
      const args = [req.user.workspace_id, year, month];
      let channelClause = '';
      if (channel && channel !== 'all') { args.push(channel); channelClause = ` AND c.channel = $${args.length}`; }

      const rows = (await db.all(`
        SELECT m.date::text, c.channel, ${AGG}
        FROM metrics_daily m JOIN campaigns c ON c.id = m.campaign_id
        WHERE c.workspace_id = $1 AND EXTRACT(year FROM m.date) = $2 AND EXTRACT(month FROM m.date) = $3
        ${channelClause}
        GROUP BY m.date, c.channel ORDER BY m.date, c.channel
      `, ...args)).map(deriveKpis);
      return res.json({ year, month, granularity: 'daily', rows });
    }

    const args = [req.user.workspace_id, year];
    let channelClause = '';
    if (channel && channel !== 'all') { args.push(channel); channelClause = ` AND c.channel = $${args.length}`; }

    const rows = (await db.all(`
      SELECT c.channel, ${AGG}
      FROM metrics_daily m JOIN campaigns c ON c.id = m.campaign_id
      WHERE c.workspace_id = $1 AND EXTRACT(year FROM m.date) = $2
      ${channelClause}
      GROUP BY c.channel
    `, ...args)).map(deriveKpis);
    return res.json({ year, granularity: 'yearly', rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ----------------------------------------------------------------
// GET /api/metrics/by-campaign
// ----------------------------------------------------------------
router.get('/by-campaign', async (req, res) => {
  const year  = Number(req.query.year) || new Date().getFullYear();
  const month = req.query.month ? Number(req.query.month) : null;
  const { channel } = req.query;

  const args = [req.user.workspace_id];
  let where = 'WHERE c.workspace_id = $1';
  if (year)  { args.push(year);  where += ` AND (m.date IS NULL OR EXTRACT(year FROM m.date) = $${args.length})`; }
  if (month) { args.push(month); where += ` AND (m.date IS NULL OR EXTRACT(month FROM m.date) = $${args.length})`; }
  if (channel && channel !== 'all') { args.push(channel); where += ` AND c.channel = $${args.length}`; }

  try {
    const rows = (await db.all(`
      SELECT c.id AS campaign_id, c.channel, c.name AS campaign_name, c.objective, c.status, c.color, ${AGG}
      FROM campaigns c
      LEFT JOIN metrics_daily m ON m.campaign_id = c.id
      ${where}
      GROUP BY c.id, c.channel, c.name, c.objective, c.status, c.color
      ORDER BY SUM(m.spend) DESC NULLS LAST
    `, ...args)).map(r => deriveKpis({
      ...r,
      impressions: r.impressions || 0, clicks: r.clicks || 0,
      conversions: r.conversions || 0, spend: r.spend || 0, revenue: r.revenue || 0,
    }));
    res.json({ year, month, rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ----------------------------------------------------------------
// GET /api/metrics/kpis  (com comparativos)
// ----------------------------------------------------------------
function rangeForPeriod({ year, month, semester }) {
  if (month) {
    const m   = String(month).padStart(2, '0');
    const end = new Date(year, month, 0).getDate();
    return { from: `${year}-${m}-01`, to: `${year}-${m}-${String(end).padStart(2,'0')}` };
  }
  if (semester === 1) return { from: `${year}-01-01`, to: `${year}-06-30` };
  if (semester === 2) return { from: `${year}-07-01`, to: `${year}-12-31` };
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

async function aggRange(from, to, channel, workspaceId) {
  const args = [workspaceId, from, to];
  let channelClause = '';
  if (channel && channel !== 'all') { args.push(channel); channelClause = ` AND c.channel = $${args.length}`; }

  const r = await db.get(`
    SELECT ${AGG}
    FROM metrics_daily m JOIN campaigns c ON c.id = m.campaign_id
    WHERE c.workspace_id = $1 AND m.date BETWEEN $2 AND $3
    ${channelClause}
  `, ...args) || {};

  // Vendas Reais do CRM (Webhook)
  const salesArgs = [workspaceId, from, to];
  let salesChannelClause = '';
  if (channel && channel !== 'all') { salesArgs.push(channel); salesChannelClause = ` AND channel = $${salesArgs.length}`; }

  const s = await db.get(`
    SELECT COUNT(id) as crm_sales, COALESCE(SUM(contract_value), 0) as crm_revenue
    FROM sales
    WHERE workspace_id = $1 AND DATE(created_at) BETWEEN $2 AND $3 AND status IN ('won', 'closed')
    ${salesChannelClause}
  `, ...salesArgs) || {};

  return deriveKpis({
    impressions: r.impressions || 0, clicks: r.clicks || 0,
    conversions: r.conversions || 0, spend: r.spend || 0, 
    revenue: s.crm_revenue || 0, // Receita Real do Webhook
    sales: s.crm_sales || 0,     // Vendas Reais do Webhook
    reach: r.reach || 0, video_views: r.video_views || 0, story_views: r.story_views || 0,
    link_clicks: r.link_clicks || 0, post_engagement: r.post_engagement || 0
  });
}

router.get('/kpis', async (req, res) => {
  const year     = Number(req.query.year)     || new Date().getFullYear();
  const month    = req.query.month    ? Number(req.query.month)    : null;
  const semester = req.query.semester ? Number(req.query.semester) : null;
  const { channel } = req.query;

  try {
    const cur  = rangeForPeriod({ year, month, semester });
    const curTotals = await aggRange(cur.from, cur.to, channel, req.user.workspace_id);

    let prev;
    if (month) {
      const pm = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
      prev = rangeForPeriod({ year: pm.y, month: pm.m });
    } else if (semester) {
      prev = semester === 1
        ? rangeForPeriod({ year: year - 1, semester: 2 })
        : rangeForPeriod({ year, semester: 1 });
    } else {
      prev = rangeForPeriod({ year: year - 1 });
    }
    const prevTotals = await aggRange(prev.from, prev.to, channel, req.user.workspace_id);

    const yoyRange = month
      ? rangeForPeriod({ year: year - 1, month })
      : semester
        ? rangeForPeriod({ year: year - 1, semester })
        : rangeForPeriod({ year: year - 1 });
    const yoyTotals = await aggRange(yoyRange.from, yoyRange.to, channel, req.user.workspace_id);

    res.json({ period: { year, month, semester, channel: channel || 'all', ...cur }, current: curTotals, previous: prevTotals, yoy: yoyTotals });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ----------------------------------------------------------------
// GET /api/metrics/demographics
// ----------------------------------------------------------------
router.get('/demographics', async (req, res) => {
  const year  = Number(req.query.year) || new Date().getFullYear();
  const month = req.query.month ? Number(req.query.month) : null;
  const { channel, type } = req.query;

  const args = [req.user.workspace_id, year];
  let where = `WHERE c.workspace_id = $1 AND EXTRACT(year FROM m.date) = $2`;
  if (month) { args.push(month); where += ` AND EXTRACT(month FROM m.date) = $${args.length}`; }
  if (channel && channel !== 'all') { args.push(channel); where += ` AND c.channel = $${args.length}`; }
  if (type) { args.push(type); where += ` AND m.type = $${args.length}`; }

  try {
    const rows = await db.all(`
      SELECT m.type, m.dimension, c.channel,
        COALESCE(SUM(m.impressions),0)::bigint AS impressions,
        COALESCE(SUM(m.clicks),0)::bigint      AS clicks,
        COALESCE(SUM(m.conversions),0)::bigint AS conversions,
        COALESCE(SUM(m.spend),0)::numeric      AS spend
      FROM metrics_demographics m
      JOIN campaigns c ON c.id = m.campaign_id
      ${where}
      GROUP BY m.type, m.dimension, c.channel
      ORDER BY spend DESC
    `, ...args);
    
    const data = rows.map(r => {
      const spend = Number(r.spend);
      const conversions = Number(r.conversions);
      const clicks = Number(r.clicks);
      const impressions = Number(r.impressions);
      return {
        ...r,
        spend, conversions, clicks, impressions,
        cpl: conversions ? spend / conversions : 0,
        ctr: impressions ? clicks / impressions : 0,
        cpc: clicks ? spend / clicks : 0,
      };
    });

    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ----------------------------------------------------------------
// GET /api/metrics/placements
// ----------------------------------------------------------------
router.get('/placements', async (req, res) => {
  const year  = Number(req.query.year) || new Date().getFullYear();
  const month = req.query.month ? Number(req.query.month) : null;
  const { channel } = req.query;

  const args = [req.user.workspace_id, year];
  let where = `WHERE c.workspace_id = $1 AND EXTRACT(year FROM m.date) = $2`;
  if (month) { args.push(month); where += ` AND EXTRACT(month FROM m.date) = $${args.length}`; }
  if (channel && channel !== 'all') { args.push(channel); where += ` AND c.channel = $${args.length}`; }

  try {
    const rows = await db.all(`
      SELECT m.platform, m.placement, c.channel,
        COALESCE(SUM(m.impressions),0)::bigint AS impressions,
        COALESCE(SUM(m.clicks),0)::bigint      AS clicks,
        COALESCE(SUM(m.conversions),0)::bigint AS conversions,
        COALESCE(SUM(m.spend),0)::numeric      AS spend,
        COALESCE(SUM(m.video_views),0)::bigint AS video_views
      FROM metrics_placement m
      JOIN campaigns c ON c.id = m.campaign_id
      ${where}
      GROUP BY m.platform, m.placement, c.channel
      ORDER BY spend DESC
    `, ...args);
    
    const data = rows.map(r => {
      const spend = Number(r.spend);
      const conversions = Number(r.conversions);
      const clicks = Number(r.clicks);
      const impressions = Number(r.impressions);
      return {
        ...r,
        spend, conversions, clicks, impressions,
        video_views: Number(r.video_views),
        cpl: conversions ? spend / conversions : 0,
        ctr: impressions ? clicks / impressions : 0,
        cpc: clicks ? spend / clicks : 0,
      };
    });

    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ----------------------------------------------------------------
// GET /api/metrics/ads
// ----------------------------------------------------------------
router.get('/ads', async (req, res) => {
  const year  = Number(req.query.year) || new Date().getFullYear();
  const month = req.query.month ? Number(req.query.month) : null;
  const { channel } = req.query;

  const args = [req.user.workspace_id, year];
  let where = `WHERE c.workspace_id = $1 AND EXTRACT(year FROM m.date) = $2`;
  let salesWhere = `s.workspace_id = $1 AND EXTRACT(year FROM s.created_at) = $2`;
  
  if (month) { 
    args.push(month); 
    where += ` AND EXTRACT(month FROM m.date) = $${args.length}`; 
    salesWhere += ` AND EXTRACT(month FROM s.created_at) = $${args.length}`;
  }
  if (channel && channel !== 'all') { 
    args.push(channel); 
    where += ` AND c.channel = $${args.length}`; 
    salesWhere += ` AND s.channel = $${args.length}`;
  }

  try {
    const rows = await db.all(`
      SELECT m.ad_id, m.ad_name, m.thumbnail_url, c.channel, c.name AS campaign_name,
        COALESCE(SUM(m.impressions),0)::bigint AS impressions,
        COALESCE(SUM(m.clicks),0)::bigint      AS clicks,
        COALESCE(SUM(m.conversions),0)::bigint AS conversions,
        COALESCE(SUM(m.spend),0)::numeric      AS spend,
        (SELECT COUNT(id) FROM sales s WHERE (s.utm_content = m.ad_id OR s.utm_content = m.ad_name) AND s.status IN ('won','closed') AND ${salesWhere}) AS crm_sales,
        (SELECT COALESCE(SUM(contract_value),0) FROM sales s WHERE (s.utm_content = m.ad_id OR s.utm_content = m.ad_name) AND s.status IN ('won','closed') AND ${salesWhere}) AS crm_revenue
      FROM metrics_ads m
      JOIN campaigns c ON c.id = m.campaign_id
      ${where}
      GROUP BY m.ad_id, m.ad_name, m.thumbnail_url, c.channel, c.name
      ORDER BY spend DESC
      LIMIT 100
    `, ...args);
    
    const data = rows.map(r => {
      const spend = Number(r.spend);
      const conversions = Number(r.conversions);
      const clicks = Number(r.clicks);
      const impressions = Number(r.impressions);
      const crmSales = Number(r.crm_sales) || 0;
      const crmRevenue = Number(r.crm_revenue) || 0;
      
      return {
        ...r,
        spend, conversions, clicks, impressions, crmSales, crmRevenue,
        cpl: conversions ? spend / conversions : 0,
        ctr: impressions ? clicks / impressions : 0,
        cpc: clicks ? spend / clicks : 0,
        cac: crmSales ? spend / crmSales : 0,
      };
    });

    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
