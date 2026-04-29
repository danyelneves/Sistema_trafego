require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function migrate() {
  console.log('Criando tabela metrics_ads no Supabase...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS metrics_ads (
        id            SERIAL PRIMARY KEY,
        campaign_id   INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        ad_id         TEXT NOT NULL,
        ad_name       TEXT,
        thumbnail_url TEXT,
        date          DATE NOT NULL,
        impressions   INTEGER DEFAULT 0,
        clicks        INTEGER DEFAULT 0,
        conversions   INTEGER DEFAULT 0,
        spend         NUMERIC(14,2) DEFAULT 0,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(campaign_id, ad_id, date)
      );
      CREATE INDEX IF NOT EXISTS idx_metrics_ads_campaign ON metrics_ads(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_metrics_ads_date ON metrics_ads(date);
    `);
    await client.query('COMMIT');
    console.log('✅ Tabela metrics_ads criada/verificada com sucesso!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro:', err);
  } finally {
    client.release();
    pool.end();
  }
}
migrate();
