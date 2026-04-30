const db = require('./db');

async function createMarketTables() {
  const sqlLeads = `
  CREATE TABLE IF NOT EXISTS market_leads (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
    niche VARCHAR(100),
    city VARCHAR(100),
    lead_name VARCHAR(100),
    lead_phone VARCHAR(50),
    captured_cost NUMERIC DEFAULT 0,
    sold_price NUMERIC DEFAULT 0,
    status VARCHAR(50) DEFAULT 'AVAILABLE', -- AVAILABLE, SOLD
    buyer_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  `;

  const sqlBuyers = `
  CREATE TABLE IF NOT EXISTS market_buyers (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
    company_name VARCHAR(100),
    buyer_phone VARCHAR(50),
    niche VARCHAR(100),
    city VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  `;

  try {
    await db.run(sqlLeads);
    await db.run(sqlBuyers);
    console.log("Marketplace Tables created successfully.");
  } catch(e) {
    console.error("Error creating Marketplace tables:", e.message);
  }
}

createMarketTables();
