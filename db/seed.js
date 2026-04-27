/**
 * db/seed.js — popula o banco com dados realistas de exemplo
 *
 * Rode com:  npm run seed
 * Cria usuário admin e 12 meses de dados distribuídos entre 6 campanhas.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./index');

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'maranet2026';

// ------------------------------------------------------------
// Usuário admin
// ------------------------------------------------------------
async function ensureAdmin() {
  const row = await db.get('SELECT id FROM users WHERE username = $1', ADMIN_USER);
  if (row) { console.log(`✓ usuário "${ADMIN_USER}" já existe`); return; }

  const hash = await bcrypt.hash(ADMIN_PASS, 10);
  await db.run(
    `INSERT INTO users (username, password_hash, display_name, role)
     VALUES ($1, $2, $3, 'admin')`,
    ADMIN_USER, hash, 'Administrador Maranet'
  );
  console.log(`✓ criado usuário ${ADMIN_USER} / ${ADMIN_PASS}`);
}

// ------------------------------------------------------------
// Campanhas-semente
// ------------------------------------------------------------
const SEED_CAMPAIGNS = [
  { channel: 'google', name: 'Fibra Residencial — Pesquisa',   objective: 'Leads',       color: '#4285F4' },
  { channel: 'google', name: 'Empresarial — Pesquisa',         objective: 'Leads',       color: '#1A73E8' },
  { channel: 'google', name: 'Remarketing Display',            objective: 'Conversões',  color: '#34A853' },
  { channel: 'meta',   name: 'Fibra Residencial — Advantage+', objective: 'Leads',       color: '#0866FF' },
  { channel: 'meta',   name: 'Combos TV+Internet — Reels',     objective: 'Conversões',  color: '#5B9BFF' },
  { channel: 'meta',   name: 'Retargeting Site',               objective: 'Conversões',  color: '#9EB5FF' },
];

async function ensureCampaigns() {
  const tx = db.transaction(async (client) => {
    for (const r of SEED_CAMPAIGNS) {
      await client.run(
        `INSERT INTO campaigns (channel, name, objective, color, status)
         VALUES ($1, $2, $3, $4, 'active')
         ON CONFLICT(channel, name) DO NOTHING`,
        r.channel, r.name, r.objective, r.color
      );
    }
  });
  await tx();
  console.log(`✓ ${SEED_CAMPAIGNS.length} campanhas semeadas`);
}

// ------------------------------------------------------------
// Métricas diárias
// ------------------------------------------------------------
function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }
function rand(min, max) { return min + Math.random() * (max - min); }

function generateMonth(campaign, year, month, baseFactor) {
  const dim = daysInMonth(year, month);
  const seasonal = {1:0.85, 2:0.9, 3:1.0, 4:1.05, 5:1.15, 6:1.2,
                    7:1.0, 8:1.0, 9:1.05, 10:1.1, 11:1.2, 12:0.95}[month];
  const profile = {
    'Fibra Residencial — Pesquisa':   { imp:[3200,3800], ctr:[0.042,0.055], cvr:[0.032,0.045], cpc:[1.30,1.70] },
    'Empresarial — Pesquisa':         { imp:[900,1250],  ctr:[0.050,0.065], cvr:[0.040,0.055], cpc:[2.20,2.90] },
    'Remarketing Display':            { imp:[4200,5500], ctr:[0.008,0.014], cvr:[0.015,0.028], cpc:[0.50,0.85] },
    'Fibra Residencial — Advantage+': { imp:[7500,9500], ctr:[0.018,0.028], cvr:[0.020,0.030], cpc:[0.80,1.20] },
    'Combos TV+Internet — Reels':     { imp:[4500,6200], ctr:[0.022,0.034], cvr:[0.018,0.028], cpc:[0.55,0.95] },
    'Retargeting Site':               { imp:[2200,3100], ctr:[0.030,0.048], cvr:[0.028,0.045], cpc:[0.45,0.80] },
  }[campaign.name] || { imp:[1000,2000], ctr:[0.02,0.04], cvr:[0.02,0.04], cpc:[1,2] };

  const rows = [];
  for (let day = 1; day <= dim; day++) {
    const weekendDip = (new Date(year, month-1, day).getDay() % 6 === 0) ? 0.88 : 1.0;
    const imp  = Math.round(rand(profile.imp[0], profile.imp[1]) * seasonal * baseFactor * weekendDip);
    const ctr  = rand(profile.ctr[0], profile.ctr[1]);
    const clicks = Math.round(imp * ctr);
    const cvr  = rand(profile.cvr[0], profile.cvr[1]);
    const conv = Math.max(0, Math.round(clicks * cvr));
    const cpc  = rand(profile.cpc[0], profile.cpc[1]);
    const spend = +(clicks * cpc).toFixed(2);
    const revenue = +(conv * rand(850, 1250)).toFixed(2);
    rows.push({
      campaign_id: campaign.id,
      date: `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
      impressions: imp, clicks, conversions: conv, spend, revenue,
    });
  }
  return rows;
}

async function ensureMetrics() {
  const campaigns = await db.all('SELECT * FROM campaigns ORDER BY id');
  const { c: existing } = await db.get('SELECT COUNT(*) AS c FROM metrics_daily');
  if (Number(existing) > 0) {
    console.log(`✓ métricas já presentes (${existing} linhas) — pulando seed de métricas`);
    return;
  }

  const baseFactors = {
    'Fibra Residencial — Pesquisa':   1.00,
    'Empresarial — Pesquisa':         0.45,
    'Remarketing Display':            0.80,
    'Fibra Residencial — Advantage+': 1.10,
    'Combos TV+Internet — Reels':     0.85,
    'Retargeting Site':               0.55,
  };

  const years = [2025, 2026];
  let total = 0;

  for (const year of years) {
    const maxMonth = year === 2026 ? 4 : 12;
    for (let month = 1; month <= maxMonth; month++) {
      const tx = db.transaction(async (client) => {
        for (const c of campaigns) {
          const bf  = baseFactors[c.name] ?? 1.0;
          const yoy = year === 2026 ? 1.18 : 1.0;
          for (const r of generateMonth(c, year, month, bf * yoy)) {
            await client.run(`
              INSERT INTO metrics_daily (campaign_id, date, impressions, clicks, conversions, spend, revenue)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT(campaign_id, date) DO NOTHING
            `, r.campaign_id, r.date, r.impressions, r.clicks, r.conversions, r.spend, r.revenue);
            total++;
          }
        }
      });
      await tx();
      process.stdout.write(`  → ${year}-${String(month).padStart(2,'0')}...\r`);
    }
  }
  console.log(`✓ ${total} linhas de métricas geradas (2025 + 2026 até abr)       `);
}

// ------------------------------------------------------------
// Metas de exemplo
// ------------------------------------------------------------
async function ensureGoals() {
  const { c: existing } = await db.get('SELECT COUNT(*) AS c FROM goals');
  if (Number(existing) > 0) { console.log('✓ metas já cadastradas'); return; }

  const tx = db.transaction(async (client) => {
    for (let m = 1; m <= 12; m++) {
      await client.run(
        `INSERT INTO goals (year, month, channel, metric, target, direction) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT(year,month,channel,metric) DO NOTHING`,
        2026, m, 'all', 'conversions', 350, 'min'
      );
      await client.run(
        `INSERT INTO goals (year, month, channel, metric, target, direction) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT(year,month,channel,metric) DO NOTHING`,
        2026, m, 'all', 'cpl', 45, 'max'
      );
      await client.run(
        `INSERT INTO goals (year, month, channel, metric, target, direction) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT(year,month,channel,metric) DO NOTHING`,
        2026, m, 'all', 'spend', 14000, 'max'
      );
      await client.run(
        `INSERT INTO goals (year, month, channel, metric, target, direction) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT(year,month,channel,metric) DO NOTHING`,
        2026, m, 'google', 'cpl', 48, 'max'
      );
      await client.run(
        `INSERT INTO goals (year, month, channel, metric, target, direction) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT(year,month,channel,metric) DO NOTHING`,
        2026, m, 'meta', 'cpl', 42, 'max'
      );
    }
  });
  await tx();
  console.log('✓ metas de 2026 criadas');
}

// ------------------------------------------------------------
// Notas de exemplo
// ------------------------------------------------------------
async function ensureNotes() {
  const { c: existing } = await db.get('SELECT COUNT(*) AS c FROM notes');
  if (Number(existing) > 0) { console.log('✓ notas já cadastradas'); return; }

  const tx = db.transaction(async (client) => {
    await client.run(
      `INSERT INTO notes (year, month, day, channel, text, tag) VALUES ($1,$2,$3,$4,$5,$6)`,
      2026, 2, null, 'all', 'Ajuste de lance automático em Google Ads — foco em conversão.', 'ajuste'
    );
    await client.run(
      `INSERT INTO notes (year, month, day, channel, text, tag) VALUES ($1,$2,$3,$4,$5,$6)`,
      2026, 3, 15, 'meta', 'Nova criativa Reels para combo TV+Internet estreou dia 15.', 'campanha'
    );
    await client.run(
      `INSERT INTO notes (year, month, day, channel, text, tag) VALUES ($1,$2,$3,$4,$5,$6)`,
      2026, 4, null, 'all', 'Campanha de aniversário 10 anos Maranet — orçamento +25% no mês.', 'evento'
    );
  });
  await tx();
  console.log('✓ notas de exemplo criadas');
}

// ------------------------------------------------------------
async function main() {
  console.log('--- SEED Maranet Dashboard (PostgreSQL) ---');
  await ensureAdmin();
  await ensureCampaigns();
  await ensureMetrics();
  await ensureGoals();
  await ensureNotes();
  console.log('--- done ---');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
