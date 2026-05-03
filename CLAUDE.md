# CLAUDE.md

Guia rápido pra qualquer sessão de Claude Code (ou dev humano) entrar no Nexus OS sem reler os 80 arquivos. Lê isso primeiro.

---

## O que é

Nexus OS é um SaaS multi-tenant de IA para vendas/tráfego/automação rodando em produção em https://nexusagencia.app. 16 módulos (Sentinel, Skynet, Doppelgänger, Forge, Studio, Lazarus, Vending, Market, Franchise, Empire, Poltergeist, Titan, Hive, Launcher, Billing, Audit). Cada cliente vira um `workspace` isolado.

---

## Stack & infra

- **Backend:** Node 22 + Express 4 (`server.js` é o entrypoint, exportado como serverless function)
- **DB:** PostgreSQL via Supabase. Project ID: `tnmxoavqcuirsceefqed`. Connection via `pg` Pool em `db/index.js`
- **Hosting:** Vercel (team `maranet`, project `nexus-os`). Domínio custom `nexusagencia.app`
- **Cache/rate limit:** Upstash Redis (`@upstash/ratelimit`)
- **Errors:** Sentry (org `maranet-telecom`, region DE: `o4511317764669440.ingest.de.sentry.io`)
- **Auth:** JWT em cookie httpOnly `auth`, bcrypt em `password_hash`. Middleware: `middleware/auth.js`
- **IA:** OmniRouter (`utils/omni-router.js`) com Gemini Flash + Claude Sonnet + GPT-4o + ElevenLabs TTS

⚠️ Slugs de cloud ainda começam com `maranet*` por questão de não-quebra durante o rebrand. Código aceita override via env (`VERCEL_TEAM_SLUG`, `VERCEL_PROJECT_SLUG`, `SENTRY_ORG_SLUG`).

---

## Convenções não-óbvias

### Multi-tenancy
- **Sempre** filtre por `workspace_id`. **Nunca** use `current_workspace_id` (não existe — coluna é só `workspace_id` em `users`).
- Padrão de rota autenticada:
  ```js
  router.use(requireAuth);
  // req.user.workspace_id já vem hidratado pelo middleware
  ```
- Settings por workspace ficam em `workspace_settings (workspace_id, key, value)`. Settings globais em `settings (key, value)`.

### Audit log
- Helper canônico: `utils/audit.js`. **Sempre** importar dele, não duplicar.
- Padrão:
  ```js
  const audit = require('../utils/audit');
  audit.log('domain.action.result', { ...audit.fromReq(req), extra: 'context' });
  ```
- `domain.action.result` em snake.dotted (ex: `auth.login.success`, `payment.kiwify.received`)
- Helper `audit.fromReq(req)` extrai `userId`, `workspaceId`, `ip`, `actor` automaticamente.
- Mascaramento automático: qualquer campo no `details` cuja chave bate `apikey|secret|token|password|credit|hash` vira `xxx***xx`. Não precisa mascarar manualmente.
- Fire-and-forget: erro de log nunca quebra a request.
- Retenção: 90d, configurável via `AUDIT_RETENTION_DAYS`. Cleanup roda no `/api/cron/alerts` diário.
- UI: `/audit` (admin-only). API: `GET /api/audit`, `GET /api/audit/stats`.

### Doppelgänger persona (configurável por workspace)
- Defaults em `routes/doppelganger.js` (constantes `DEFAULT_PERSONA_*`).
- Override por workspace via `workspace_settings`:
  - `doppelganger.persona_name` (ex: "Marina da Bella Pele")
  - `doppelganger.persona_bio`
  - `doppelganger.persona_traits` (tom, gírias, estilo)
- Mesma lógica plugada em `routes/webhook.js` (Closer NLP) — quando `toggle.doppelganger = 'true'` no workspace.
- UI de edição: `/doppelganger` (form em cima do chat de teste).

### OmniRouter (escolha de modelo IA)
- `LOW` → Gemini 2.5 Flash (rápido/barato; classificação, extração simples)
- `MEDIUM` → Claude Sonnet 4.6 (copy/vendas, persona) — fallback OpenAI gpt-4o
- `HIGH` → GPT-4o ou Claude Opus (raciocínio denso, planejamento)
- Sempre passa `keys = { GEMINI_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY }` lendo de `workspace_settings` primeiro, env como fallback.
- **Modelo Gemini:** `gemini-2.5-flash` ou `gemini-2.5-pro`. Não use `gemini-1.5-*` (deprecado).

### Webhooks externos
- **Mercado Pago** (`/api/webhook/mercadopago/:wsId`): HMAC **SHA-256** sobre `dataID`+`request-id`. Body parsed.
- **Kiwify** (`/api/webhooks/kiwify/:wsId`): HMAC **SHA-1** sobre `req.rawBody` (precisa do raw body capturado em `server.js`). Signature em `?signature=` ou header `x-kiwify-signature`.
- **Idempotência:** `webhook_events (provider, external_id, payload, processed_at)`. `checkIdempotency()` em `utils/webhook-helpers.js`. Cleanup automático >90d no cron.
- **Pagamento:** valida `currency_id === 'BRL'` antes de aceitar (anti-fraude).

### Crons (Vercel)
Definidos em `vercel.json`:
- `*/15 * * * *` → `/api/sentinel/cron` (anomalias Meta Ads)
- `*/15 * * * *` → `/api/lazarus/cron` (recuperação de carrinho/dead leads)
- `0 9 * * *` → `/api/skynet/cron` (campanhas IA diárias)
- `0 11 * * *` → `/api/cron/alerts` (alertas KPI + cleanup audit_log + cleanup webhook_events)

Todos protegidos por `Bearer ${CRON_SECRET}` em produção (`requireCronAuth` em `routes/cron.js`).

---

## Estrutura

```
server.js              entrypoint Express, exporta app
routes/                15+ rotas REST (uma por módulo)
middleware/            auth, ratelimit, logger, sentry
services/              alertScheduler, automationsRunner, mailer, poltergeist
utils/                 audit, omni-router, webhook-helpers, sentry
db/                    schema.sql, seed.js, index.js (pool pg), backup.js
migrations/            SQL versionado (rodar via `npm run db:migrate` ou Supabase MCP)
public/                HTML estático, CSS, JS frontend (sem framework)
public/js/             sidebar.js, module-helpers.js, app.js, nexus-pixel.js
public/checkout/       fluxo de checkout (Mercado Pago + Kiwify)
chrome-extension/      "Nexus Spy" — extrai criativos da Biblioteca de Anúncios FB
tests/                 unit.js, smoke.js
_archive/              scripts legacy + roadmaps antigos (não roda nada)
```

---

## Frontend (sem framework)

- HTML por página em `public/<modulo>.html`. Todas carregam:
  ```html
  <link rel="stylesheet" href="/css/module-page.css">
  <aside id="sidebar" data-active="<modulo>"></aside>
  <script src="/js/sidebar.js"></script>
  <script src="/js/module-helpers.js"></script>
  ```
- `sidebar.js` renderiza navegação, marca `data-active` automaticamente. Adicionar novo módulo: editar `NAV_GROUPS` + `ICONS` lá.
- `module-helpers.js` expõe `window.NEXUS`: `apiCall(method, path, body)`, `escapeHtml`, `showSpinner/hideSpinner`, `formatBRL`, `showOutput/showError`.
- localStorage com prefixo `nx_*` (não `maranet_*` — migração shim removida em 01/06/2026 via scheduled task).
- Pixel de tracking: `<script src="/js/nexus-pixel.js">` + `window.nexus('init', '<workspace_id>')` + `window.nexus('track', 'event_name', {...})`.
- Cores: paleta brutalist dark. Accent: `#0099ff` (electric blue). Tema cyan antigo `#39ff14` foi removido.
- Ícones: SVG inline Lucide-style, stroke 1.75. Nada de emoji nos botões/menus.

---

## Adicionar uma nova rota/módulo

1. Criar `routes/foo.js` exportando `router`. **Sempre** `router.use(requireAuth)` no topo (a menos que seja webhook público).
2. Em `server.js`, registrar com `app.use('/api/foo', require('./routes/foo'));`.
3. Logar ações importantes com `audit.log('foo.action.result', audit.fromReq(req))`.
4. Criar `public/foo.html` seguindo o template dos outros módulos.
5. Adicionar `'foo'` em `MODULE_PAGES` em `server.js` (auth-gate automático).
6. Adicionar entrada em `NAV_GROUPS` + `ICONS` em `public/js/sidebar.js`.

---

## Comandos úteis

```bash
# Local
npm run dev                       # node --watch
npm run seed                      # cria admin + 20 meses de dados demo (idempotente)
npm run reset                     # ⚠️ DROPa tudo e recria do schema.sql

# Docs auto-geradas (rodar antes de commitar mudanças em routes/ ou schema)
npm run docs:api                  # regenera docs/auto/API.md (offline, parseia routes/*.js)
npm run docs:schema               # regenera docs/auto/SCHEMA.md (precisa DATABASE_URL)
npm run docs:gen                  # ambos

# Testes
npm test                          # tests/unit.js
npm run test:smoke                # smoke local
npm run test:smoke:prod           # smoke contra produção

# DB direto (preferir Supabase MCP em sessão de Claude)
psql $DATABASE_URL -f migrations/2026_audit_log.sql

# Health
curl https://nexusagencia.app/api/health/ready
curl https://nexusagencia.app/api/health/live

# Audit log direto
SELECT ts, action, actor, ip FROM audit_log ORDER BY ts DESC LIMIT 20;
SELECT * FROM audit_log WHERE actor LIKE 'scheduled-task:%' ORDER BY ts DESC;
```

---

## Deploy flow

- `git push origin main` → Vercel auto-deploy (~1min). Sem PR check obrigatório.
- Validação rápida pós-deploy: `until curl -s .../api/health/ready | grep -q '"ok":true'; do sleep 3; done`.
- Env vars críticas no Vercel:
  - `JWT_SECRET`, `DATABASE_URL`, `CRON_SECRET`
  - `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`
  - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
  - `SENTRY_DSN`
  - Opcionais: `AUDIT_RETENTION_DAYS` (default 90), `VERCEL_TEAM_SLUG`, `SENTRY_ORG_SLUG`

---

## Histórico/contexto

- **2026-05-02:** Rebrand completo `Maranet/Daniel/NVia → Nexus OS`. 80 arquivos. Persona Doppelgänger virou configurável.
- **2026-05-02:** Audit log canônico construído. UI `/audit`. Migração de localStorage `maranet_* → nx_*` agendada pra auto-remoção em 2026-06-01 via scheduled task.
- **Trabalho anterior:** 16 correções de segurança, hardening em 7 camadas, OmniRouter, Command Center, landing pública.

Pra histórico granular: `git log --oneline -50` ou `SELECT * FROM audit_log ORDER BY ts DESC LIMIT 50`.

---

## Pontos de atenção

- **Não criar arquivos `.md` extras** sem o user pedir. Manter doc consolidada aqui + RUNBOOK.md (operacional) + NEXUS_OS_OVERVIEW.md (pitch).
- **Não tocar em `_archive/`** — material histórico, nada roda.
- **Não renomear** `users.workspace_id`, `workspace_settings.key`, ou os ENUMs de `payments_log.status`. São contratos com webhooks externos e queries do dashboard.
- **Sempre validar** com `node -c <arquivo>` após edits grandes (especialmente em `server.js` e rotas).
- **Webhook de pagamento:** mudar a lógica de validação de assinatura é INCIDENT-level. Testar com payload real ou mock signed antes de mergear.
- **Senhas:** seed default `nexus2026` (admin/nexus2026) só vale pra novas instalações. Em produção a senha é a original do banco.
- **`utils/audit.js` vs `services/audit.js`:** só existe `utils/audit.js`. Se aparecer `services/audit.js` num grep, é resíduo de refactor antigo — deletar.

---

## Quando em dúvida

1. Olhar como outro módulo similar faz (ex: pra rota nova, copia padrão de `routes/hive.js` ou `routes/doppelganger.js`).
2. Audit log + Sentry costumam ter a resposta de "o que aconteceu em produção".
3. Pra entender a *motivação* de algo, `git log -p` no arquivo. Mensagens de commit são detalhadas.
4. RUNBOOK.md cobre operação (debug, deploy manual, rollback). Esse arquivo aqui cobre arquitetura.

---

## Documentação completa do sistema

| Documento | Quando consultar |
|---|---|
| **CLAUDE.md** (este arquivo) | Convenções, gotchas, padrões |
| [docs/MODULES.md](docs/MODULES.md) | Descrição funcional dos 16 módulos + dependências |
| [docs/auto/API.md](docs/auto/API.md) | Lista completa dos 134 endpoints com middlewares (auto-gerado) |
| [docs/auto/SCHEMA.md](docs/auto/SCHEMA.md) | Schema completo do Postgres com FKs e índices (auto-gerado) |
| [RUNBOOK.md](RUNBOOK.md) | Operação: debug, rollback, incident response |
| [NEXUS_OS_OVERVIEW.md](NEXUS_OS_OVERVIEW.md) | Pitch + visão estratégica |
| [DEPLOY.md](DEPLOY.md) | Setup inicial Supabase + Vercel |
