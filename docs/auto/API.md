# API Reference — Nexus OS

> **Gerado automaticamente** por `scripts/gen-api-docs.js` em 2026-05-03 00:23.
> Não edite à mão. Pra atualizar: `npm run docs:api`.

**Total:** 134 endpoints em 44 módulos.

**Convenções de middleware:**
- `auth` — exige cookie JWT `auth` válido (`requireAuth`)
- `admin` — exige `req.user.role === 'admin'` (`requireAdmin`)
- `rateLimit` — passa por rate limiter Upstash

## `/api/ai` — ai

Source: `routes/ai.js` · 2 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `GET` | `/api/ai/insights` | `auth` |  | [ai.js:10](../../routes/ai.js#L10) |
| `POST` | `/api/ai/chat` | — |  | [ai.js:24](../../routes/ai.js#L24) |

## `/api/alerts` — alerts

Source: `routes/alerts.js` · 6 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `GET` | `/api/alerts/config` | `auth,admin` |  | [alerts.js:16](../../routes/alerts.js#L16) |
| `POST` | `/api/alerts/config` | `auth,admin` |  | [alerts.js:25](../../routes/alerts.js#L25) |
| `PATCH` | `/api/alerts/config/:id` | `auth,admin` |  | [alerts.js:45](../../routes/alerts.js#L45) |
| `DELETE` | `/api/alerts/config/:id` | `auth,admin` |  | [alerts.js:59](../../routes/alerts.js#L59) |
| `POST` | `/api/alerts/test` | `auth,admin` |  | [alerts.js:67](../../routes/alerts.js#L67) |
| `GET` | `/api/alerts/log` | `auth` |  | [alerts.js:84](../../routes/alerts.js#L84) |

## `/api/audit` — audit

Source: `routes/audit.js` · 2 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `GET` | `/api/audit` | `auth,admin` |  | [audit.js:14](../../routes/audit.js#L14) |
| `GET` | `/api/audit/stats` | `auth,admin` |  | [audit.js:42](../../routes/audit.js#L42) |

## `/api/auth` — auth

Source: `routes/auth.js` · 5 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `POST` | `/api/auth/login` | `rateLimit` |  | [auth.js:15](../../routes/auth.js#L15) |
| `POST` | `/api/auth/logout` | `auth,admin` |  | [auth.js:51](../../routes/auth.js#L51) |
| `GET` | `/api/auth/me` | `auth,admin` |  | [auth.js:57](../../routes/auth.js#L57) |
| `GET` | `/api/auth/viewer-link` | `auth,admin` |  | [auth.js:61](../../routes/auth.js#L61) |
| `GET` | `/api/auth/login-link` | — |  | [auth.js:70](../../routes/auth.js#L70) |

## `/api/automations` — automations

Source: `routes/automations.js` · 4 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `GET` | `/api/automations` | `auth,admin` |  | [automations.js:9](../../routes/automations.js#L9) |
| `POST` | `/api/automations` | `auth,admin` |  | [automations.js:18](../../routes/automations.js#L18) |
| `DELETE` | `/api/automations/:id` | `auth,admin` |  | [automations.js:36](../../routes/automations.js#L36) |
| `PATCH` | `/api/automations/:id/toggle` | `auth,admin` |  | [automations.js:45](../../routes/automations.js#L45) |

## `/api/billing` — billing

Source: `routes/billing.js` · 3 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `GET` | `/api/billing/master` | `auth` | GET /api/billing/master Visão de Administrador (NEXUS Master) para ver faturamento | [billing.js:13](../../routes/billing.js#L13) |
| `POST` | `/api/billing/upgrade` | `auth` | POST /api/billing/upgrade Cliente pede Upgrade de Plano | [billing.js:55](../../routes/billing.js#L55) |
| `GET` | `/api/billing/me` | `auth` | GET /api/billing/me O próprio cliente vê o seu consumo de IA e o limite de degustação | [billing.js:123](../../routes/billing.js#L123) |

## `/api/campaigns` — campaigns

Source: `routes/campaigns.js` · 4 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `GET` | `/api/campaigns` | `auth,admin` |  | [campaigns.js:11](../../routes/campaigns.js#L11) |
| `POST` | `/api/campaigns` | `auth,admin` |  | [campaigns.js:24](../../routes/campaigns.js#L24) |
| `PATCH` | `/api/campaigns/:id` | `auth,admin` |  | [campaigns.js:43](../../routes/campaigns.js#L43) |
| `DELETE` | `/api/campaigns/:id` | `auth,admin` |  | [campaigns.js:66](../../routes/campaigns.js#L66) |

## `/api/checkout` — checkout

Source: `routes/checkout.js` · 3 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `GET` | `/api/checkout/product/:id` | — | GET /api/checkout/product/:id Retorna os dados do produto para a página de checkout pública | [checkout.js:9](../../routes/checkout.js#L9) |
| `POST` | `/api/checkout/process` | — | POST /api/checkout/process O "Gateway de Pagamento" Nativo. Recebe cartão ou Pix. | [checkout.js:23](../../routes/checkout.js#L23) |
| `GET` | `/api/checkout/orders` | `auth` |  | [checkout.js:147](../../routes/checkout.js#L147) |

## `/api/cron` — cron

Source: `routes/cron.js` · 2 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `GET` | `/api/cron/alerts` | — |  | [cron.js:32](../../routes/cron.js#L32) |
| `GET` | `/api/cron/sync` | — |  | [cron.js:53](../../routes/cron.js#L53) |

## `/api/dashboard` — dashboard

Source: `routes/dashboard.js` · 4 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `GET` | `/api/dashboard/metrics-today` | `auth` | ─── 1. Métricas de hoje ───────────────────────────────────── | [dashboard.js:38](../../routes/dashboard.js#L38) |
| `GET` | `/api/dashboard/agents-status` | `auth` | ─── 2. Status dos agentes IA ──────────────────────────────── | [dashboard.js:132](../../routes/dashboard.js#L132) |
| `GET` | `/api/dashboard/pending-actions` | `auth` | ─── 3. Ações pendentes ────────────────────────────────────── | [dashboard.js:230](../../routes/dashboard.js#L230) |
| `GET` | `/api/dashboard/recent-activity` | `auth` | ─── 4. Atividade recente (timeline 24h) ───────────────────── | [dashboard.js:322](../../routes/dashboard.js#L322) |

## `/api/doppelganger` — doppelganger

Source: `routes/doppelganger.js` · 3 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `POST` | `/api/doppelganger/chat` | — | POST /api/doppelganger/chat Nexus Doppelgänger: clone digital configurável por workspace. | [doppelganger.js:24](../../routes/doppelganger.js#L24) |
| `GET` | `/api/doppelganger/persona` | `auth` | GET /api/doppelganger/persona Retorna a persona configurada do workspace + defaults Nexus. | [doppelganger.js:69](../../routes/doppelganger.js#L69) |
| `PUT` | `/api/doppelganger/persona` | `auth,admin` | PUT /api/doppelganger/persona Atualiza persona do workspace. Apenas admin pode alterar. Body: { name?, bio?, traits? } — strings vazias removem o override. | [doppelganger.js:100](../../routes/doppelganger.js#L100) |

## `/api/drill` — drill

Source: `routes/drill.js` · 1 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `GET` | `/api/drill/:campaign_id` | `auth` |  | [drill.js:13](../../routes/drill.js#L13) |

## `/api/empire` — empire

Source: `routes/empire.js` · 9 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `GET` | `/api/empire/kanban/:wsId` | — | --- KANBAN TASKS --- | [empire.js:6](../../routes/empire.js#L6) |
| `POST` | `/api/empire/kanban/:wsId` | — |  | [empire.js:13](../../routes/empire.js#L13) |
| `PATCH` | `/api/empire/kanban/task/:id` | — |  | [empire.js:21](../../routes/empire.js#L21) |
| `DELETE` | `/api/empire/kanban/task/:id` | — |  | [empire.js:29](../../routes/empire.js#L29) |
| `GET` | `/api/empire/wa/:wsId` | — | --- WHATSAPP SETTINGS --- | [empire.js:37](../../routes/empire.js#L37) |
| `POST` | `/api/empire/wa/:wsId` | — |  | [empire.js:44](../../routes/empire.js#L44) |
| `GET` | `/api/empire/billing/:wsId` | — | --- SUBSCRIPTIONS (BILLING MOCK) --- | [empire.js:56](../../routes/empire.js#L56) |
| `POST` | `/api/empire/spy` | — | --- CHROME EXTENSION SPY (API) --- | [empire.js:68](../../routes/empire.js#L68) |
| `GET` | `/api/empire/spy/:wsId` | — |  | [empire.js:77](../../routes/empire.js#L77) |

## `/api/financial` — financial

Source: `routes/financial.js` · 2 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `GET` | `/api/financial/:wsId` | — | Get financial settings for workspace | [financial.js:6](../../routes/financial.js#L6) |
| `POST` | `/api/financial/:wsId` | — | Update financial settings | [financial.js:20](../../routes/financial.js#L20) |

## `/api/forge` — forge

Source: `routes/forge.js` · 2 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `POST` | `/api/forge/generate` | `auth` | POST /api/forge/generate Cria uma Landing Page Inteira via IA baseada no nicho | [forge.js:11](../../routes/forge.js#L11) |
| `GET` | `/api/forge/list` | `auth` |  | [forge.js:95](../../routes/forge.js#L95) |

## `/api/franchise` — franchise

Source: `routes/franchise.js` · 1 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `POST` | `/api/franchise/create` | `auth` | POST /api/franchise/create Cria um novo locatário (Franquia White-Label) | [franchise.js:10](../../routes/franchise.js#L10) |

## `/api/goals` — goals

Source: `routes/goals.js` · 3 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `GET` | `/api/goals` | `auth` |  | [goals.js:13](../../routes/goals.js#L13) |
| `POST` | `/api/goals` | `auth,admin` |  | [goals.js:27](../../routes/goals.js#L27) |
| `DELETE` | `/api/goals/:id` | `auth,admin` |  | [goals.js:48](../../routes/goals.js#L48) |

## `/api/heal` — heal

Source: `routes/heal.js` · 1 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `POST` | `/api/heal/webhook` | — | POST /api/heal/webhook Auto-Cura (Agentic DevOps) - Recebe logs de erro e conserta código | [heal.js:9](../../routes/heal.js#L9) |

## `/api/health` — health

Source: `routes/health.js` · 6 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `GET` | `/api/health` | — |  | [health.js:21](../../routes/health.js#L21) |
| `GET` | `/api/health/db` | — |  | [health.js:33](../../routes/health.js#L33) |
| `GET` | `/api/health/redis` | — |  | [health.js:48](../../routes/health.js#L48) |
| `GET` | `/api/health/mp` | — |  | [health.js:67](../../routes/health.js#L67) |
| `GET` | `/api/health/test-sentry` | — | GET /api/health/test-sentry?token=XXX Dispara erro controlado pra validar que Sentry está capturando. Disponível APENAS se SENTRY_TEST_TOKEN env var estiver setada (sem default). Sem env var → endpoint não existe (404). | [health.js:90](../../routes/health.js#L90) |
| `GET` | `/api/health/ready` | — |  | [health.js:110](../../routes/health.js#L110) |

## `/api/hive` — hive

Source: `routes/hive.js` · 1 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `GET` | `/api/hive/pulse` | `auth` | GET /api/hive/pulse Mente de Colmeia (Simulação de Anomalias Globais da Rede) | [hive.js:10](../../routes/hive.js#L10) |

## `/api/instagram` — instagram

Source: `routes/instagram.js` · 4 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `GET` | `/api/instagram/overview` | `auth` | ─── GET /api/instagram/overview ────────────────────────────────────────── | [instagram.js:32](../../routes/instagram.js#L32) |
| `GET` | `/api/instagram/placements` | `auth` | ─── GET /api/instagram/placements ──────────────────────────────────────── | [instagram.js:101](../../routes/instagram.js#L101) |
| `GET` | `/api/instagram/campaigns` | `auth` | ─── GET /api/instagram/campaigns ───────────────────────────────────────── | [instagram.js:125](../../routes/instagram.js#L125) |
| `GET` | `/api/instagram/trend` | `auth` | ─── GET /api/instagram/trend ───────────────────────────────────────────── | [instagram.js:161](../../routes/instagram.js#L161) |

## `/api/launcher` — launcher

Source: `routes/launcher.js` · 1 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `POST` | `/api/launcher/meta` | `auth` |  | [launcher.js:7](../../routes/launcher.js#L7) |

## `/api/lazarus` — lazarus

Source: `routes/lazarus.js` · 1 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `POST` | `/api/lazarus/revive` | `auth` | POST /api/lazarus/revive Envia um array de contatos "mortos", a IA cria copys ultra-pessoais | [lazarus.js:10](../../routes/lazarus.js#L10) |

## `/api/market` — market

Source: `routes/market.js` · 4 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `POST` | `/api/market/capture` | — | 1. RECEBER NOVO LEAD (Webhook do Facebook Lead Ads ou Landing Page genérica) | [market.js:9](../../routes/market.js#L9) |
| `GET` | `/api/market/buy/:lead_id/:buyer_id` | — | 2. COMPRADOR PAGA E RECEBE O LEAD (A "Bolsa de Valores") | [market.js:41](../../routes/market.js#L41) |
| `GET` | `/api/market/dashboard` | `auth` | 3. DASHBOARD: RESUMO PARA O GESTOR (NEXUS OS) | [market.js:80](../../routes/market.js#L80) |
| `POST` | `/api/market/buyers` | `auth` | Adicionar um comprador na base | [market.js:108](../../routes/market.js#L108) |

## `/api/metrics` — metrics

Source: `routes/metrics.js` · 11 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `GET` | `/api/metrics/daily` | `auth` |  | [metrics.js:70](../../routes/metrics.js#L70) |
| `POST` | `/api/metrics/daily` | `auth,admin` | POST /api/metrics/daily  (upsert) | [metrics.js:106](../../routes/metrics.js#L106) |
| `POST` | `/api/metrics/bulk` | `auth,admin` | POST /api/metrics/bulk  (upsert em lote) | [metrics.js:145](../../routes/metrics.js#L145) |
| `DELETE` | `/api/metrics/daily/:id` | `auth,admin` |  | [metrics.js:173](../../routes/metrics.js#L173) |
| `GET` | `/api/metrics/monthly` | `auth` |  | [metrics.js:184](../../routes/metrics.js#L184) |
| `GET` | `/api/metrics/summary` | `auth` |  | [metrics.js:212](../../routes/metrics.js#L212) |
| `GET` | `/api/metrics/by-campaign` | `auth` |  | [metrics.js:251](../../routes/metrics.js#L251) |
| `GET` | `/api/metrics/kpis` | `auth` |  | [metrics.js:327](../../routes/metrics.js#L327) |
| `GET` | `/api/metrics/demographics` | `auth` |  | [metrics.js:364](../../routes/metrics.js#L364) |
| `GET` | `/api/metrics/placements` | `auth` |  | [metrics.js:410](../../routes/metrics.js#L410) |
| `GET` | `/api/metrics/ads` | `auth` |  | [metrics.js:457](../../routes/metrics.js#L457) |

## `/api/notes` — notes

Source: `routes/notes.js` · 3 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `GET` | `/api/notes` | `auth` |  | [notes.js:11](../../routes/notes.js#L11) |
| `POST` | `/api/notes` | `auth,admin` |  | [notes.js:25](../../routes/notes.js#L25) |
| `DELETE` | `/api/notes/:id` | `auth,admin` |  | [notes.js:39](../../routes/notes.js#L39) |

## `/api/pay` — pay

Source: `routes/pay.js` · 2 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `POST` | `/api/pay/charge` | `auth` | POST /api/pay/charge Gera a cobrança (Pix) para o cliente da agência. | [pay.js:29](../../routes/pay.js#L29) |
| `GET` | `/api/pay/statement` | `auth` | GET /api/pay/statement Extrato da Agência no NEXUS Pay | [pay.js:68](../../routes/pay.js#L68) |

## `/api/pixel` — pixel

Source: `routes/pixel.js` · 3 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `POST` | `/api/pixel` | — |  | [pixel.js:6](../../routes/pixel.js#L6) |
| `POST` | `/api/pixel/track` | — | NEXUS: Multi-Touch Attribution Endpoint | [pixel.js:48](../../routes/pixel.js#L48) |
| `GET` | `/api/pixel/leads` | `auth` |  | [pixel.js:87](../../routes/pixel.js#L87) |

## `/api/poltergeist` — poltergeist

Source: `routes/poltergeist.js` · 1 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `POST` | `/api/poltergeist/dispatch` | — | POST /api/poltergeist/dispatch Protocolo Poltergeist: Controle de Hardware (Impressora) e Logística (Uber) | [poltergeist.js:9](../../routes/poltergeist.js#L9) |

## `/api/reports` — reports

Source: `routes/reports.js` · 2 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `POST` | `/api/reports/generate` | `auth` | 1. Generate a new report (Requires Auth) | [reports.js:9](../../routes/reports.js#L9) |
| `GET` | `/api/reports/:uuid` | — | 2. Fetch a public report (NO AUTH REQUIRED - for clients) | [reports.js:32](../../routes/reports.js#L32) |

## `/api/sentinel` — sentinel

Source: `routes/sentinel.js` · 1 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `POST` | `/api/sentinel/force` | `auth` | POST /api/sentinel/force Chamado manualmente pelo administrador via Dashboard | [sentinel.js:228](../../routes/sentinel.js#L228) |

## `/api/services` — services

Source: `routes/services.js` · 8 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `GET` | `/api/services/all` | `auth,admin` | ─── Endpoints ──────────────────────────────────────────────── | [services.js:430](../../routes/services.js#L430) |
| `GET` | `/api/services/vercel` | `auth,admin` |  | [services.js:449](../../routes/services.js#L449) |
| `GET` | `/api/services/supabase` | `auth,admin` |  | [services.js:450](../../routes/services.js#L450) |
| `GET` | `/api/services/redis` | `auth,admin` |  | [services.js:451](../../routes/services.js#L451) |
| `GET` | `/api/services/mp` | `auth,admin` |  | [services.js:452](../../routes/services.js#L452) |
| `GET` | `/api/services/sentry` | `auth,admin` |  | [services.js:453](../../routes/services.js#L453) |
| `GET` | `/api/services/uptimerobot` | `auth,admin` |  | [services.js:454](../../routes/services.js#L454) |
| `GET` | `/api/services/github` | `auth,admin` |  | [services.js:455](../../routes/services.js#L455) |

## `/api/settings` — settings

Source: `routes/settings.js` · 2 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `GET` | `/api/settings` | `auth` |  | [settings.js:12](../../routes/settings.js#L12) |
| `PUT` | `/api/settings` | `auth,admin` |  | [settings.js:28](../../routes/settings.js#L28) |

## `/api/skynet` — skynet

Source: `routes/skynet.js` · 1 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `POST` | `/api/skynet/hunt` | `auth` | POST /api/skynet/hunt Operação Skynet: Prospecção, Ligação AI e Cobrança Automática | [skynet.js:11](../../routes/skynet.js#L11) |

## `/api/studio` — studio

Source: `routes/studio.js` · 2 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `POST` | `/api/studio/audio` | `auth` | POST /api/studio/audio Gera Áudio hiper-realista com ElevenLabs (Clonagem de Voz) | [studio.js:11](../../routes/studio.js#L11) |
| `POST` | `/api/studio/video` | `auth` | POST /api/studio/video Gera Vídeo Lip-Sync via HeyGen (Preparação da Rota) | [studio.js:66](../../routes/studio.js#L66) |

## `/api/sync` — sync

Source: `routes/sync.js` · 8 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `GET` | `/api/sync/status` | — | ───────────────────────────────────────────────────────────── GET /api/sync/status ───────────────────────────────────────────────────────────── | [sync.js:30](../../routes/sync.js#L30) |
| `POST` | `/api/sync/credentials` | — | ───────────────────────────────────────────────────────────── POST /api/sync/credentials ───────────────────────────────────────────────────────────── | [sync.js:53](../../routes/sync.js#L53) |
| `POST` | `/api/sync/test/:platform` | — | ───────────────────────────────────────────────────────────── POST /api/sync/test/:platform ───────────────────────────────────────────────────────────── | [sync.js:78](../../routes/sync.js#L78) |
| `GET` | `/api/sync/oauth/google` | — | ───────────────────────────────────────────────────────────── OAuth2 Google ───────────────────────────────────────────────────────────── | [sync.js:100](../../routes/sync.js#L100) |
| `GET` | `/api/sync/oauth/google/callback` | — |  | [sync.js:110](../../routes/sync.js#L110) |
| `GET` | `/api/sync/history` | — | ───────────────────────────────────────────────────────────── GET /api/sync/history ───────────────────────────────────────────────────────────── | [sync.js:296](../../routes/sync.js#L296) |
| `POST` | `/api/sync/google` | — | ───────────────────────────────────────────────────────────── POST /api/sync/google ───────────────────────────────────────────────────────────── | [sync.js:359](../../routes/sync.js#L359) |
| `POST` | `/api/sync/meta` | — | ───────────────────────────────────────────────────────────── POST /api/sync/meta ───────────────────────────────────────────────────────────── | [sync.js:384](../../routes/sync.js#L384) |

## `/api/titan` — titan

Source: `routes/titan.js` · 1 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `POST` | `/api/titan/audit` | — | POST /api/titan/audit NEXUS Titan: CEO Autônomo e Serial | [titan.js:10](../../routes/titan.js#L10) |

## `/api/users` — users

Source: `routes/users.js` · 4 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `GET` | `/api/users` | `auth,admin` |  | [users.js:14](../../routes/users.js#L14) |
| `POST` | `/api/users` | `auth,admin` |  | [users.js:23](../../routes/users.js#L23) |
| `PATCH` | `/api/users/:id` | `auth,admin` |  | [users.js:44](../../routes/users.js#L44) |
| `DELETE` | `/api/users/:id` | `auth,admin` |  | [users.js:73](../../routes/users.js#L73) |

## `/api/vending` — vending

Source: `routes/vending.js` · 1 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `POST` | `/api/vending/checkout` | — | POST /api/vending/checkout Endpoint chamado quando o Dentista/Advogado paga pelo Pix | [vending.js:17](../../routes/vending.js#L17) |

## `/api/vision` — vision

Source: `routes/vision.js` · 1 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `POST` | `/api/vision/reverse` | `auth` | POST /api/vision/reverse Engenharia Reversa Visual de Anúncios e Landing Pages | [vision.js:10](../../routes/vision.js#L10) |

## `/api/voice` — voice

Source: `routes/voice.js` · 1 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `POST` | `/api/voice/call` | `auth` | POST /api/voice/call Dispara uma ligação VOIP usando ElevenLabs (Voz Neural) + Twilio | [voice.js:10](../../routes/voice.js#L10) |

## `/api/webhook` — webhook

Source: `routes/webhook.js` · 3 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `POST` | `/api/webhook/crm` | — |  | [webhook.js:31](../../routes/webhook.js#L31) |
| `POST` | `/api/webhook/whatsapp/:token` | — |  | [webhook.js:109](../../routes/webhook.js#L109) |
| `POST` | `/api/webhook/mercadopago` | — |  | [webhook.js:283](../../routes/webhook.js#L283) |

## `/api/webhooks` — webhooks

Source: `routes/webhooks.js` · 1 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `POST` | `/api/webhooks/kiwify/:wsId` | `rateLimit` |  | [webhooks.js:26](../../routes/webhooks.js#L26) |

## `/api/workspaces` — workspaces

Source: `routes/workspaces.js` · 4 endpoint(s)

| Method | Path | Middlewares | Descrição | Source |
|---|---|---|---|---|
| `GET` | `/api/workspaces` | `auth,admin` |  | [workspaces.js:9](../../routes/workspaces.js#L9) |
| `POST` | `/api/workspaces` | `auth,admin` |  | [workspaces.js:16](../../routes/workspaces.js#L16) |
| `PUT` | `/api/workspaces/:id/branding` | `auth,admin` |  | [workspaces.js:26](../../routes/workspaces.js#L26) |
| `POST` | `/api/workspaces/switch` | `auth,admin` |  | [workspaces.js:40](../../routes/workspaces.js#L40) |

## ⚠️ Routers não montados

Arquivos em `routes/` sem `app.use(...)` correspondente em `server.js`:
- `routes/import.js`
