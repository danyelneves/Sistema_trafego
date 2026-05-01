/**
 * routes/health.js — health checks granulares para uptime monitoring e debug.
 *
 * Endpoints:
 *  GET /api/health           → liveness check (sempre 200 se o lambda subiu)
 *  GET /api/health/ready     → readiness: agrega checks de todas as dependências
 *  GET /api/health/db        → tenta SELECT 1 no Postgres
 *  GET /api/health/redis     → tenta PING no Upstash Redis
 *  GET /api/health/mp        → confere se MP_WEBHOOK_SECRET e workspace_settings têm token
 *
 * Usado por:
 *  - UptimeRobot ou similar (bate /api/health/ready a cada 5min)
 *  - Você manualmente quando algo dá errado, pra isolar a falha
 */
const express = require('express');
const router = express.Router();
const log = require('../middleware/logger');

const START_TS = Date.now();

router.get('/', (req, res) => {
  res.json({
    ok: true,
    ts: Date.now(),
    uptime_ms: Date.now() - START_TS,
    node: process.version,
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    region: process.env.VERCEL_REGION || undefined,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || undefined,
  });
});

router.get('/db', async (_req, res) => {
  const t0 = Date.now();
  try {
    const db = require('../db');
    const row = await Promise.race([
      db.get('SELECT 1 AS ok'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout 3s')), 3000)),
    ]);
    res.json({ ok: !!row, latency_ms: Date.now() - t0 });
  } catch (err) {
    log.error('health.db falhou', err, { check: 'db' });
    res.status(503).json({ ok: false, error: err.message, latency_ms: Date.now() - t0 });
  }
});

router.get('/redis', async (_req, res) => {
  const t0 = Date.now();
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return res.status(200).json({ ok: false, configured: false, error: 'UPSTASH env vars não definidas' });
  }
  try {
    const { Redis } = require('@upstash/redis');
    const redis = Redis.fromEnv();
    const result = await Promise.race([
      redis.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout 3s')), 3000)),
    ]);
    res.json({ ok: result === 'PONG', configured: true, latency_ms: Date.now() - t0 });
  } catch (err) {
    log.error('health.redis falhou', err, { check: 'redis' });
    res.status(503).json({ ok: false, configured: true, error: err.message, latency_ms: Date.now() - t0 });
  }
});

router.get('/mp', async (_req, res) => {
  try {
    const db = require('../db');
    const settings = await db.all("SELECT key, value FROM workspace_settings WHERE workspace_id = 1 AND key IN ('mercadopago.accessToken')");
    const ownerToken = settings.find(s => s.key === 'mercadopago.accessToken')?.value;
    res.json({
      ok: !!(process.env.MP_WEBHOOK_SECRET && process.env.MP_COLLECTOR_ID && ownerToken && ownerToken.startsWith('APP_USR')),
      hmac_secret_configured: !!process.env.MP_WEBHOOK_SECRET,
      collector_id_configured: !!process.env.MP_COLLECTOR_ID,
      owner_token_configured: !!ownerToken && ownerToken.startsWith('APP_USR'),
    });
  } catch (err) {
    log.error('health.mp falhou', err, { check: 'mp' });
    res.status(503).json({ ok: false, error: err.message });
  }
});

router.get('/ready', async (_req, res) => {
  const checks = { db: null, redis: null, mp: null };
  const t0 = Date.now();

  // Roda em paralelo, com timeout individual
  const [dbRes, redisRes, mpRes] = await Promise.allSettled([
    (async () => {
      const db = require('../db');
      return Promise.race([
        db.get('SELECT 1'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ]);
    })(),
    (async () => {
      if (!process.env.UPSTASH_REDIS_REST_URL) return 'not-configured';
      const { Redis } = require('@upstash/redis');
      return Promise.race([
        Redis.fromEnv().ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ]);
    })(),
    (async () => {
      return !!(process.env.MP_WEBHOOK_SECRET && process.env.MP_COLLECTOR_ID);
    })(),
  ]);

  checks.db = dbRes.status === 'fulfilled' ? 'ok' : `fail: ${dbRes.reason?.message || 'unknown'}`;
  checks.redis = redisRes.status === 'fulfilled' ? (redisRes.value === 'not-configured' ? 'not-configured' : 'ok') : `fail: ${redisRes.reason?.message || 'unknown'}`;
  checks.mp = mpRes.status === 'fulfilled' && mpRes.value ? 'ok' : 'not-configured';

  const allCriticalOk = checks.db === 'ok'; // DB é crítico; Redis e MP são "soft"
  res.status(allCriticalOk ? 200 : 503).json({
    ok: allCriticalOk,
    checks,
    latency_ms: Date.now() - t0,
    ts: Date.now(),
  });
});

module.exports = router;
