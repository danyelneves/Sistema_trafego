const db = require('./db');

async function createNexusTables() {
  const sql = `
  CREATE TABLE IF NOT EXISTS pixel_journeys (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
    visitor_id VARCHAR(100) NOT NULL, -- UUID stored in cookie
    ip_address VARCHAR(50),
    user_agent TEXT,
    utm_source VARCHAR(255),
    utm_medium VARCHAR(255),
    utm_campaign VARCHAR(255),
    utm_term VARCHAR(255),
    utm_content VARCHAR(255),
    referrer TEXT,
    landing_page TEXT,
    event_type VARCHAR(50) DEFAULT 'page_view', -- page_view, lead, purchase
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  `;
  try {
    await db.run(sql);
    console.log("Nexus Tracking tables created successfully.");
  } catch(e) {
    console.error("Error creating Nexus tables:", e.message);
  }
}

createNexusTables();
