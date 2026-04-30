const db = require('./db');

async function createForgeTables() {
  const sqlFunnels = `
  CREATE TABLE IF NOT EXISTS funnels (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255),
    niche VARCHAR(100),
    html_content TEXT,
    visits INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  `;

  try {
    await db.run(sqlFunnels);
    console.log("Forge (Funnels) Table created successfully.");
  } catch(e) {
    console.error("Error creating Forge tables:", e.message);
  }
}

createForgeTables();
