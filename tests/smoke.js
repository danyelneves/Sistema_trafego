#!/usr/bin/env node
/**
 * tests/smoke.js — bateria de smoke tests para rodar contra produção/preview.
 *
 * Uso:
 *   DOMAIN=https://nexusagencia.app node tests/smoke.js
 *   DOMAIN=https://preview.vercel.app BYPASS_TOKEN=xxx node tests/smoke.js
 *
 * Cobre:
 *   - Health endpoint
 *   - HMAC do Mercado Pago bloqueia request sem assinatura
 *   - Token do WhatsApp bloqueia token inválido
 *   - Kiwify bloqueia request sem secret configurado
 *   - Billing exige autenticação
 *   - Brute force: 11ª tentativa deve retornar 429 (Upstash)
 *   - Headers globais de segurança presentes
 *   - /f/:slug responde sem erro 5xx
 *
 * Saída: exit 0 se todos passarem, exit 1 se algum falhou (CI-ready).
 */

const DOMAIN = process.env.DOMAIN || 'https://nexusagencia.app';
const BYPASS_TOKEN = process.env.BYPASS_TOKEN || ''; // x-vercel-protection-bypass para preview deploys
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 12000);

const baseHeaders = BYPASS_TOKEN ? { 'x-vercel-protection-bypass': BYPASS_TOKEN } : {};

let pass = 0;
let fail = 0;
const failures = [];

function emoji(ok) { return ok ? '✅' : '❌'; }

function check(name, ok, extra = '') {
  if (ok) pass++;
  else {
    fail++;
    failures.push(name);
  }
  console.log(`${emoji(ok)} ${name}${extra ? ' ' + extra : ''}`);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal, headers: { ...baseHeaders, ...(options.headers || {}) } });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function test1_health() {
  const res = await fetchWithTimeout(`${DOMAIN}/api/health`);
  const body = await res.json().catch(() => ({}));
  check('1. Health endpoint responde 200', res.status === 200 && body.ok === true, `(status=${res.status})`);
}

async function test2_mp_no_signature() {
  const res = await fetchWithTimeout(`${DOMAIN}/api/webhook/mercadopago?topic=payment&id=999`, { method: 'POST' });
  check('2. MP webhook bloqueia sem assinatura HMAC', res.status === 401, `(status=${res.status})`);
}

async function test3_whatsapp_invalid_token() {
  const kid = `smoke-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const res = await fetchWithTimeout(`${DOMAIN}/api/webhook/whatsapp/token-invalido-${Math.random().toString(36).slice(2)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        key: { remoteJid: '5511888888888@s.whatsapp.net', id: kid, fromMe: false },
        message: { conversation: 'smoke test' },
      },
    }),
  });
  check('3. WhatsApp rejeita token inválido', res.status === 401, `(status=${res.status})`);
}

async function test4_kiwify_no_secret() {
  const res = await fetchWithTimeout(`${DOMAIN}/api/webhooks/kiwify/1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: `smoke-${Date.now()}` }),
  });
  check('4. Kiwify bloqueia workspace sem secret', res.status === 401, `(status=${res.status})`);
}

async function test5_billing_requires_auth() {
  const res = await fetchWithTimeout(`${DOMAIN}/api/billing/upgrade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan_name: 'PIRATE' }),
  });
  check('5. Billing /upgrade exige autenticação', res.status === 401, `(status=${res.status})`);
}

async function test6_brute_force_blocked() {
  // Usa um IP fake único pra evitar acumular com chamadas anteriores
  const fakeIp = `192.0.2.${Math.floor(Math.random() * 255)}`;
  let lastStatus = 0;
  for (let i = 1; i <= 11; i++) {
    const res = await fetchWithTimeout(`${DOMAIN}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': fakeIp },
      body: JSON.stringify({ username: 'admin', password: 'errada-smoke' }),
    });
    if (i === 11) lastStatus = res.status;
  }
  check('6. Brute force bloqueado na 11ª tentativa (Upstash)', lastStatus === 429, `(status=${lastStatus})`);
}

async function test7_security_headers() {
  const res = await fetchWithTimeout(`${DOMAIN}/api/health`);
  const required = ['x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy'];
  const missing = required.filter(h => !res.headers.get(h));
  check('7. Headers de segurança globais presentes', missing.length === 0, missing.length ? `(faltando: ${missing.join(',')})` : '(4/4)');
}

async function test8_funnel_no_5xx() {
  const res = await fetchWithTimeout(`${DOMAIN}/f/teste-inexistente-${Date.now()}`);
  check('8. /f/:slug responde sem 5xx', res.status < 500, `(status=${res.status})`);
}

async function main() {
  console.log(`\n  Smoke tests contra: ${DOMAIN}`);
  console.log(`  Bypass token: ${BYPASS_TOKEN ? 'configurado' : 'não'}`);
  console.log(`  ----------------------------------------`);

  const tests = [test1_health, test2_mp_no_signature, test3_whatsapp_invalid_token, test4_kiwify_no_secret, test5_billing_requires_auth, test6_brute_force_blocked, test7_security_headers, test8_funnel_no_5xx];

  for (const t of tests) {
    try {
      await t();
    } catch (err) {
      check(`${t.name} (exception)`, false, `(${err.message})`);
    }
  }

  console.log(`  ----------------------------------------`);
  console.log(`  ${pass}/8 passou | ${fail} falhou\n`);
  if (fail > 0) {
    console.log(`  Falhas: ${failures.join(', ')}\n`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch(err => {
  console.error(`Fatal: ${err.message}`);
  process.exit(2);
});
