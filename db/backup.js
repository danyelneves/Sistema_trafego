/**
 * db/backup.js — cria uma cópia datada do banco SQLite.
 *
 * Uso:  npm run backup
 * Destino: db/backups/nexus-YYYY-MM-DD-HHmm.db
 * Rotação: mantém os últimos BACKUP_KEEP (padrão 30) arquivos.
 */
require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const DB_FILE   = path.join(__dirname, 'nexus.db');
const BACKUP_DIR = path.join(__dirname, 'backups');
const KEEP      = Number(process.env.BACKUP_KEEP) || 30;

if (!fs.existsSync(DB_FILE)) {
  console.error('✗  Banco não encontrado:', DB_FILE);
  process.exit(1);
}

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// Nome: nexus-2026-04-23-1430.db
const now = new Date();
const pad = n => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
const dest  = path.join(BACKUP_DIR, `nexus-${stamp}.db`);

fs.copyFileSync(DB_FILE, dest);
const sizeKB = (fs.statSync(dest).size / 1024).toFixed(0);
console.log(`✓  Backup criado: ${path.relative(process.cwd(), dest)} (${sizeKB} KB)`);

// Rotação: remove arquivos mais antigos além do limite
const files = fs.readdirSync(BACKUP_DIR)
  .filter(f => f.startsWith('nexus-') && f.endsWith('.db'))
  .sort();

const toDelete = files.slice(0, Math.max(0, files.length - KEEP));
toDelete.forEach(f => {
  try {
    fs.unlinkSync(path.join(BACKUP_DIR, f));
    console.log(`  ↳ removido (rotação): ${f}`);
  } catch (e) {
    console.warn(`  ↳ falha ao remover ${f}: ${e.message}`);
  }
});

console.log(`✓  ${Math.min(files.length, KEEP)} backup(s) mantidos em db/backups/`);
