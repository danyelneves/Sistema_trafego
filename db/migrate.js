/**
 * db/migrate.js — aplica o schema PostgreSQL no banco Supabase.
 *
 * Uso: npm run db:migrate
 *
 * Requer DATABASE_URL no .env apontando para o Supabase.
 * Idempotente: usa IF NOT EXISTS em todas as tabelas.
 */
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('✗ DATABASE_URL não definida. Configure o .env primeiro.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function main() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const client = await pool.connect();
  try {
    console.log('--- Aplicando schema no PostgreSQL (Supabase) ---');
    await client.query(schema);
    console.log('✓ Schema aplicado com sucesso!');
    console.log('\nTabelas criadas/verificadas:');
    const { rows } = await client.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    rows.forEach(r => console.log(`  • ${r.tablename}`));
  } finally {
    client.release();
    await pool.end();
  }
}

main().then(() => process.exit(0)).catch(e => {
  console.error('✗ Erro:', e.message);
  process.exit(1);
});
