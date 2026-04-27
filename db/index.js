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
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn('\x1b[33m⚠  DATABASE_URL não definida — banco indisponível.\x1b[0m');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30_000,
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
function pgify(sql, params = []) {
  if (!params.length || sql.includes('$1')) return { sql, params };
  let i = 0;
  return { sql: sql.replace(/\?/g, () => `$${++i}`), params };
}

/** Executa uma query e retorna o QueryResult do pg. */
async function query(sql, params = []) {
  const { sql: s, params: p } = pgify(sql, params);
  return pool.query(s, p);
}

/** Retorna a primeira linha ou undefined. */
async function get(sql, ...params) {
  const { rows } = await query(sql, params);
  return rows[0];
}

/** Retorna todas as linhas. */
async function all(sql, ...params) {
  const { rows } = await query(sql, params);
  return rows;
}

/** Executa DML e retorna { rowCount, rows }. */
async function run(sql, ...params) {
  const result = await query(sql, params);
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
          const { sql: s, params: p } = pgify(sql, params);
          return client.query(s, p);
        },
        async get(sql, ...params) {
          const { sql: s, params: p } = pgify(sql, params);
          const { rows } = await client.query(s, p);
          return rows[0];
        },
        async all(sql, ...params) {
          const { sql: s, params: p } = pgify(sql, params);
          const { rows } = await client.query(s, p);
          return rows;
        },
        async run(sql, ...params) {
          const { sql: s, params: p } = pgify(sql, params);
          const result = await client.query(s, p);
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
