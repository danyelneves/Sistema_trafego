require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function migrate() {
  console.log('Adicionando colunas utm_content e utm_term na tabela sales...');
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE sales 
      ADD COLUMN IF NOT EXISTS utm_content TEXT,
      ADD COLUMN IF NOT EXISTS utm_term TEXT;
    `);
    console.log('✅ Colunas utm_content e utm_term adicionadas com sucesso!');
  } catch (err) {
    console.error('❌ Erro:', err);
  } finally {
    client.release();
    pool.end();
  }
}
migrate();
