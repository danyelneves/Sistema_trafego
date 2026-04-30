const db = require('./db');

async function createReportsTable() {
  const sql = `
  CREATE TABLE IF NOT EXISTS reports (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    ai_summary TEXT,
    metrics_snapshot JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `;
  try {
    await db.run(sql);
    console.log("Table reports created successfully.");
  } catch(e) {
    console.error("Error creating reports:", e.message);
  }
}

createReportsTable();
