require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function migrate() {
  console.log('Iniciando migração do BD para v2.0...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('1. Criando tabela de sales (vendas)...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        external_id TEXT UNIQUE, -- ID da venda no CRM
        client_name TEXT,
        client_email TEXT,
        contract_value NUMERIC(10, 2) DEFAULT 0,
        status TEXT,
        utm_source TEXT,
        utm_campaign TEXT,
        sale_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Atualiza a tabela metrics_daily para ter os campos sales e revenue caso não existam
    console.log('2. Atualizando tabela metrics_daily...');
    await client.query(`
      ALTER TABLE metrics_daily ADD COLUMN IF NOT EXISTS sales INTEGER DEFAULT 0;
      ALTER TABLE metrics_daily ADD COLUMN IF NOT EXISTS revenue NUMERIC(10, 2) DEFAULT 0;
    `);

    await client.query('COMMIT');
    console.log('✅ Migração concluída com sucesso!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro na migração:', err);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
