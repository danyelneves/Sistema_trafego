require('dotenv').config();
const db = require('./db');

async function migrate() {
  try {
    await db.run('ALTER TABLE alert_configs ADD COLUMN IF NOT EXISTS webhook_url TEXT;');
    await db.run('ALTER TABLE alert_configs ADD COLUMN IF NOT EXISTS window_days INTEGER DEFAULT 0;');
    console.log('Migration successful: added webhook_url and window_days');
  } catch (e) {
    console.error('Migration error:', e);
  }
}

migrate();
