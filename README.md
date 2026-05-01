# NEXUS OS

> Plataforma SaaS B2B multi-tenant de automação de tráfego pago, vendas com IA
> e operações comerciais autônomas. Construída para rodar negócios — não só medi-los.

**Produção:** https://nexusagencia.app
**Status atual:** 23/23 unit tests + 8/8 smoke em produção · agência-grade

---

## O que o sistema faz

NEXUS OS é uma plataforma multi-tenant onde cada workspace (cliente, agência ou
franquia) opera num ambiente isolado, com seus próprios dados, configurações e
robôs de IA. A plataforma combina:

- **Painel de tráfego pago** com sync automático (Google Ads + Meta Ads)
- **Vendedor IA por WhatsApp** (Doppelgänger imita estilo do dono, com Ghost Checkout)
- **Sentinel** — robô que pausa/escala campanhas com Gemini a cada 15min
- **Skynet** — prospecção automática via Google Maps + IA
- **Lazarus** — recuperador de carrinhos abandonados e leads frios
- **Forge** — gerador de landing pages mutantes
- **Vending Machine** — campanhas autônomas pagas via PIX
- **Market** — bolsa de leads em leilão por nicho/cidade
- **Franchise** — módulo white-label para agências
- **Titan** — auditor que decide novos spin-offs com IA

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Node.js 22 + Express 4 |
| Banco | PostgreSQL via Supabase (Supavisor pooler porta 6543) |
| Deploy | Vercel (serverless functions + edge) |
| Cache/Rate limit | Upstash Redis (sliding window) |
| Auth | JWT httpOnly cookie + bcrypt |
| Pagamentos | Mercado Pago (HMAC SHA-256), Kiwify (HMAC SHA-1) |
| IA | Anthropic Claude 4.6 Sonnet, Gemini 1.5 Flash, GPT-4o (omni-router) |
| Voz | ElevenLabs |
| WhatsApp | Z-API / Evolution API |
| Observabilidade | Sentry (opt-in), logs JSON estruturados, UptimeRobot |

---

## Recursos de qualidade

- ✅ **Testes automatizados** — `npm test` roda 23 testes unitários, `npm run test:smoke:prod` roda 8 testes de integração
- ✅ **CI/CD** — GitHub Actions valida sintaxe + roda testes em cada PR e após cada merge em main
- ✅ **Segurança** — HMAC validation, idempotência, rate limit Upstash, CSP, HSTS, COOP, audit log
- ✅ **Observabilidade** — logger estruturado, health checks granulares, Sentry integrado
- ✅ **LGPD** — PII mascarada em logs (CPF, e-mail, telefone)

---

## Instalação local

Requer **Node.js 22+** e acesso ao Postgres do Supabase.

```bash
git clone <repo>
cd sistrafego
cp .env.example .env        # configure as env vars (ver tabela abaixo)
npm install
npm run db:migrate          # roda migrations
npm run seed                # opcional: dados de exemplo
npm start                   # sobe em http://localhost:3000
npm test                    # roda testes unitários
```

Credenciais padrão do seed (altere em `.env` antes do primeiro `seed`):
- **usuário:** `admin`
- **senha:** definida em `ADMIN_PASS` do `.env`

---

## Scripts npm

| Comando | O que faz |
|---------|-----------|
| `npm start` | Sobe o servidor na porta `PORT` (default 3000) |
| `npm run dev` | Mesma coisa, com `--watch` (auto-reload em arquivos modificados) |
| `npm run seed` | Cria usuário admin + dados de exemplo. Idempotente |
| `npm run reset` | **Apaga o banco.** Rode `npm run seed` depois |
| `npm run db:migrate` | Roda as migrations em `db/migrate.js` |
| `npm test` | Testes unitários (sem rede, < 1s) |
| `npm run test:smoke` | Smoke tests contra `localhost` (ou `DOMAIN` env) |
| `npm run test:smoke:prod` | Smoke tests contra `https://nexusagencia.app` |

---

## Env vars críticas

Tudo configurado em `.env.example`. Em produção, só configurar via Vercel UI.

| Variável | Crítico? | Descrição |
|----------|----------|-----------|
| `DATABASE_URL` | 🔴 SIM | Postgres via Supavisor pooler (porta 6543) |
| `JWT_SECRET` | 🔴 SIM | `openssl rand -hex 32` |
| `MP_WEBHOOK_SECRET` | 🔴 SIM | Assinatura HMAC do Mercado Pago |
| `MP_COLLECTOR_ID` | 🔴 SIM | Seu User ID no MP (impede aceitar pagamento de outras contas) |
| `UPSTASH_REDIS_REST_URL` | 🟡 IMPORTANTE | Rate limiter sem ele = sistema vulnerável a brute force |
| `UPSTASH_REDIS_REST_TOKEN` | 🟡 IMPORTANTE | Idem |
| `CRON_SECRET` | 🟡 IMPORTANTE | Protege endpoints de cron |
| `SENTRY_DSN` | 🟢 OPCIONAL | Captura automática de erros 5xx em produção |
| `LOG_LEVEL` | 🟢 OPCIONAL | `debug`, `info` (default), `warn`, `error` |

---

## Estrutura de pastas

```
sistrafego/
├── server.js                  # Express entrypoint, monta todas as 41 rotas
├── db/
│   ├── index.js              # Pool Postgres + helpers (get/all/run/transaction)
│   ├── schema.sql            # DDL inicial
│   ├── migrate.js            # Runner de migrations
│   ├── seed.js               # Dados de exemplo
│   └── reset.js              # Apaga banco
├── middleware/
│   ├── auth.js               # JWT + requireAuth + requireAdmin
│   ├── logger.js             # Logger estruturado (JSON em prod, color em dev)
│   └── ratelimit.js          # Rate limit Upstash com fail-open
├── routes/                   # 41 arquivos, um por domínio
│   ├── auth.js               # Login/logout/me/viewer-link
│   ├── billing.js            # Upgrade de plano (MP)
│   ├── webhook.js            # CRM, WhatsApp, Mercado Pago
│   ├── webhooks.js           # Kiwify
│   ├── sentinel.js           # Robô trader de campanhas
│   ├── skynet.js             # Prospecção autônoma
│   ├── ... (40+ módulos)
│   └── health.js             # Liveness, readiness, db, redis, mp
├── services/                 # Lógica reutilizável fora de rotas
├── utils/
│   ├── validate.js           # Validação leve de input (sem libs externas)
│   ├── retry.js              # Exponential backoff para APIs externas
│   ├── idempotency.js        # checkIdempotency centralizado
│   ├── audit.js              # audit_log para ações sensíveis
│   ├── sentry.js             # Wrapper opt-in do @sentry/node
│   ├── mask.js               # PII masking (LGPD)
│   └── omni-router.js        # Roteador IA com lazy require
├── tests/
│   ├── unit.js               # 23 testes unitários (rede zero)
│   └── smoke.js              # 8 smoke tests contra ambiente real
├── migrations/               # SQL de evolução do schema
├── public/                   # Frontend HTML + JS vanilla
├── chrome-extension/         # Espião de criativos do Facebook Ad Library
└── .github/workflows/ci.yml  # CI: unit tests + syntax + smoke pós-deploy
```

---

## Documentação adicional

- **[RUNBOOK.md](RUNBOOK.md)** — manual operacional para incidentes, deploys, rollbacks
- **[DEPLOY.md](DEPLOY.md)** — guia de primeiro deploy
- **[CHANGELOG_SECURITY.md](CHANGELOG_SECURITY.md)** — histórico de hardening
- **[roadmap-v3.md](roadmap-v3.md)** — visão de futuro

---

## Licença

Software proprietário (UNLICENSED). Direitos reservados.
