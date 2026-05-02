require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function migrate() {
  console.log('--- Iniciando Migração Fase 2: SaaS Multi-Tenant ---');
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // 1. Criar tabela workspaces
    await client.query(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id            SERIAL PRIMARY KEY,
        name          TEXT NOT NULL,
        slug          TEXT UNIQUE,
        logo_url      TEXT,
        theme_color   TEXT DEFAULT '#00ADA7',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    
    // 2. Inserir workspace padrão (workspace padrão) se não existir
    const wsRes = await client.query(`
      INSERT INTO workspaces (name, slug) 
      VALUES ('Nexus', 'nexus')
      ON CONFLICT (slug) DO NOTHING
      RETURNING id;
    `);
    
    let defaultWsId = 1;
    if (wsRes.rows.length > 0) {
      defaultWsId = wsRes.rows[0].id;
    } else {
      const existing = await client.query(`SELECT id FROM workspaces WHERE slug = 'nexus'`);
      if (existing.rows.length > 0) defaultWsId = existing.rows[0].id;
    }
    
    console.log(`Workspace padrão ID: ${defaultWsId}`);

    // 3. Atualizar ou Criar Users e User_Workspaces
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS current_workspace_id INTEGER REFERENCES workspaces(id) ON DELETE SET NULL;
      
      UPDATE users SET current_workspace_id = ${defaultWsId} WHERE current_workspace_id IS NULL;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_workspaces (
        user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workspace_id  INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        role          TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin','viewer')),
        UNIQUE(user_id, workspace_id)
      );
    `);
    
    // Associar todos os usuários existentes ao workspace padrão como admin
    await client.query(`
      INSERT INTO user_workspaces (user_id, workspace_id, role)
      SELECT id, ${defaultWsId}, 'admin' FROM users
      ON CONFLICT DO NOTHING;
    `);

    // 4. Criar workspace_settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS workspace_settings (
        workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        key          TEXT NOT NULL,
        value        TEXT,
        UNIQUE(workspace_id, key)
      );
    `);

    // 5. Adicionar workspace_id nas tabelas existentes e atualizar registros antigos
    const tables = ['campaigns', 'sales', 'goals', 'notes', 'alert_configs'];
    for (const table of tables) {
      await client.query(`
        ALTER TABLE ${table}
        ADD COLUMN IF NOT EXISTS workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE;
      `);
      
      await client.query(`
        UPDATE ${table} SET workspace_id = ${defaultWsId} WHERE workspace_id IS NULL;
      `);
    }

    await client.query('COMMIT');
    console.log('✅ Migração estrutural Fase 2 concluída com sucesso!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro na migração:', err);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
