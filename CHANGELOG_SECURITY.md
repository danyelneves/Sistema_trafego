# CHANGELOG SECURITY 🔒 (30 Abril 2026)

Este documento detalha todas as correções cirúrgicas de segurança e arquitetura aplicadas com base na auditoria do Claude 4.7 Opus (Rodadas 1 e 2).

### 1. [CRÍTICO] Webhook MP HMAC Validation 
**Arquivos:** `routes/webhook.js`
**Status:** ✅ APLICADO
* Implementada verificação via header `x-signature` (HMAC sha256).
* Adicionada validação do `collector_id`, `transaction_amount` exato (com 0.01 de tolerância) e moeda BRL.

### 2. [CRÍTICO] Idempotência nos Webhooks
**Arquivos:** `migrations/2026_security_hardening.sql`, `routes/webhook.js`, `routes/webhooks.js`
**Status:** ✅ APLICADO
* Tabela `webhook_events` criada. Inserção controlada antes da lógica de negócios para evitar duplicidades silenciosas (falha `UNIQUE`).

### 3. [CRÍTICO] CRM Webhook Fallback Inseguro
**Arquivos:** `routes/webhook.js`
**Status:** ✅ APLICADO
* Removido qualquer acesso por fallback (workspace=1) no webhook de vendas do CRM.

### 4. [CRÍTICO] WhatsApp Webhook - Rate Limiting & Token Url
**Arquivos:** `routes/webhook.js`, `middleware/ratelimit.js`
**Status:** ✅ APLICADO
* Transformada rota em `/:token` e verificação no BD invés de query param `workspace`.
* Integrado Ratelimiter serverless Upstash. Tokens gerados via SQL migration.

### 5. [CRÍTICO] PIX Ghost Checkout - Tracking e Idempotência
**Arquivos:** `routes/webhook.js`
**Status:** ✅ APLICADO
* Geração do MercadoPago via webhook agora usa `X-Idempotency-Key` único.
* E-mail e external_reference ajustados de forma atrelada ao celular para facilitar auditoria.

### 6. [CRÍTICO] Fire-and-Forget no Poltergeist HTTP
**Arquivos:** `services/poltergeist.js`, `routes/poltergeist.js`, `routes/webhook.js`
**Status:** ✅ APLICADO
* Transformada a rota em wrapper. O serviço interno agora é chamado diretamente via código para prevenir corte prematuro de execução (Vercel Lambdas).

### 7. [CRÍTICO] Log e Validação do Target Workspace
**Arquivos:** `routes/webhook.js`
**Status:** ✅ APLICADO
* Registro na nova tabela `payments_log`.
* Validação se workspace e planos listados no checkout batem estritamente com o BD antes do UPDATE.

### 8. [CRÍTICO] "Mock Fiado" em routes/billing.js
**Arquivos:** `routes/billing.js`
**Status:** ✅ APLICADO (Rodada 2)
* O fallback falso (que permitia fazer mock de pagamento sem o Access Token MP) foi deletado e substituído por `503 Service Unavailable`.
* Variável global de ambiente `MERCADOPAGO_ACCESS_TOKEN` para upgrade financeiro sem autorização cruzada também foi removida.

### 9. [CRÍTICO] Webhook Kiwify Desprotegido
**Arquivos:** `routes/webhooks.js`, `middleware/ratelimit.js`, `services/whatsapp.js`
**Status:** ✅ APLICADO (Rodada 2)
* Validação rigorosa `x-kiwify-signature` usando `crypto.timingSafeEqual`.
* Rate limiter de 60req/min implantado via Upstash Redis.
* Extracão do `sendWhatsAppMessage` para novo módulo utilitário contendo timeout 8s e política de retries contra timeout em Vercel.
* Validação Regex em telefone `/^\d{10,13}$/`.

### 10. [MODERADO] PostgreSQL Connection Pool limits & Bug Pgify
**Arquivos:** `db/index.js`
**Status:** ✅ APLICADO (Rodadas 1 e 2)
* Pool maximos alterados para 1 conexão e reduzido Timeout.
* Regex `pgify` ajustado. Consertado bug de retornos polimórficos, forçando `pgify` a retornar somente string.

### 11. [MODERADO] HTTPS forçado
**Arquivos:** `routes/billing.js`
**Status:** ✅ APLICADO
* `req.protocol` sobrescrito para `https` quando `NODE_ENV === 'production'`.

### 12. [MODERADO] Logging Sensível Mascarado (LGPD)
**Arquivos:** `utils/mask.js`, `routes/webhook.js`, `routes/webhooks.js`
**Status:** ✅ APLICADO
* Textos de WhatsApp, e-mails de PIX e telefones de clientes censurados no Stdout (console.log).

### 13. [MODERADO] Rate Limiter Serverless in Memory
**Arquivos:** `middleware/ratelimit.js`, `routes/auth.js`
**Status:** ✅ APLICADO
* Limiter na memória deletado. Rate limit server-wide via `@upstash/ratelimit` implementado.

### 14. [BAIXO] SQL Constraints, Indexes & Cleanup Cron
**Arquivos:** `migrations/2026_security_hardening.sql`, `routes/cron.js`
**Status:** ✅ APLICADO (Rodada 2)
* Added Unique Constraint no `workspace_id + key`. Indexação aplicada em `payments_log`.
* `routes/cron.js` agora purga hooks recebidos após 90 dias previnindo lotação de DB.

---

**Para testar / Subir:**
1. Rodar migrações Supabase manualmente ou via interface com base no `.sql` de Hardening.
2. Atualizar variáveis de ambiente no dashboard da Vercel (`MP_WEBHOOK_SECRET`, `MP_COLLECTOR_ID`, Upstash URLs).
3. Deploy na Vercel: `npx vercel --prod --yes`
