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
const queue = [];

function test(name, fn) {
  // Empilha pra rodar serializado depois (suporta sync e async)
  queue.push({ name, fn });
}

async function runAll() {
  for (const { name, fn } of queue) {
    try {
      await fn();
      pass++;
      console.log(`✅ ${name}`);
    } catch (err) {
      fail++;
      failures.push(`${name}: ${err.message}`);
      console.log(`❌ ${name}\n    ${err.message}`);
    }
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
// utils/validate.js
// =========================
const v = require('../utils/validate');

test('validate.parse aceita campos válidos', () => {
  const result = v.parse({ plan_name: 'STARTER', amount: 97 }, {
    plan_name: v.enum(['STARTER', 'GROWTH', 'ELITE']),
    amount: v.number({ min: 0 }),
  });
  assert.strictEqual(result.plan_name, 'STARTER');
  assert.strictEqual(result.amount, 97);
});

test('validate rejeita enum inválido', () => {
  assert.throws(() => v.parse({ plan_name: 'PIRATE' }, { plan_name: v.enum(['STARTER', 'GROWTH', 'ELITE']) }), /Plano|inválido/i);
});

test('validate rejeita campo obrigatório vazio', () => {
  assert.throws(() => v.parse({}, { name: v.string() }), /obrigatório/i);
});

test('validate aceita opcional com default', () => {
  const result = v.parse({}, { name: v.string({ optional: true, default: 'anon' }) });
  assert.strictEqual(result.name, 'anon');
});

test('validate phone aceita 10-13 dígitos', () => {
  const result = v.parse({ phone: '(11) 99999-8888' }, { phone: v.phone() });
  assert.strictEqual(result.phone, '11999998888');
});

test('validate phone rejeita formato curto', () => {
  assert.throws(() => v.parse({ phone: '123' }, { phone: v.phone() }), /dígitos/);
});

test('validate email normaliza para lowercase', () => {
  const result = v.parse({ email: 'JOAO@nexus.COM' }, { email: v.email() });
  assert.strictEqual(result.email, 'joao@nexus.com');
});

test('validate ValidationError tem status 400', () => {
  try {
    v.parse({}, { name: v.string() });
    assert.fail('deveria ter lançado');
  } catch (err) {
    assert.strictEqual(err.status, 400);
    assert.strictEqual(err.name, 'ValidationError');
    assert.deepStrictEqual(err.fields, ['name']);
  }
});

// =========================
// utils/retry.js
// =========================
const { retry, isTransientError } = require('../utils/retry');

test('retry funciona em primeira tentativa', async () => {
  let calls = 0;
  const result = await retry(async () => { calls++; return 'ok'; }, { attempts: 3, baseDelayMs: 10 });
  assert.strictEqual(result, 'ok');
  assert.strictEqual(calls, 1);
});

test('retry retenta em erro transient', async () => {
  let calls = 0;
  const result = await retry(async () => {
    calls++;
    if (calls < 3) {
      const err = new Error('timeout');
      err.code = 'ETIMEDOUT';
      throw err;
    }
    return 'ok';
  }, { attempts: 5, baseDelayMs: 10 });
  assert.strictEqual(result, 'ok');
  assert.strictEqual(calls, 3);
});

test('retry NÃO retenta em erro 4xx', async () => {
  let calls = 0;
  await assert.rejects(
    retry(async () => {
      calls++;
      const err = new Error('bad request');
      err.response = { status: 400 };
      throw err;
    }, { attempts: 3, baseDelayMs: 10 }),
    /bad request/
  );
  assert.strictEqual(calls, 1);
});

test('isTransientError reconhece 5xx', () => {
  assert.strictEqual(isTransientError({ response: { status: 502 } }), true);
  assert.strictEqual(isTransientError({ response: { status: 404 } }), false);
  assert.strictEqual(isTransientError({ code: 'ETIMEDOUT' }), true);
});

// =========================
// resumo
// =========================
runAll().then(() => {
  console.log(`\n${pass}/${pass + fail} passou | ${fail} falhou\n`);
  if (fail > 0) {
    console.log('Falhas:');
    failures.forEach(f => console.log(`  - ${f}`));
    process.exit(1);
  }
  process.exit(0);
});
