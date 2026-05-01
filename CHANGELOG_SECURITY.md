# CHANGELOG SECURITY 🔒 (30 Abril 2026)

Este documento detalha todas as correções cirúrgicas de segurança e arquitetura aplicadas com base na auditoria do Claude 4.7 Opus.

### 1. [CRÍTICO 01] Webhook MP HMAC Validation 
**Arquivos:** `routes/webhook.js`
**Status:** ✅ APLICADO
* Implementada verificação via header `x-signature` (HMAC sha256).
* Adicionada validação do `collector_id`, `transaction_amount` exato (com 0.01 de tolerância) e moeda BRL.

### 2. [CRÍTICO 02] Idempotência nos Webhooks
**Arquivos:** `migrations/2026_security_hardening.sql`, `routes/webhook.js`
**Status:** ✅ APLICADO
* Tabela `webhook_events` criada. Inserção controlada antes da lógica de negócios para evitar duplicidades silenciosas (falha `UNIQUE`).

### 3. [CRÍTICO 03] CRM Webhook Fallback Inseguro
**Arquivos:** `routes/webhook.js`
**Status:** ✅ APLICADO
* Removido qualquer acesso por fallback (workspace=1) no webhook de vendas do CRM.

### 4. [CRÍTICO 04] Webhook WhatsApp - Rate Limiting & Token Url
**Arquivos:** `routes/webhook.js`, `middleware/ratelimit.js`
**Status:** ✅ APLICADO
* Transformada rota em `/:token` e verificação no BD invés de query param `workspace`.
* Integrado Ratelimiter serverless Upstash. Tokens gerados via SQL migration.

### 5. [CRÍTICO 05] PIX Ghost Checkout - Tracking e Idempotência
**Arquivos:** `routes/webhook.js`
**Status:** ✅ APLICADO
* Geração do MercadoPago via webhook agora usa `X-Idempotency-Key` único.
* E-mail e external_reference ajustados de forma atrelada ao celular para facilitar auditoria.

### 6. [CRÍTICO 06] Fire-and-Forget no Poltergeist HTTP
**Arquivos:** `services/poltergeist.js`, `routes/poltergeist.js`, `routes/webhook.js`
**Status:** ✅ APLICADO
* Transformada a rota em wrapper. O serviço interno agora é chamado diretamente via código para prevenir corte prematuro de execução (Vercel Lambdas).

### 7. [CRÍTICO 07] Log e Validação do Target Workspace
**Arquivos:** `routes/webhook.js`
**Status:** ✅ APLICADO
* Registro na nova tabela `payments_log`.
* Validação se workspace e planos listados no checkout batem estritamente com o BD antes do UPDATE.

### 8. [MODERADO 08] Rate Limiter Serverless in Memory
**Arquivos:** `middleware/ratelimit.js`, `routes/auth.js`, `package.json`
**Status:** ✅ APLICADO
* Limiter na memória deletado. Rate limit server-wide via `@upstash/ratelimit` implementado no Login para combater bruteforce.

### 9. [MODERADO 09] Postgres Connection Pool limits
**Arquivos:** `db/index.js`
**Status:** ✅ APLICADO
* Pool maximos alterados para 1 conexão e reduzido Timeout. Regex `pgify` ajustado.
* Adicionado warning para portas transaction pooler (6543).

### 10. [MODERADO 10] API Timeouts
**Arquivos:** `routes/webhook.js`
**Status:** ✅ APLICADO
* Injetado Axios/SDK timeouts (8s) e retries em ElevenLabs, WhatsApp API e MP para prevenir timeouts secos do lambda da Vercel (10s Hobby).

### 11. [MODERADO 11] HTTPS forçado
**Arquivos:** `routes/billing.js`
**Status:** ✅ APLICADO
* `req.protocol` sobrescrito para `https` quando `NODE_ENV === 'production'`.

### 12. [MODERADO 12] Logging Sensível Mascarado (LGPD)
**Arquivos:** `utils/mask.js`, `routes/webhook.js`
**Status:** ✅ APLICADO
* Textos de WhatsApp, e-mails de PIX e telefones de clientes censurados no Stdout (console.log).

### 13. [MODERADO 13] JSON Express Body Limit (DoS)
**Arquivos:** `server.js`
**Status:** ✅ APLICADO
* Global reduzido de `50mb` para `1mb`. Exceção restrita à rota de importação de arquivos via middleware embutido.

### 14. [BAIXO 14] Security headers / Expiration
**Arquivos:** `server.js`, `routes/auth.js`
**Status:** ✅ APLICADO
* Adicionado Content-Security-Policy (CSP) nas landing pages `/f/:slug`.
* Link de diretoria do Painel reduzido de 30 para 7 dias. Process.exit() proibido na inicialização do Lambda serverless.

---

**Para testar / Subir:**
1. Rodar migrações Supabase manualmente ou via interface com base no `.sql` de Hardening.
2. Atualizar variáveis de ambiente no dashboard da Vercel.
3. Deploy na Vercel: `npx vercel --prod --yes`
