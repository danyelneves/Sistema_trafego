/**
 * db/reset.js — apaga todos os dados de tráfego, mantém usuários e settings.
 * Uso: npm run reset
 */
require('dotenv').config();
const db = require('./index');

async function main() {
  console.log('--- RESET Maranet Dashboard (PostgreSQL) ---');
  const tables = ['alert_log', 'alert_configs', 'notes', 'goals', 'metrics_daily', 'campaigns'];

  const tx = db.transaction(async (client) => {
    for (const t of tables) {
      const { rows: [{ n }] } = await client.query(`SELECT COUNT(*) AS n FROM ${t}`);
      await client.query(`DELETE FROM ${t}`);
      console.log(`  ✓ ${t}: ${n} linhas removidas`);
    }
    // Reseta sequências SERIAL (equivalente ao sqlite_sequence)
    for (const t of tables) {
      await client.query(`ALTER SEQUENCE IF EXISTS ${t}_id_seq RESTART WITH 1`);
    }
  });

  await tx();

  const { c: users }    = await db.get('SELECT COUNT(*) AS c FROM users');
  const { c: settings } = await db.get('SELECT COUNT(*) AS c FROM settings');

  console.log('\n--- RESET concluído ---');
  console.log(`✓ Usuários mantidos:  ${users}`);
  console.log(`✓ Settings mantidas:  ${settings}`);
  console.log('✓ Todos os dados de tráfego foram zerados.\n');
  process.exit(0);
}

main().catch(e => {
  console.error('✗ Erro durante reset:', e.message);
  process.exit(1);
});
