/**
 * routes/drill.js — série diária detalhada de uma campanha específica.
 *
 * GET /api/drill/:campaign_id?year=YYYY[&month=MM]
 */
const express = require('express');
const db      = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/:campaign_id', async (req, res) => {
  const campId = Number(req.params.campaign_id);
  const year   = Number(req.query.year)  || new Date().getFullYear();
  const month  = req.query.month ? Number(req.query.month) : null;

  try {
    const camp = await db.get('SELECT * FROM campaigns WHERE id = $1', campId);
    if (!camp) return res.status(404).json({ error: 'campanha não encontrada' });

    // PostgreSQL: EXTRACT(year FROM date) ao invés de strftime('%Y', date)
    let sql = `
      SELECT date, impressions, clicks, conversions, spend, revenue
      FROM metrics_daily
      WHERE campaign_id = $1
        AND EXTRACT(year FROM date) = $2
    `;
    const args = [campId, year];
    if (month) {
      sql += ` AND EXTRACT(month FROM date) = $3`;
      args.push(month);
    }
    sql += ' ORDER BY date';

    const rows = (await db.all(sql, ...args)).map(r => {
      const imp   = Number(r.impressions) || 0;
      const cli   = Number(r.clicks)      || 0;
      const conv  = Number(r.conversions) || 0;
      const spend = Number(r.spend)       || 0;
      const rev   = Number(r.revenue)     || 0;
      return {
        date: r.date,
        impressions: imp, clicks: cli, conversions: conv, spend, revenue: rev,
        ctr:  imp  ? +(cli/imp).toFixed(4)    : 0,
        cpc:  cli  ? +(spend/cli).toFixed(2)  : 0,
        cvr:  cli  ? +(conv/cli).toFixed(4)   : 0,
        cpl:  conv ? +(spend/conv).toFixed(2) : 0,
        roas: spend? +(rev/spend).toFixed(2)  : 0,
      };
    });

    const totals = rows.reduce((acc, r) => {
      acc.impressions += r.impressions;
      acc.clicks      += r.clicks;
      acc.conversions += r.conversions;
      acc.spend       += r.spend;
      acc.revenue     += r.revenue;
      return acc;
    }, { impressions: 0, clicks: 0, conversions: 0, spend: 0, revenue: 0 });

    const { impressions: imp, clicks: cli, conversions: conv, spend, revenue: rev } = totals;
    totals.ctr  = imp  ? cli/imp    : 0;
    totals.cpc  = cli  ? spend/cli  : 0;
    totals.cvr  = cli  ? conv/cli   : 0;
    totals.cpl  = conv ? spend/conv : 0;
    totals.roas = spend? rev/spend  : 0;

    res.json({ campaign: camp, year, month, rows, totals });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
