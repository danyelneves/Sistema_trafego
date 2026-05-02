require('dotenv').config();
const db = require('./db');

async function migrate() {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS metrics_demographics (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('region', 'age', 'gender')),
        dimension TEXT NOT NULL,
        impressions BIGINT DEFAULT 0,
        clicks BIGINT DEFAULT 0,
        spend NUMERIC(14,4) DEFAULT 0,
        conversions BIGINT DEFAULT 0,
        UNIQUE(campaign_id, date, type, dimension)
      );
    `);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_metrics_demo_type ON metrics_demographics(type);`);
    console.log('Migration successful: created metrics_demographics table');
  } catch (e) {
    console.error('Migration error:', e);
  }
}

migrate();
