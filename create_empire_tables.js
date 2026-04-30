const db = require('./db');

async function createEmpireTables() {
  const sql = `
  CREATE TABLE IF NOT EXISTS subscriptions (
    workspace_id INTEGER PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    plan_name VARCHAR(50) DEFAULT 'free',
    stripe_customer_id VARCHAR(100),
    stripe_subscription_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    current_period_end TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS kanban_tasks (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'backlog',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS wa_settings (
    workspace_id INTEGER PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    api_url VARCHAR(255),
    api_token VARCHAR(255),
    active BOOLEAN DEFAULT false
  );

  CREATE TABLE IF NOT EXISTS spy_creatives (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
    ad_url TEXT,
    ad_media_url TEXT,
    ad_copy TEXT,
    competitor_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  `;
  try {
    await db.run(sql);
    console.log("Empire tables created successfully.");
  } catch(e) {
    console.error("Error creating empire tables:", e.message);
  }
}

createEmpireTables();
