const db = require('./db');

async function run() {
  try {
    await db.run('ALTER TABLE alert_configs ADD COLUMN IF NOT EXISTS whatsapp TEXT;');
    console.log('Tabela alert_configs alterada com sucesso! Coluna whatsapp adicionada.');
  } catch (e) {
    console.error('Erro:', e.message);
  }
}

run();
