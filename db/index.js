/**
 * db/index.js — conexão com PostgreSQL (Supabase) via pool de conexões.
 *
 * API compatível com o padrão usado nos routes:
 *   db.get(sql, ...params)  → Promise<row | undefined>
 *   db.all(sql, ...params)  → Promise<row[]>
 *   db.run(sql, ...params)  → Promise<{ rowCount, rows }>
 *   db.query(sql, params[]) → Promise<QueryResult>  (baixo nível)
 *   db.transaction(fn)      → async fn wrapper com BEGIN/COMMIT/ROLLBACK
 */

require('dotenv').config();
/*
 * OBSERVAÇÃO DE SERVERLESS (VERCEL):
 * Configure a variável DATABASE_URL com o Transaction Pooler do Supabase (porta 6543).
 * Exemplo: postgres://postgres.[ref]:[senha]@aws-0-[regiao].pooler.supabase.com:6543/postgres
 */
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn('⚠ Aviso: DATABASE_URL não definida.');
} else if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL.includes(':6543')) {
  console.warn('⚠ AVISO [DB]: Em produção é ALTAMENTE recomendado usar o transaction pooler do Supabase (porta 6543).');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
  max: 1,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('[DB] pool error:', err.message);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converte placeholders SQLite (?) para PostgreSQL ($1, $2...).
 * Se o sql já contém $1 não faz nada.
 */
function pgify(sql) {
  if (/\$\d+/.test(sql)) return sql;
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/** Executa uma query e retorna o QueryResult do pg. */
async function query(sql, params = []) {
  return pool.query(pgify(sql), params);
}

/** Retorna a primeira linha ou undefined. */
async function get(sql, ...params) {
  const { rows } = await pool.query(pgify(sql), params);
  return rows[0];
}

/** Retorna todas as linhas. */
async function all(sql, ...params) {
  const { rows } = await pool.query(pgify(sql), params);
  return rows;
}

/** Executa DML e retorna { rowCount, rows }. */
async function run(sql, ...params) {
  const result = await pool.query(pgify(sql), params);
  return { rowCount: result.rowCount, rows: result.rows };
}

/**
 * transaction(fn) — executa fn(client) dentro de BEGIN/COMMIT.
 * fn recebe um objeto {get, all, run, query} ligado ao client único.
 */
function transaction(fn) {
  return async (...args) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const clientDb = {
        async query(sql, params = []) {
          return client.query(pgify(sql), params);
        },
        async get(sql, ...params) {
          const { rows } = await client.query(pgify(sql), params);
          return rows[0];
        },
        async all(sql, ...params) {
          const { rows } = await client.query(pgify(sql), params);
          return rows;
        },
        async run(sql, ...params) {
          const result = await client.query(pgify(sql), params);
          return { rowCount: result.rowCount, rows: result.rows };
        },
      };
      const result = await fn(clientDb, ...args);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  };
}

module.exports = { query, get, all, run, transaction, pool };
