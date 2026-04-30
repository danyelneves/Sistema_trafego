const db = require('./db');

async function createTable() {
  const sql = `
  CREATE TABLE IF NOT EXISTS automations (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    metric TEXT NOT NULL,
    operator TEXT NOT NULL,
    value NUMERIC(10,2) NOT NULL,
    action TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    last_run TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `;
  try {
    await db.run(sql);
    console.log("Table automations created successfully.");
  } catch(e) {
    console.error("Error:", e.message);
  }
}

createTable();
