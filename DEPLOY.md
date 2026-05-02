# Deploy: Supabase + Vercel — Nexus OS

> **Status do código:** ✅ 100% migrado para PostgreSQL/Vercel  
> **Próximo passo:** Configurar Supabase e fazer deploy na Vercel

---

## 1. Preparar o Supabase

### 1.1 Criar projeto no Supabase
1. Acesse [supabase.com](https://supabase.com) → **New Project**
2. Escolha região: **South America (São Paulo)** — `aws-0-sa-east-1`
3. Anote a **senha do banco** (você usará na `DATABASE_URL`)

### 1.2 Obter a Connection String
1. No painel Supabase → **Settings** → **Database**
2. Copie a **Transaction pooler** connection string (porta **6543**):
   ```
   postgresql://postgres.[ref]:[senha]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
   ```
   > **Use a porta 6543 (Transaction pooler)** para Vercel Serverless.  
   > Não use a porta 5432 direta — Vercel não suporta conexões persistentes.

### 1.3 Aplicar o schema
No seu terminal local, com o `.env` configurado:

```bash
# 1. Crie o .env a partir do exemplo
cp .env.example .env

# 2. Preencha DATABASE_URL com a connection string acima
# Edite o .env e ajuste DATABASE_URL, JWT_SECRET, etc.

# 3. Aplique o schema no Supabase
npm run db:migrate

# Deve imprimir:
# ✓ Schema aplicado com sucesso!
# Tabelas criadas: users, campaigns, metrics_daily, goals, notes, settings, ...
```

### 1.4 Popular com dados de exemplo (opcional)
```bash
npm run seed

# Cria usuário admin/nexus2026 e 20 meses de dados de demonstração
```

---

## 2. Configurar variáveis de ambiente

Crie o arquivo `.env` local (nunca commite!):

```env
DATABASE_URL=postgresql://postgres.[ref]:[senha]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
JWT_SECRET=<gere com: openssl rand -hex 32>
JWT_EXPIRES=7d
NODE_ENV=production
CRON_SECRET=<gere com: openssl rand -hex 16>

# SMTP (Gmail) para alertas de e-mail
SMTP_USER=seu@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
SMTP_FROM=Nexus OS <seu@gmail.com>

# Google Ads (opcional)
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_REFRESH_TOKEN=
GOOGLE_ADS_CUSTOMER_ID=

# Meta Ads (opcional)
META_ACCESS_TOKEN=
META_AD_ACCOUNT_ID=act_
```

### Teste local
```bash
npm start
# Abra: http://localhost:3000
# Login: admin / nexus2026
```

---

## 3. Publicar no GitHub

```bash
# Na pasta do projeto
git init
git add .
git commit -m "feat: migração completa SQLite→PostgreSQL + setup Vercel"
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

---

## 4. Deploy na Vercel

### 4.1 Conectar o repositório
1. Acesse [vercel.com](https://vercel.com) → **Add New Project**
2. Importe o repositório GitHub criado acima
3. Framework: **Other** (não é Next.js)
4. Build Command: `npm run vercel-build`
5. Output Directory: deixe em branco

### 4.2 Configurar Environment Variables na Vercel
Em **Settings → Environment Variables**, adicione todas as variáveis do passo 2:

| Variável | Valor |
|----------|-------|
| `DATABASE_URL` | `postgresql://postgres.[ref]:...@...6543/postgres` |
| `JWT_SECRET` | string aleatória (32+ chars) |
| `JWT_EXPIRES` | `7d` |
| `NODE_ENV` | `production` |
| `CRON_SECRET` | string aleatória (16+ chars) |
| `SMTP_USER` | (opcional) |
| `SMTP_PASS` | (opcional) |
| `SMTP_FROM` | (opcional) |

### 4.3 Fazer o deploy
```bash
npx vercel --prod
```

Ou simplesmente aguarde o deploy automático após o push no GitHub.

---

## 5. Verificação pós-deploy

```bash
# Health check
curl https://[seu-projeto].vercel.app/api/health
# Esperado: {"ok":true,"ts":...,"node":"v20.x.x"}

# Teste de login via API
curl -X POST https://[seu-projeto].vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"nexus2026"}'
# Esperado: {"ok":true,"user":{...}}
```

Abra `https://[seu-projeto].vercel.app` no navegador e faça login.

---

## Arquitetura do Deploy

```
Vercel CDN
├── /                → public/index.html (protegido)
├── /login           → public/login.html
├── /public/*        → arquivos estáticos (HTML, CSS, JS, imagens)
└── /api/*           → api/index.js → server.js → routes/*
                              ↓
                         Supabase PostgreSQL
                    (aws-0-sa-east-1.pooler, porta 6543)
```

### Cron Jobs (Vercel)
Configurado em `vercel.json`:
```json
{ "path": "/api/cron/alerts", "schedule": "0 11 * * *" }  // 8h BRT
```
A Vercel chama este endpoint diariamente — protegido por `CRON_SECRET`.

---

## Manutenção

### Resetar dados de tráfego (mantém usuários)
```bash
npm run reset
```

### Aplicar nova migration de schema
```bash
npm run db:migrate
```

### Logs
- Vercel: Dashboard → Functions → Logs
- Local: pasta `logs/` (excluída do git)
