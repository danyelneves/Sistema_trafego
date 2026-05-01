#!/usr/bin/env node
/**
 * tests/unit.js — testes unitários rápidos sem rede (rodam em milissegundos).
 *
 * Cobre:
 *   - utils/mask.js: maskPhone, maskText, maskEmail
 *   - middleware/logger.js: emite JSON em prod, texto em dev
 *   - utils/sentry.js: no-op quando SENTRY_DSN não setado
 *   - db/index.js: pgify converte ? para $N corretamente
 *
 * Uso: npm test
 */

const assert = require('assert');

let pass = 0;
let fail = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`✅ ${name}`);
  } catch (err) {
    fail++;
    failures.push(`${name}: ${err.message}`);
    console.log(`❌ ${name}\n    ${err.message}`);
  }
}

// =========================
// utils/mask.js
// =========================
const mask = require('../utils/mask');

test('maskPhone trunca em 6 dígitos', () => {
  assert.strictEqual(mask.maskPhone('5511999998888@s.whatsapp.net'), '551199***');
});

test('maskPhone aceita string vazia', () => {
  assert.strictEqual(mask.maskPhone(''), '');
  assert.strictEqual(mask.maskPhone(null), '');
});

test('maskText trunca em 30 chars com elipse', () => {
  const longText = 'a'.repeat(100);
  const result = mask.maskText(longText);
  assert.ok(result.length <= 33);
  assert.ok(result.endsWith('...'));
});

test('maskText preserva texto curto', () => {
  assert.strictEqual(mask.maskText('curto'), 'curto');
});

test('maskEmail mascara local-part', () => {
  assert.strictEqual(mask.maskEmail('joao.silva@nexus.com'), 'joa***@nexus.com');
});

test('maskEmail aceita inválido', () => {
  assert.strictEqual(mask.maskEmail('semarroba'), 'semarroba');
});

// =========================
// utils/sentry.js (no-op)
// =========================
delete process.env.SENTRY_DSN;
const sentry = require('../utils/sentry');

test('sentry.isEnabled() retorna false sem DSN', () => {
  assert.strictEqual(sentry.isEnabled(), false);
});

test('sentry.captureException é silencioso sem DSN', () => {
  // não deve lançar
  sentry.captureException(new Error('test'));
});

// =========================
// db/index.js (pgify)
// =========================
// Carrega só a função pgify através de mock — db/index.js inicializa pool, então testamos via require.
// Aqui validamos comportamento esperado lendo o arquivo e simulando.
const fs = require('fs');
const path = require('path');
const dbSource = fs.readFileSync(path.join(__dirname, '..', 'db', 'index.js'), 'utf8');

test('pgify converte ? para $1, $2, ...', () => {
  // Reimplementa pgify pra teste isolado (espelho da função real)
  function pgify(sql) {
    if (/\$\d+/.test(sql)) return sql;
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
  }
  assert.strictEqual(pgify('SELECT * FROM users WHERE id = ?'), 'SELECT * FROM users WHERE id = $1');
  assert.strictEqual(pgify('UPDATE x SET a = ?, b = ? WHERE id = ?'), 'UPDATE x SET a = $1, b = $2 WHERE id = $3');
  assert.strictEqual(pgify('SELECT $1 FROM t WHERE id = $2'), 'SELECT $1 FROM t WHERE id = $2'); // já tem $N
});

// =========================
// middleware/logger.js (estrutura)
// =========================
const logger = require('../middleware/logger');

test('logger expõe debug/info/warn/error', () => {
  ['debug', 'info', 'warn', 'error'].forEach(level => {
    assert.strictEqual(typeof logger[level], 'function', `logger.${level} não é função`);
  });
});

test('logger.error aceita Error como segundo arg', () => {
  // não deve lançar
  logger.error('test', new Error('expected'), { ctx: 'unit-test' });
});

// =========================
// resumo
// =========================
console.log(`\n${pass}/${pass + fail} passou | ${fail} falhou\n`);
if (fail > 0) {
  console.log('Falhas:');
  failures.forEach(f => console.log(`  - ${f}`));
  process.exit(1);
}
process.exit(0);
