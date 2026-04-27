/**
 * routes/import.js — importação de métricas via CSV (corpo JSON com texto CSV).
 *
 * POST /api/import/csv
 *   Body: { csv: "cabeçalho\nlinha1\nlinha2..." }
 *
 * Formato esperado (case-insensitive, separador: vírgula ou ponto-e-vírgula):
 *   campaign_name, channel, date, impressions, clicks, conversions, spend, revenue
 *
 * Retorna: { imported, skipped, errors[] }
 */
const express = require('express');
const db      = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireAdmin);

function parseCSV(text) {
  const sep   = text.includes(';') ? ';' : ',';
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error('CSV deve ter ao menos uma linha de cabeçalho e uma de dados');

  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, ''));
  return lines.slice(1).filter(l => l.trim()).map((line, i) => {
    const vals = line.split(sep);
    const obj  = {};
    headers.forEach((h, idx) => { obj[h] = (vals[idx] || '').trim(); });
    return { _line: i + 2, ...obj };
  });
}

router.post('/csv', async (req, res) => {
  const { csv } = req.body || {};
  if (!csv || typeof csv !== 'string') return res.status(400).json({ error: 'Envie { csv: "..." } no body' });

  let rows;
  try { rows = parseCSV(csv); }
  catch (e) { return res.status(400).json({ error: e.message }); }

  const results = { imported: 0, skipped: 0, errors: [] };

  try {
    // Cache de campanhas: (channel, name) → id
    const campCache = new Map();
    (await db.all('SELECT id, channel, name FROM campaigns'))
      .forEach(c => campCache.set(`${c.channel}::${c.name.toLowerCase()}`, c.id));

    const tx = db.transaction(async (client) => {
      for (const r of rows) {
        const name    = (r.campaign_name || r.campanha || '').toLowerCase();
        const channel = (r.channel || r.canal || '').toLowerCase()
          .replace('google ads','google').replace('meta ads','meta');
        const date    = r.date || r.data || '';

        if (!name || !['google','meta'].includes(channel) || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          results.errors.push({ line: r._line, error: `campaign_name, channel (google/meta) e date (YYYY-MM-DD) são obrigatórios` });
          results.skipped++;
          continue;
        }

        let campId = campCache.get(`${channel}::${name}`);
        if (!campId) {
          const found = await client.get(
            'SELECT id FROM campaigns WHERE channel = $1 AND LOWER(name) = $2',
            channel, name
          );
          if (!found) {
            results.errors.push({ line: r._line, error: `Campanha "${r.campaign_name || r.campanha}" não encontrada no canal ${channel}` });
            results.skipped++;
            continue;
          }
          campId = found.id;
          campCache.set(`${channel}::${name}`, campId);
        }

        const imp   = Number(r.impressions  || r.impressoes  || 0);
        const cli   = Number(r.clicks       || r.cliques     || 0);
        const conv  = Number(r.conversions  || r.conversoes  || 0);
        const spend = Number(r.spend        || r.investimento|| 0);
        const rev   = Number(r.revenue      || r.receita     || 0);

        if ([imp, cli, conv, spend, rev].some(n => isNaN(n))) {
          results.errors.push({ line: r._line, error: 'Valores numéricos inválidos' });
          results.skipped++;
          continue;
        }

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
        `, campId, date, imp, cli, conv, spend, rev);
        results.imported++;
      }
    });

    await tx();
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
