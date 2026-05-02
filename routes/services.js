/**
 * routes/services.js — agregador de status de serviços externos.
 *
 * Endpoints (todos cacheados por 30s para não inundar APIs externas):
 *   GET /api/services/all          → todos juntos
 *   GET /api/services/vercel       → último deploy, status, region, build time
 *   GET /api/services/supabase     → status DB, tamanho, # de tabelas
 *   GET /api/services/redis        → ping Upstash, latência
 *   GET /api/services/mp           → config MP, saldo (se token tiver scope)
 *   GET /api/services/sentry       → issues abertas, eventos 7d, taxa erro
 *   GET /api/services/uptimerobot  → uptime % e response time do monitor
 *   GET /api/services/github       → último commit, PRs abertos
 *
 * Resposta padrão de cada serviço:
 *   {
 *     ok: bool,           // tudo verde?
 *     status: 'up'|'warn'|'down'|'not-configured',
 *     metrics: { ... },   // métricas específicas
 *     dashboard_url: '',  // link pro painel oficial pra abrir num clique
 *     latency_ms: 123,    // quanto demorou pra responder
 *     error?: '...'       // se ok=false, motivo
 *   }
 */
const express = require('express');
const router = express.Router();
const log = require('../middleware/logger');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// ─── Cache simples in-memory (30s) ────────────────────────────
const cache = new Map();
const CACHE_TTL_MS = 30_000;

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key, value) {
  cache.set(key, { ts: Date.now(), value });
  return value;
}

async function withTimeout(promise, ms = 5000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms)),
  ]);
}

async function fetchJson(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    let body;
    try { body = text ? JSON.parse(text) : null; }
    catch { body = { raw: text.slice(0, 500) }; }
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

// ─── 1. Vercel ────────────────────────────────────────────────
async function getVercel() {
  const cached = getCached('vercel');
  if (cached) return cached;

  const t0 = Date.now();
  const token = process.env.VERCEL_API_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const dashboard_url = `https://vercel.com/maranet/nexus-os`;

  if (!token || !projectId) {
    return setCached('vercel', { ok: false, status: 'not-configured', dashboard_url, error: 'VERCEL_API_TOKEN ou VERCEL_PROJECT_ID não setado' });
  }

  try {
    const url = `https://api.vercel.com/v6/deployments?projectId=${projectId}&teamId=${teamId}&limit=1`;
    const { ok, body } = await fetchJson(url, { headers: { Authorization: `Bearer ${token}` } });

    if (!ok || !body?.deployments?.length) {
      return setCached('vercel', { ok: false, status: 'down', dashboard_url, latency_ms: Date.now() - t0, error: 'sem deployments ou auth falhou' });
    }

    const dep = body.deployments[0];
    const state = dep.state || dep.readyState;
    const status = state === 'READY' ? 'up' : (state === 'ERROR' ? 'down' : 'warn');

    const result = {
      ok: status === 'up',
      status,
      latency_ms: Date.now() - t0,
      dashboard_url,
      metrics: {
        last_deploy: {
          state,
          branch: dep.meta?.githubCommitRef || 'unknown',
          commit: (dep.meta?.githubCommitSha || '').slice(0, 7),
          created_at: new Date(dep.created).toISOString(),
          url: `https://${dep.url}`,
        },
      },
    };
    return setCached('vercel', result);
  } catch (err) {
    log.error('services.vercel falhou', err);
    return setCached('vercel', { ok: false, status: 'down', dashboard_url, latency_ms: Date.now() - t0, error: err.message });
  }
}

// ─── 2. Supabase (via DB direta + tamanho aproximado) ─────────
async function getSupabase() {
  const cached = getCached('supabase');
  if (cached) return cached;

  const t0 = Date.now();
  const dashboard_url = `https://supabase.com/dashboard/project/tnmxoavqcuirsceefqed`;

  try {
    const db = require('../db');
    const [tablesRow, sizeRow] = await Promise.all([
      withTimeout(db.get(`SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = 'public'`)),
      withTimeout(db.get(`SELECT pg_size_pretty(pg_database_size(current_database())) AS size, pg_database_size(current_database()) AS bytes`)),
    ]);

    const result = {
      ok: true,
      status: 'up',
      latency_ms: Date.now() - t0,
      dashboard_url,
      metrics: {
        tables_count: Number(tablesRow.c),
        db_size: sizeRow.size,
        db_size_bytes: Number(sizeRow.bytes),
        free_tier_limit_gb: 0.5, // 500MB
        free_tier_used_pct: Math.round((Number(sizeRow.bytes) / (500 * 1024 * 1024)) * 100),
      },
    };
    return setCached('supabase', result);
  } catch (err) {
    log.error('services.supabase falhou', err);
    return setCached('supabase', { ok: false, status: 'down', dashboard_url, latency_ms: Date.now() - t0, error: err.message });
  }
}

// ─── 3. Upstash Redis ─────────────────────────────────────────
async function getRedis() {
  const cached = getCached('redis');
  if (cached) return cached;

  const t0 = Date.now();
  const dashboard_url = 'https://console.upstash.com/redis';

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return setCached('redis', { ok: false, status: 'not-configured', dashboard_url, error: 'UPSTASH env vars não setadas' });
  }

  try {
    const { Redis } = require('@upstash/redis');
    const redis = Redis.fromEnv();
    const pingResult = await withTimeout(redis.ping(), 3000);
    // Tenta INFO pra pegar memory (pode não ter permissão)
    let memory = null;
    try {
      const info = await withTimeout(redis.info(), 2000);
      const memMatch = (info || '').match(/used_memory_human:([^\r\n]+)/);
      if (memMatch) memory = memMatch[1].trim();
    } catch { /* INFO pode não estar disponível, tudo bem */ }

    const result = {
      ok: pingResult === 'PONG',
      status: pingResult === 'PONG' ? 'up' : 'warn',
      latency_ms: Date.now() - t0,
      dashboard_url,
      metrics: {
        ping: pingResult,
        memory_used: memory || 'N/D',
      },
    };
    return setCached('redis', result);
  } catch (err) {
    log.error('services.redis falhou', err);
    return setCached('redis', { ok: false, status: 'down', dashboard_url, latency_ms: Date.now() - t0, error: err.message });
  }
}

// ─── 4. Mercado Pago ──────────────────────────────────────────
async function getMercadoPago() {
  const cached = getCached('mp');
  if (cached) return cached;

  const t0 = Date.now();
  const dashboard_url = 'https://www.mercadopago.com.br/developers/panel/app';

  try {
    const db = require('../db');
    const settings = await withTimeout(
      db.all("SELECT key, value FROM workspace_settings WHERE workspace_id = 1 AND key = 'mercadopago.accessToken'")
    );
    const ownerToken = settings.find(s => s.key === 'mercadopago.accessToken')?.value;

    const hmacOk = !!process.env.MP_WEBHOOK_SECRET;
    const collectorOk = !!process.env.MP_COLLECTOR_ID;
    const tokenOk = !!ownerToken && ownerToken.startsWith('APP_USR');

    let lastPayment = null;
    if (tokenOk) {
      try {
        const { ok, body } = await fetchJson(
          'https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=1',
          { headers: { Authorization: `Bearer ${ownerToken}` } },
          4000
        );
        if (ok && body?.results?.length) {
          const p = body.results[0];
          lastPayment = {
            id: p.id,
            status: p.status,
            amount: p.transaction_amount,
            currency: p.currency_id,
            date: p.date_created,
          };
        }
      } catch { /* api do MP pode ter rate limit, tudo bem */ }
    }

    const allOk = hmacOk && collectorOk && tokenOk;
    const result = {
      ok: allOk,
      status: allOk ? 'up' : (tokenOk ? 'warn' : 'not-configured'),
      latency_ms: Date.now() - t0,
      dashboard_url,
      metrics: {
        hmac_secret_configured: hmacOk,
        collector_id_configured: collectorOk,
        owner_token_configured: tokenOk,
        last_payment: lastPayment,
      },
    };
    return setCached('mp', result);
  } catch (err) {
    log.error('services.mp falhou', err);
    return setCached('mp', { ok: false, status: 'down', dashboard_url, latency_ms: Date.now() - t0, error: err.message });
  }
}

// ─── 5. Sentry ────────────────────────────────────────────────
async function getSentry() {
  const cached = getCached('sentry');
  if (cached) return cached;

  const t0 = Date.now();
  const token = process.env.SENTRY_AUTH_TOKEN;
  const orgSlug = process.env.SENTRY_ORG_SLUG || 'maranet-telecom';
  const projectSlug = process.env.SENTRY_PROJECT_SLUG || 'nexus-os';
  const dashboard_url = `https://sentry.io/organizations/${orgSlug}/issues/`;

  if (!token) {
    return setCached('sentry', { ok: false, status: 'not-configured', dashboard_url, error: 'SENTRY_AUTH_TOKEN não setado' });
  }

  try {
    const headers = { Authorization: `Bearer ${token}` };
    const [issuesRes, statsRes] = await Promise.all([
      fetchJson(`https://sentry.io/api/0/projects/${orgSlug}/${projectSlug}/issues/?statsPeriod=24h&limit=10`, { headers }, 5000),
      fetchJson(`https://sentry.io/api/0/organizations/${orgSlug}/stats_v2/?statsPeriod=7d&interval=1d&field=sum(quantity)&category=error`, { headers }, 5000),
    ]);

    const issues = Array.isArray(issuesRes.body) ? issuesRes.body : [];
    const events_7d = (statsRes.body?.groups || []).reduce((sum, g) => sum + (g.totals?.['sum(quantity)'] || 0), 0);
    const open_issues = issues.length;
    const status = open_issues > 10 ? 'warn' : 'up';

    const result = {
      ok: true,
      status,
      latency_ms: Date.now() - t0,
      dashboard_url,
      metrics: {
        open_issues_24h: open_issues,
        events_7d,
        top_issues: issues.slice(0, 3).map(i => ({
          title: (i.title || '').slice(0, 70),
          level: i.level,
          count: Number(i.count) || 0,
          first_seen: i.firstSeen,
          link: i.permalink,
        })),
      },
    };
    return setCached('sentry', result);
  } catch (err) {
    log.error('services.sentry falhou', err);
    return setCached('sentry', { ok: false, status: 'down', dashboard_url, latency_ms: Date.now() - t0, error: err.message });
  }
}

// ─── 6. UptimeRobot ───────────────────────────────────────────
async function getUptimeRobot() {
  const cached = getCached('uptimerobot');
  if (cached) return cached;

  const t0 = Date.now();
  const apiKey = process.env.UPTIMEROBOT_API_KEY;
  const dashboard_url = 'https://uptimerobot.com/dashboard';

  if (!apiKey) {
    return setCached('uptimerobot', { ok: false, status: 'not-configured', dashboard_url, error: 'UPTIMEROBOT_API_KEY não setado' });
  }

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      format: 'json',
      response_times: '1',
      response_times_average: '60',
      custom_uptime_ratios: '1-7-30',
    }).toString();

    const { ok, body } = await fetchJson(
      'https://api.uptimerobot.com/v2/getMonitors',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      },
      5000
    );

    if (!ok || body?.stat !== 'ok') {
      return setCached('uptimerobot', { ok: false, status: 'down', dashboard_url, latency_ms: Date.now() - t0, error: 'API retornou erro' });
    }

    const monitors = (body.monitors || []).map(m => {
      const statusMap = { 0: 'paused', 1: 'not-checked', 2: 'up', 8: 'seems-down', 9: 'down' };
      const ratios = (m.custom_uptime_ratio || '').split('-');
      return {
        name: m.friendly_name,
        url: m.url,
        status: statusMap[m.status] || 'unknown',
        uptime_24h: ratios[0] ? Number(ratios[0]) : null,
        uptime_7d: ratios[1] ? Number(ratios[1]) : null,
        uptime_30d: ratios[2] ? Number(ratios[2]) : null,
        avg_response_ms: m.average_response_time ? Number(m.average_response_time) : null,
      };
    });

    const allUp = monitors.every(m => m.status === 'up');
    const result = {
      ok: allUp,
      status: allUp ? 'up' : 'warn',
      latency_ms: Date.now() - t0,
      dashboard_url,
      metrics: {
        monitors_count: monitors.length,
        monitors,
      },
    };
    return setCached('uptimerobot', result);
  } catch (err) {
    log.error('services.uptimerobot falhou', err);
    return setCached('uptimerobot', { ok: false, status: 'down', dashboard_url, latency_ms: Date.now() - t0, error: err.message });
  }
}

// ─── 7. GitHub (sem token via API pública) ────────────────────
async function getGithub() {
  const cached = getCached('github');
  if (cached) return cached;

  const t0 = Date.now();
  const owner = 'danyelneves';
  const repo = 'nexus-os';
  const dashboard_url = `https://github.com/${owner}/${repo}`;

  try {
    const headers = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
    const [commitRes, prsRes] = await Promise.all([
      fetchJson(`https://api.github.com/repos/${owner}/${repo}/commits/main`, { headers }, 4000),
      fetchJson(`https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=5`, { headers }, 4000),
    ]);

    if (!commitRes.ok) {
      return setCached('github', { ok: false, status: 'down', dashboard_url, latency_ms: Date.now() - t0, error: 'falha ao buscar último commit' });
    }

    const commit = commitRes.body;
    const prs = Array.isArray(prsRes.body) ? prsRes.body : [];

    const result = {
      ok: true,
      status: 'up',
      latency_ms: Date.now() - t0,
      dashboard_url,
      metrics: {
        last_commit: {
          sha: (commit.sha || '').slice(0, 7),
          message: (commit.commit?.message || '').split('\n')[0].slice(0, 70),
          author: commit.commit?.author?.name,
          date: commit.commit?.author?.date,
          url: commit.html_url,
        },
        open_prs: prs.length,
        prs: prs.slice(0, 5).map(p => ({
          number: p.number,
          title: p.title.slice(0, 60),
          author: p.user?.login,
          url: p.html_url,
        })),
      },
    };
    return setCached('github', result);
  } catch (err) {
    log.error('services.github falhou', err);
    return setCached('github', { ok: false, status: 'down', dashboard_url, latency_ms: Date.now() - t0, error: err.message });
  }
}

// ─── Endpoints ────────────────────────────────────────────────
router.get('/all', requireAuth, requireAdmin, async (_req, res) => {
  const [vercel, supabase, redis, mp, sentry, uptimerobot, github] = await Promise.allSettled([
    getVercel(), getSupabase(), getRedis(), getMercadoPago(), getSentry(), getUptimeRobot(), getGithub(),
  ]);
  const get = r => (r.status === 'fulfilled' ? r.value : { ok: false, status: 'down', error: r.reason?.message });
  res.json({
    ts: Date.now(),
    services: {
      vercel: get(vercel),
      supabase: get(supabase),
      redis: get(redis),
      mercadopago: get(mp),
      sentry: get(sentry),
      uptimerobot: get(uptimerobot),
      github: get(github),
    },
  });
});

router.get('/vercel', requireAuth, requireAdmin, async (_req, res) => res.json(await getVercel()));
router.get('/supabase', requireAuth, requireAdmin, async (_req, res) => res.json(await getSupabase()));
router.get('/redis', requireAuth, requireAdmin, async (_req, res) => res.json(await getRedis()));
router.get('/mp', requireAuth, requireAdmin, async (_req, res) => res.json(await getMercadoPago()));
router.get('/sentry', requireAuth, requireAdmin, async (_req, res) => res.json(await getSentry()));
router.get('/uptimerobot', requireAuth, requireAdmin, async (_req, res) => res.json(await getUptimeRobot()));
router.get('/github', requireAuth, requireAdmin, async (_req, res) => res.json(await getGithub()));

module.exports = router;
