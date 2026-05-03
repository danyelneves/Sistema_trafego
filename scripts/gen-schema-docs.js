#!/usr/bin/env node
/**
 * scripts/gen-schema-docs.js
 *
 * Conecta no Postgres ($DATABASE_URL) e introspecta:
 *   - Tabelas + colunas (tipo, nullable, default)
 *   - Foreign keys
 *   - Índices
 *   - Tamanho de cada tabela (rowcount)
 *
 * Saída: docs/auto/SCHEMA.md
 *
 * Roda via: npm run docs:schema
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const ROOT = path.resolve(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'docs', 'auto', 'SCHEMA.md');

const Q_TABLES = `
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name;
`;

const Q_COLUMNS = `
  SELECT
    column_name, data_type, is_nullable, column_default,
    character_maximum_length, numeric_precision, numeric_scale
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = $1
  ORDER BY ordinal_position;
`;

const Q_PKEY = `
  SELECT a.attname AS column_name
  FROM pg_index i
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
  WHERE i.indrelid = ($1)::regclass AND i.indisprimary;
`;

const Q_FKEYS = `
  SELECT
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name  AS foreign_table,
    ccu.column_name AS foreign_column,
    rc.delete_rule
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
  JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name = $1;
`;

const Q_INDEXES = `
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename = $1
  ORDER BY indexname;
`;

const Q_ROWCOUNT = `SELECT COUNT(*)::int AS n FROM "%I"`;

function fmtType(col) {
  let t = col.data_type;
  if (t === 'character varying' && col.character_maximum_length) {
    t = `varchar(${col.character_maximum_length})`;
  } else if (t === 'character varying') {
    t = 'varchar';
  } else if (t === 'numeric' && col.numeric_precision) {
    t = `numeric(${col.numeric_precision},${col.numeric_scale || 0})`;
  } else if (t === 'timestamp with time zone') {
    t = 'timestamptz';
  } else if (t === 'timestamp without time zone') {
    t = 'timestamp';
  } else if (t === 'integer') {
    t = 'int';
  } else if (t === 'bigint') {
    t = 'bigint';
  } else if (t === 'boolean') {
    t = 'bool';
  }
  return t;
}

function safeIdent(name) {
  return `"${name.replace(/"/g, '""')}"`;
}

async function main() {
  const cs = process.env.DATABASE_URL;
  if (!cs) {
    console.error('DATABASE_URL não setado. Carrega o .env ou exporta a variável.');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });

  const { rows: tables } = await pool.query(Q_TABLES);
  const sections = [];
  let totalRows = 0;

  for (const { table_name } of tables) {
    const [{ rows: cols }, { rows: pk }, { rows: fks }, { rows: idx }] = await Promise.all([
      pool.query(Q_COLUMNS, [table_name]),
      pool.query(Q_PKEY, [table_name]),
      pool.query(Q_FKEYS, [table_name]),
      pool.query(Q_INDEXES, [table_name]),
    ]);

    let rowCount = '?';
    try {
      const { rows: r } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${safeIdent(table_name)}`);
      rowCount = r[0].n;
      totalRows += rowCount;
    } catch (e) { /* ignore */ }

    const pkSet = new Set(pk.map(p => p.column_name));
    const fkMap = {};
    fks.forEach(f => { fkMap[f.column_name] = f; });

    const colRows = cols.map(c => {
      const isPk = pkSet.has(c.column_name);
      const fk = fkMap[c.column_name];
      const flags = [];
      if (isPk) flags.push('🔑 PK');
      if (fk) flags.push(`🔗 → \`${fk.foreign_table}.${fk.foreign_column}\``);
      if (c.is_nullable === 'NO' && !isPk) flags.push('NOT NULL');
      const def = c.column_default ? `\`${String(c.column_default).slice(0, 50)}\`` : '';
      return `| \`${c.column_name}\` | \`${fmtType(c)}\` | ${flags.join(', ') || '—'} | ${def} |`;
    });

    const idxRows = idx
      .filter(i => !i.indexname.endsWith('_pkey'))
      .map(i => `- \`${i.indexname}\``);

    sections.push(
      `## \`${table_name}\`\n\n` +
      `**Rows:** ${rowCount.toLocaleString('pt-BR')}\n\n` +
      `### Colunas\n\n` +
      `| Coluna | Tipo | Constraints | Default |\n` +
      `|---|---|---|---|\n` +
      colRows.join('\n') + '\n\n' +
      (idxRows.length ? `### Índices\n\n${idxRows.join('\n')}\n` : '')
    );
  }

  const header = `# Database Schema — Nexus OS

> **Gerado automaticamente** por \`scripts/gen-schema-docs.js\` em ${new Date().toISOString().slice(0,16).replace('T',' ')}.
> Não edite à mão. Pra atualizar: \`npm run docs:schema\`.

**Total:** ${tables.length} tabelas, ${totalRows.toLocaleString('pt-BR')} linhas.

**Convenções:**
- 🔑 PK = primary key
- 🔗 = foreign key (com tabela de destino)
- Schema versionado em \`db/schema.sql\` (instalação inicial) + \`migrations/*.sql\` (mudanças incrementais).

`;

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, header + sections.join('\n'));
  console.log(`✓ ${OUT_FILE}`);
  console.log(`  ${tables.length} tabelas, ${totalRows.toLocaleString('pt-BR')} rows totais`);

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
