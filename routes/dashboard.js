/**
 * routes/dashboard.js — agregadores que alimentam o Command Center.
 *
 * Endpoints (todos requereAuth, escopo workspace do usuário):
 *   GET /api/dashboard/metrics-today    → receita, vendas, leads, ROAS de hoje
 *   GET /api/dashboard/agents-status    → status dos agentes IA principais
 *   GET /api/dashboard/pending-actions  → ações pendentes que esperam decisão humana
 *   GET /api/dashboard/recent-activity  → timeline das últimas 24h
 *
 * Princípios:
 *   - Tudo via SQL agregado (1 query por endpoint quando possível)
 *   - Tratamento gracioso quando workspace não tem dados (pré-revenue)
 *   - Cache 60s pra evitar pressão no banco
 *   - Latência alvo: < 300ms
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const log = require('../middleware/logger');
const { requireAuth } = require('../middleware/auth');

// Cache simples por chave + workspace
const cache = new Map();
const CACHE_TTL_MS = 60_000;

function cacheKey(name, wsId) { return `${name}:${wsId}`; }
function getCached(key) {
  const e = cache.get(key);
  if (!e || Date.now() - e.ts > CACHE_TTL_MS) { cache.delete(key); return null; }
  return e.value;
}
function setCached(key, value) {
  cache.set(key, { ts: Date.now(), value });
  return value;
}

// ─── 1. Métricas de hoje ─────────────────────────────────────
router.get('/metrics-today', requireAuth, async (req, res, next) => {
  const wsId = req.user.workspace_id;
  const key = cacheKey('metrics-today', wsId);
  const cached = getCached(key);
  if (cached) return res.json(cached);

  try {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const [salesToday, salesYesterday, leadsToday, leadsYesterday, metricsToday] = await Promise.all([
      // Receita e # de vendas hoje
      db.get(`
        SELECT COALESCE(SUM(contract_value), 0) AS revenue, COUNT(*) AS count
        FROM sales WHERE workspace_id = $1 AND DATE(created_at) = $2
      `, [wsId, today]).catch(() => ({ revenue: 0, count: 0 })),

      // Receita e # de vendas ontem
      db.get(`
        SELECT COALESCE(SUM(contract_value), 0) AS revenue, COUNT(*) AS count
        FROM sales WHERE workspace_id = $1 AND DATE(created_at) = $2
      `, [wsId, yesterday]).catch(() => ({ revenue: 0, count: 0 })),

      // Leads novos hoje (via pixel_events de tipo lead)
      db.get(`
        SELECT COUNT(*) AS count
        FROM pixel_events WHERE workspace_id = $1 AND DATE(created_at) = $2
        AND event_type IN ('lead', 'subscribe', 'contact')
      `, [wsId, today]).catch(() => ({ count: 0 })),

      // Leads novos ontem
      db.get(`
        SELECT COUNT(*) AS count
        FROM pixel_events WHERE workspace_id = $1 AND DATE(created_at) = $2
        AND event_type IN ('lead', 'subscribe', 'contact')
      `, [wsId, yesterday]).catch(() => ({ count: 0 })),

      // ROAS hoje (receita / spend agregado das campanhas do workspace)
      db.get(`
        SELECT COALESCE(SUM(md.revenue), 0) AS revenue,
               COALESCE(SUM(md.spend), 0) AS spend
        FROM metrics_daily md
        JOIN campaigns c ON c.id = md.campaign_id
        WHERE c.workspace_id = $1 AND md.date = $2
      `, [wsId, today]).catch(() => ({ revenue: 0, spend: 0 })),
    ]);

    const revToday = Number(salesToday.revenue) || 0;
    const revYesterday = Number(salesYesterday.revenue) || 0;
    const countToday = Number(salesToday.count) || 0;
    const countYesterday = Number(salesYesterday.count) || 0;
    const leadsTodayN = Number(leadsToday.count) || 0;
    const leadsYesterdayN = Number(leadsYesterday.count) || 0;
    const adRevenue = Number(metricsToday.revenue) || 0;
    const adSpend = Number(metricsToday.spend) || 0;
    const roasToday = adSpend > 0 ? adRevenue / adSpend : 0;

    function pctChange(today, yesterday) {
      if (yesterday === 0) return today > 0 ? 100 : 0;
      return Math.round(((today - yesterday) / yesterday) * 100);
    }

    const result = {
      ts: Date.now(),
      workspace_id: wsId,
      revenue: {
        today: revToday,
        yesterday: revYesterday,
        change_pct: pctChange(revToday, revYesterday),
      },
      sales: {
        today: countToday,
        yesterday: countYesterday,
        change_pct: pctChange(countToday, countYesterday),
      },
      leads: {
        today: leadsTodayN,
        yesterday: leadsYesterdayN,
        change_pct: pctChange(leadsTodayN, leadsYesterdayN),
      },
      roas: {
        today: roasToday,
        ad_revenue: adRevenue,
        ad_spend: adSpend,
      },
    };
    return res.json(setCached(key, result));
  } catch (err) {
    log.error('dashboard.metrics-today falhou', err);
    next(err);
  }
});

// ─── 2. Status dos agentes IA ────────────────────────────────
router.get('/agents-status', requireAuth, async (req, res, next) => {
  const wsId = req.user.workspace_id;
  const key = cacheKey('agents-status', wsId);
  const cached = getCached(key);
  if (cached) return res.json(cached);

  try {
    const today = new Date().toISOString().slice(0, 10);

    const [settings, sentinelActions, skynetLeads, doppelConvs, lazarusRecover] = await Promise.all([
      // Toggles dos agentes (workspace_settings)
      db.all(`
        SELECT key, value FROM workspace_settings
        WHERE workspace_id = $1 AND key LIKE 'toggle.%'
      `, [wsId]).catch(() => []),

      // Sentinel: # de ações registradas no log de alertas hoje (se tabela existe)
      db.get(`
        SELECT COUNT(*) AS count FROM alert_log
        WHERE workspace_id = $1 AND DATE(ts) = $2 AND module = 'sentinel'
      `, [wsId, today]).catch(() => ({ count: 0 })),

      // Skynet: # de leads adicionados ao market hoje
      db.get(`
        SELECT COUNT(*) AS count FROM market_leads
        WHERE workspace_id = $1 AND DATE(created_at) = $2
      `, [wsId, today]).catch(() => ({ count: 0 })),

      // Doppelgänger: # de mensagens WhatsApp processadas hoje (via webhook_events)
      db.get(`
        SELECT COUNT(*) AS count FROM webhook_events
        WHERE provider = 'whatsapp' AND DATE(processed_at) = $1
      `, [today]).catch(() => ({ count: 0 })),

      // Lazarus: # de pedidos com status LAZARUS_ACTIVATED hoje
      db.get(`
        SELECT COUNT(*) AS count FROM orders
        WHERE workspace_id = $1 AND status = 'LAZARUS_ACTIVATED'
        AND DATE(created_at) = $2
      `, [wsId, today]).catch(() => ({ count: 0 })),
    ]);

    const getToggle = (k) => settings.find(s => s.key === k)?.value === 'true';

    const result = {
      ts: Date.now(),
      workspace_id: wsId,
      agents: [
        {
          id: 'sentinel',
          name: 'Sentinel',
          icon: '🛡️',
          description: 'Robô trader de campanhas Meta',
          active: getToggle('toggle.sentinel'),
          today_count: Number(sentinelActions.count) || 0,
          today_label: 'ações nas últimas 24h',
          link: '/sentinel',
        },
        {
          id: 'skynet',
          name: 'Skynet',
          icon: '🎯',
          description: 'Prospecção autônoma B2B',
          active: getToggle('toggle.skynet'),
          today_count: Number(skynetLeads.count) || 0,
          today_label: 'leads prospectados hoje',
          link: '/skynet',
        },
        {
          id: 'doppelganger',
          name: 'Doppelgänger',
          icon: '🤖',
          description: 'Vendedor IA WhatsApp',
          active: getToggle('toggle.doppelganger'),
          today_count: Number(doppelConvs.count) || 0,
          today_label: 'conversas processadas hoje',
          link: '/doppelganger',
        },
        {
          id: 'lazarus',
          name: 'Lázaro',
          icon: '🧟',
          description: 'Recuperador de carrinho',
          active: getToggle('toggle.lazarus'),
          today_count: Number(lazarusRecover.count) || 0,
          today_label: 'recuperações hoje',
          link: '/lazarus',
        },
      ],
    };
    return res.json(setCached(key, result));
  } catch (err) {
    log.error('dashboard.agents-status falhou', err);
    next(err);
  }
});

// ─── 3. Ações pendentes ──────────────────────────────────────
router.get('/pending-actions', requireAuth, async (req, res, next) => {
  const wsId = req.user.workspace_id;
  const key = cacheKey('pending-actions', wsId);
  const cached = getCached(key);
  if (cached) return res.json(cached);

  try {
    const actions = [];

    // Pedidos pendentes de pagamento há mais de 10 min e menos de 2 dias
    try {
      const pendingOrders = await db.all(`
        SELECT id, total_amount, customer_name, created_at
        FROM orders
        WHERE workspace_id = $1
          AND status IN ('WAITING_PAYMENT', 'PENDING')
          AND created_at < NOW() - INTERVAL '10 minutes'
          AND created_at > NOW() - INTERVAL '2 days'
        ORDER BY created_at DESC
        LIMIT 5
      `, [wsId]);
      pendingOrders.forEach(o => {
        actions.push({
          id: `order-${o.id}`,
          icon: '💰',
          severity: 'info',
          title: `Pedido pendente de R$ ${Number(o.total_amount).toFixed(2)}`,
          subtitle: `${o.customer_name || 'Cliente'} · há ${minsAgo(o.created_at)} min`,
          action_label: 'Acionar Lázaro',
          action_url: `/lazarus?order_id=${o.id}`,
        });
      });
    } catch { /* tabela orders pode estar vazia */ }

    // Leads no marketplace sem comprador há mais de 1h
    try {
      const orphanLeads = await db.all(`
        SELECT id, lead_name, created_at FROM market_leads
        WHERE workspace_id = $1 AND status = 'available'
          AND created_at < NOW() - INTERVAL '1 hour'
        ORDER BY created_at DESC
        LIMIT 3
      `, [wsId]);
      orphanLeads.forEach(l => {
        actions.push({
          id: `lead-${l.id}`,
          icon: '🎯',
          severity: 'warn',
          title: `Lead sem comprador: ${l.lead_name || 'Anônimo'}`,
          subtitle: `Disponível há ${minsAgo(l.created_at)} min`,
          action_label: 'Ver no Market',
          action_url: `/market?lead_id=${l.id}`,
        });
      });
    } catch { /* market_leads pode estar vazia */ }

    // Alertas críticos não confirmados nas últimas 6h
    try {
      const critAlerts = await db.all(`
        SELECT id, title, ts FROM alert_log
        WHERE workspace_id = $1 AND severity = 'critical'
          AND ts > NOW() - INTERVAL '6 hours'
        ORDER BY ts DESC
        LIMIT 5
      `, [wsId]);
      critAlerts.forEach(a => {
        actions.push({
          id: `alert-${a.id}`,
          icon: '⚠️',
          severity: 'critical',
          title: a.title || 'Alerta crítico',
          subtitle: `Há ${minsAgo(a.ts)} min`,
          action_label: 'Ver alerta',
          action_url: `/alerts?id=${a.id}`,
        });
      });
    } catch { /* alert_log pode não existir ainda */ }

    const result = {
      ts: Date.now(),
      workspace_id: wsId,
      pending_count: actions.length,
      actions: actions.slice(0, 10),
    };
    return res.json(setCached(key, result));
  } catch (err) {
    log.error('dashboard.pending-actions falhou', err);
    next(err);
  }
});

// ─── 4. Atividade recente (timeline 24h) ─────────────────────
router.get('/recent-activity', requireAuth, async (req, res, next) => {
  const wsId = req.user.workspace_id;
  const key = cacheKey('recent-activity', wsId);
  const cached = getCached(key);
  if (cached) return res.json(cached);

  try {
    const events = [];

    // Vendas das últimas 24h
    try {
      const sales = await db.all(`
        SELECT id, contract_value, client_name, channel, created_at
        FROM sales WHERE workspace_id = $1
          AND created_at > NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC LIMIT 10
      `, [wsId]);
      sales.forEach(s => events.push({
        ts: s.created_at,
        icon: '💵',
        type: 'sale',
        title: `Venda: R$ ${Number(s.contract_value).toFixed(2)}`,
        detail: `${s.client_name || 'Cliente'} · canal ${s.channel || 'orgânico'}`,
      }));
    } catch { /* sales vazia */ }

    // Pagamentos aprovados via webhook
    try {
      const payments = await db.all(`
        SELECT id, payment_id, plan, amount, timestamp
        FROM payments_log
        WHERE workspace_id = $1 AND status = 'approved'
          AND timestamp > NOW() - INTERVAL '24 horas'
        ORDER BY timestamp DESC LIMIT 5
      `, [wsId]).catch(async () => {
        // Postgres aceita "horas" mas pra ser safe, retry com "hours"
        return await db.all(`
          SELECT id, payment_id, plan, amount, timestamp
          FROM payments_log
          WHERE workspace_id = $1 AND status = 'approved'
            AND timestamp > NOW() - INTERVAL '24 hours'
          ORDER BY timestamp DESC LIMIT 5
        `, [wsId]);
      });
      payments.forEach(p => events.push({
        ts: p.timestamp,
        icon: '💳',
        type: 'payment',
        title: `Upgrade aprovado: ${p.plan}`,
        detail: `R$ ${Number(p.amount).toFixed(2)} · MP ${p.payment_id}`,
      }));
    } catch { /* payments_log vazia */ }

    // Webhooks processados (mostra atividade externa)
    try {
      const hooks = await db.all(`
        SELECT provider, COUNT(*) AS count, MAX(processed_at) AS last_at
        FROM webhook_events
        WHERE processed_at > NOW() - INTERVAL '24 hours'
        GROUP BY provider
        ORDER BY last_at DESC LIMIT 5
      `).catch(() => []);
      hooks.forEach(h => events.push({
        ts: h.last_at,
        icon: '📡',
        type: 'webhook',
        title: `${h.count} webhooks recebidos`,
        detail: `provedor: ${h.provider}`,
      }));
    } catch { /* webhook_events vazia */ }

    // Auditoria recente
    try {
      const audit = await db.all(`
        SELECT action, ts, details FROM audit_log
        WHERE (workspace_id = $1 OR workspace_id IS NULL)
          AND ts > NOW() - INTERVAL '24 hours'
        ORDER BY ts DESC LIMIT 5
      `, [wsId]);
      audit.forEach(a => events.push({
        ts: a.ts,
        icon: '🔐',
        type: 'audit',
        title: a.action,
        detail: a.details ? JSON.stringify(a.details).slice(0, 80) : '',
      }));
    } catch { /* audit_log nova */ }

    // Ordena por timestamp desc e pega top 15
    events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    const result = {
      ts: Date.now(),
      workspace_id: wsId,
      events: events.slice(0, 15),
    };
    return res.json(setCached(key, result));
  } catch (err) {
    log.error('dashboard.recent-activity falhou', err);
    next(err);
  }
});

function minsAgo(date) {
  if (!date) return 0;
  return Math.floor((Date.now() - new Date(date).getTime()) / 60000);
}

module.exports = router;
