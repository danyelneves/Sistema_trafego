/**
 * utils/terms.js — carrega versões correntes de Termos/Privacidade
 * dos arquivos markdown em content/, hashea, e auto-seeda no DB.
 *
 * Versionamento: cada arquivo tem nome `<kind>-v<N>.md`. Pra publicar
 * uma nova versão, criar `terms-v2.md` e atualizar CURRENT_VERSIONS.
 *
 * Hash sha256 do conteúdo é a "impressão digital" da versão — qualquer
 * mudança de byte muda o hash, garantindo prova de integridade.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../db');

const CONTENT_DIR = path.join(__dirname, '..', 'content');

const CURRENT_VERSIONS = {
  terms:   { version: '1.0', file: 'terms-v1.md',   title: 'Termos de Uso' },
  privacy: { version: '1.0', file: 'privacy-v1.md', title: 'Política de Privacidade' },
};

const _cache = new Map();   // kind -> { row, ts }
const TTL_MS = 5 * 60 * 1000;

/** Markdown → HTML minimal (suficiente pra docs jurídicos). */
function mdToHtml(md) {
  const esc = s => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const lines = md.split('\n');
  let html = '';
  let inList = false, listType = null;
  let inTable = false, tableRows = [];
  let para = [];

  const flushPara = () => {
    if (!para.length) return;
    let text = para.join(' ').trim();
    if (text) html += '<p>' + inline(text) + '</p>\n';
    para = [];
  };
  const flushList = () => {
    if (inList) { html += `</${listType}>\n`; inList = false; listType = null; }
  };
  const flushTable = () => {
    if (!inTable) return;
    html += '<table><thead><tr>' + tableRows[0].map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>';
    for (let i = 2; i < tableRows.length; i++) {
      html += '<tr>' + tableRows[i].map(c => `<td>${inline(c)}</td>`).join('') + '</tr>';
    }
    html += '</tbody></table>\n';
    inTable = false; tableRows = [];
  };

  const inline = s => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');

    // Tabela
    if (/^\|.+\|$/.test(line)) {
      flushPara(); flushList();
      const cells = line.slice(1, -1).split('|').map(c => c.trim());
      tableRows.push(cells);
      inTable = true;
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Heading
    const h = line.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      flushPara(); flushList();
      const lvl = h[1].length;
      html += `<h${lvl}>${inline(h[2])}</h${lvl}>\n`;
      continue;
    }
    // HR
    if (/^---+$/.test(line)) {
      flushPara(); flushList();
      html += '<hr>\n';
      continue;
    }
    // Lista bullet
    const ul = line.match(/^[-*]\s+(.+)$/);
    if (ul) {
      flushPara();
      if (!inList || listType !== 'ul') { flushList(); html += '<ul>\n'; inList = true; listType = 'ul'; }
      html += '<li>' + inline(ul[1]) + '</li>\n';
      continue;
    }
    // Lista alfa-numérica (a) X / 1. X)
    const ol = line.match(/^([a-z0-9]+[.)])\s+(.+)$/i);
    if (ol) {
      flushPara();
      if (!inList || listType !== 'ol') { flushList(); html += '<ol>\n'; inList = true; listType = 'ol'; }
      html += `<li>${inline(ol[2])}</li>\n`;
      continue;
    }
    // Linha vazia → fecha parágrafo
    if (!line.trim()) {
      flushPara(); flushList();
      continue;
    }
    // Acumula no parágrafo
    para.push(line.trim());
  }
  flushPara(); flushList(); flushTable();
  return html;
}

function loadFromDisk(kind) {
  const meta = CURRENT_VERSIONS[kind];
  if (!meta) throw new Error(`unknown kind: ${kind}`);
  const filepath = path.join(CONTENT_DIR, meta.file);
  const content_md = fs.readFileSync(filepath, 'utf8');
  const hash = crypto.createHash('sha256').update(content_md).digest('hex');
  const content_html = mdToHtml(content_md);
  return { ...meta, kind, content_md, content_html, hash };
}

/** Garante que a versão atual está registrada no DB. Idempotente via hash. */
async function ensureSeeded(kind) {
  const disk = loadFromDisk(kind);
  // Já tem essa versão registrada?
  const existing = await db.get(
    `SELECT id, hash FROM terms_versions WHERE kind = $1 AND version = $2`,
    [kind, disk.version]
  );
  if (existing) {
    if (existing.hash !== disk.hash) {
      // Conteúdo mudou sem bump de versão — alerta
      console.warn(`[terms] ALERTA: conteúdo de ${kind}-v${disk.version} divergiu do DB (hash mudou). ` +
                   `Crie uma nova versão (-v2.md) em vez de editar a atual.`);
    }
    return existing.id;
  }
  // Insere e marca como current (desativa anteriores)
  await db.run(`UPDATE terms_versions SET is_current = false WHERE kind = $1`, [kind]);
  const row = await db.get(
    `INSERT INTO terms_versions (kind, version, title, content_md, hash, is_current)
     VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
    [kind, disk.version, disk.title, disk.content_md, disk.hash]
  );
  return row.id;
}

/** Pega a versão corrente, com cache 5min. */
async function getCurrent(kind) {
  const cached = _cache.get(kind);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.row;

  await ensureSeeded(kind);
  const disk = loadFromDisk(kind);
  const dbRow = await db.get(
    `SELECT id, kind, version, title, hash, published_at FROM terms_versions
     WHERE kind = $1 AND is_current = true`, [kind]
  );
  const row = { ...dbRow, content_md: disk.content_md, content_html: disk.content_html };
  _cache.set(kind, { row, ts: Date.now() });
  return row;
}

/** Pega versão específica (ex: pra renderizar contrato histórico). */
async function getById(versionId) {
  return db.get(`SELECT * FROM terms_versions WHERE id = $1`, [versionId]);
}

module.exports = { getCurrent, getById, ensureSeeded, mdToHtml, CURRENT_VERSIONS };
