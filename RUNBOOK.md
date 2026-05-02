# NEXUS OS — Runbook Operacional

Guia para você (Daniel) ou qualquer pessoa que precise debugar, operar
ou recuperar o sistema. Não é documentação de código — é manual de bombeiro.

---

## 🚨 Em incidente: por onde começar

### O site está fora do ar / retornando 500

1. **Veja Vercel Runtime Logs** primeiro:
   https://vercel.com/maranet/nexus-os/logs

2. **Roda os health checks granulares** (vão te dizer onde está o gargalo):
   ```bash
   curl https://nexusagencia.app/api/health/ready    # agregado
   curl https://nexusagencia.app/api/health/db       # Postgres
   curl https://nexusagencia.app/api/health/redis    # Upstash
   curl https://nexusagencia.app/api/health/mp       # Mercado Pago config
   ```

3. **Olha o Sentry** se SENTRY_DSN está configurado. Filtra pelo último deploy.

4. **Smoke tests** pra confirmar regressão:
   ```bash
   npm run test:smoke:prod
   ```

### Cliente reclama que não consegue logar

- Bate `/api/health/redis` — se Upstash estiver fora, rate limiter passa direto
  (fail-open), mas pode ter outro problema.
- Verifica se ele esgotou as 10 tentativas: o rate limit é por IP em janela de 15min.
- Olhar `audit_log` pra ver se houve atividade suspeita.

### Webhook do Mercado Pago não está chegando

1. Verifica que `MP_WEBHOOK_SECRET` e `MP_COLLECTOR_ID` estão setados em prod.
2. Testa manualmente com smoke test (deve retornar 401 Missing Signature).
3. Confere no painel do MP > Webhooks > status do endpoint.

### Webhook da Kiwify não funciona

- Por workspace, é necessário `kiwify.webhook.secret` em `workspace_settings`:
  ```sql
  INSERT INTO workspace_settings (workspace_id, key, value)
  VALUES (:wsId, 'kiwify.webhook.secret', :secret)
  ON CONFLICT (workspace_id, key) DO UPDATE SET value = EXCLUDED.value;
  ```
- A Kiwify assina o RAW body com SHA-1. O server.js captura `req.rawBody` para
  webhooks Kiwify automaticamente.

### Mensagens do WhatsApp pararam de chegar

- Verifica que o `whatsapp.webhook.token` do workspace está correto.
- A URL configurada na Evolution/Z-API deve ser:
  `https://nexusagencia.app/api/webhook/whatsapp/<TOKEN_DO_WORKSPACE>`
- Se o número foi banido pela Meta, é necessário trocar de chip e atualizar
  `wa_settings.api_url` e `api_token` do workspace.

---

## 🛠️ Operações rotineiras

### Adicionar nova env var em produção

1. Vercel > Settings > Environment Variables > Add New
2. Marca apenas **Production** (não preview/development)
3. Salva
4. **Redeploy é necessário**: Deployments > último > ⋯ > Redeploy
   (mantém Build Cache marcado, é mais rápido)

### Rodar migration SQL no Supabase

1. Cola o SQL no SQL Editor: https://supabase.com/dashboard/project/tnmxoavqcuirsceefqed/sql/new
2. Roda
3. Faz commit do arquivo SQL em `migrations/` para histórico

### Gerar tokens de WhatsApp para workspaces existentes

```bash
# Local, com .env apontando pra DATABASE_URL de produção
node scripts/generate-wa-tokens.js
# Distribui o tokens-wa.json gerado e depois:
shred -u tokens-wa.json
```

### Limpar webhook_events antigos manualmente

Já tem cron diário em `/api/cron/alerts` que remove > 90 dias, mas se precisar:

```sql
DELETE FROM webhook_events WHERE processed_at < NOW() - INTERVAL '90 days';
```

---

## 📊 Monitoramento

### Sentry (recomendado)

1. Cria projeto Node.js em https://sentry.io (free tier)
2. Adiciona `SENTRY_DSN` nas env vars da Vercel
3. Redeploy
4. Erros 5xx aparecem automaticamente, com stack trace e contexto

### UptimeRobot (recomendado, grátis)

1. Cria conta em https://uptimerobot.com
2. Adiciona monitor HTTP(s):
   - URL: `https://nexusagencia.app/api/health/ready`
   - Interval: 5 minutos
   - Alert contacts: seu email + WhatsApp
3. Quando ficar 2 falhas consecutivas, ele te avisa

### Logs estruturados na Vercel

Todos os logs em produção saem como JSON em uma linha. Filtros úteis:

- Erros de webhook MP: busca `[FRAUDE-MP]` ou `webhook MP falhou`
- Falhas do Sentinel: busca `level:"error"` + `path:"/api/sentinel"`
- Brute force: busca `Muitas tentativas de login`
- Auditoria: busca `audit:`

---

## 🚀 Deploy

### Fluxo padrão

1. Branch nova: `git checkout -b feat/algo`
2. Mexe, commita, push
3. PR no GitHub → Vercel cria preview deploy
4. Smoke tests rodam em CI (`.github/workflows/ci.yml`)
5. Merge → Vercel deploya pra produção
6. Smoke tests rodam DE NOVO contra `nexusagencia.app` (job smoke-prod)
7. Se algum falhar, abre issue automaticamente

### Rollback de produção

A Vercel mantém histórico de todos os deploys:
1. https://vercel.com/maranet/nexus-os/deployments
2. Acha o último deploy que estava funcionando
3. ⋯ → Promote to Production

Demora ~30s. Não há perda de dados (banco é separado do código).

---

## 🔐 Segredos importantes (NÃO commitar)

Lista de tudo que precisa estar configurado em produção:

| Env Var | Onde obter | Crítico? |
|---------|-----------|----------|
| `DATABASE_URL` | Supabase > Settings > Database > Connection (use porta 6543) | 🔴 SIM |
| `JWT_SECRET` | `openssl rand -hex 32` | 🔴 SIM |
| `MP_WEBHOOK_SECRET` | MercadoPago > Apps > Webhooks > Assinatura secreta | 🔴 SIM |
| `MP_COLLECTOR_ID` | MercadoPago > Detalhes da aplicação > User ID | 🔴 SIM |
| `UPSTASH_REDIS_REST_URL` | Upstash > Database > REST API | 🟡 IMPORTANTE |
| `UPSTASH_REDIS_REST_TOKEN` | Idem | 🟡 IMPORTANTE |
| `CRON_SECRET` | `openssl rand -hex 32` | 🟡 IMPORTANTE |
| `SENTRY_DSN` | Sentry > Project > Client Keys | 🟢 RECOMENDADO |
| `NODE_ENV` | `production` | 🔴 SIM |

Crítico = sem ele o sistema quebra ou tem furo de segurança grave.
Importante = sem ele tem perda de funcionalidade mas sistema sobe.
Recomendado = sem ele você não vê erros automaticamente.

---

## 📐 Arquitetura simplificada

```
┌─────────────────────────────────────────────────┐
│              nexusagencia.app                    │
│              (Vercel Edge + CDN)                 │
└─────────────┬───────────────────────────────────┘
              │
       ┌──────▼──────┐
       │  Vercel     │  ← server.js (Express, serverless function)
       │  Lambda     │
       └──┬───┬───┬──┘
          │   │   │
    ┌─────┘   │   └─────┐
    │         │         │
    ▼         ▼         ▼
┌───────┐ ┌───────┐ ┌─────────┐
│Postgres│ │Redis  │ │Sentry   │  ← APIs externas
│Supabase│ │Upstash│ │(opt-in) │
└───────┘ └───────┘ └─────────┘
              ┌─────────────────┐
              │ APIs externas:  │
              │ - Meta Ads      │
              │ - Google Ads    │
              │ - Mercado Pago  │
              │ - Anthropic     │
              │ - Gemini        │
              │ - ElevenLabs    │
              │ - Z-API/Evolution│
              └─────────────────┘
```

---

## 📞 Contato em incidente fora do horário

- Daniel Neves (CEO/Tech): suporte@nexusagencia.app (substitua pelo seu canal)
- Vercel Status: https://www.vercel-status.com/
- Supabase Status: https://status.supabase.com/
- Mercado Pago Status: https://status.mercadopago.com/
