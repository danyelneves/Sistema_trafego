const db = require('./db');

async function createFinancialTable() {
  const sql = `
  CREATE TABLE IF NOT EXISTS financial_settings (
    workspace_id INTEGER PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    product_cost NUMERIC(10,2) DEFAULT 0,
    tax_rate NUMERIC(5,2) DEFAULT 0,
    gateway_rate NUMERIC(5,2) DEFAULT 0,
    agency_fee NUMERIC(10,2) DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `;
  try {
    await db.run(sql);
    console.log("Table financial_settings created successfully.");
  } catch(e) {
    console.error("Error creating financial_settings:", e.message);
  }
}

createFinancialTable();
