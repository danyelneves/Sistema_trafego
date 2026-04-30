const db = require('./db');

async function createTable() {
  const sql = `
  CREATE TABLE IF NOT EXISTS pixel_events (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    url TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_term TEXT,
    utm_content TEXT,
    click_id TEXT,
    revenue NUMERIC(10,2) DEFAULT 0,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `;
  try {
    await db.run(sql);
    console.log("Table pixel_events created successfully.");
  } catch(e) {
    console.error("Error:", e.message);
  }
}

createTable();
