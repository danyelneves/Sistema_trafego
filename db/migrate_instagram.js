require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('--- Migrando schema: métricas Instagram ---');
    await client.query(`
      ALTER TABLE metrics_daily
        ADD COLUMN IF NOT EXISTS reach          INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS frequency      NUMERIC(8,4) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS video_views    INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS story_views    INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS reel_plays     INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS link_clicks    INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS post_engagement INTEGER NOT NULL DEFAULT 0;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS metrics_placement (
        id            SERIAL PRIMARY KEY,
        campaign_id   INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        date          DATE    NOT NULL,
        platform      TEXT    NOT NULL CHECK(platform IN ('instagram','facebook','audience_network','messenger')),
        placement     TEXT    NOT NULL,
        impressions   INTEGER NOT NULL DEFAULT 0,
        clicks        INTEGER NOT NULL DEFAULT 0,
        reach         INTEGER NOT NULL DEFAULT 0,
        video_views   INTEGER NOT NULL DEFAULT 0,
        spend         NUMERIC(14,2) NOT NULL DEFAULT 0,
        conversions   INTEGER NOT NULL DEFAULT 0,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(campaign_id, date, platform, placement)
      );
      CREATE INDEX IF NOT EXISTS idx_placement_campaign ON metrics_placement(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_placement_date     ON metrics_placement(date);
      CREATE INDEX IF NOT EXISTS idx_placement_platform ON metrics_placement(platform);
    `);

    const { rows } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'metrics_daily' AND column_name IN ('reach','story_views','video_views')
    `);
    console.log('✓ Colunas adicionadas:', rows.map(r => r.column_name).join(', '));

    const { rows: tables } = await client.query(`
      SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename
    `);
    console.log('✓ Tabelas:', tables.map(r => r.tablename).join(', '));
    console.log('--- done ---');
  } finally {
    client.release();
    await pool.end();
  }
}

run().then(() => process.exit(0)).catch(e => { console.error('✗', e.message); process.exit(1); });
