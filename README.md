# Maranet · Central de Tráfego

Dashboard profissional de **Google Ads + Meta Ads** para a NVia Holding — Maranet Telecom.
Sistema full-stack com backend Node.js, banco SQLite, autenticação, metas,
anotações, comparativos MoM/YoY e exportação para PDF/CSV.

---

## Stack

- **Backend** — Node.js 22 + Express 4
- **Banco** — SQLite (via `node:sqlite` nativo — **zero** dependência nativa compilada)
- **Auth** — JWT em cookie httpOnly + bcrypt
- **Frontend** — HTML + CSS + ES Modules + Chart.js (carregado via CDN)

Apenas 5 dependências npm, todas em puro JavaScript: `express`, `bcryptjs`,
`cookie-parser`, `jsonwebtoken`, `dotenv`.

---

## Instalação

Requer **Node.js 22.5+** (para o módulo nativo `node:sqlite`).

```bash
cd sistrafego
cp .env.example .env        # ajuste o JWT_SECRET e a senha admin
npm install
npm run seed                # cria usuário admin e 2.9k linhas de dados de exemplo
npm start                   # sobe em http://localhost:3000
```

Credenciais padrão do seed (altere em `.env` antes do primeiro `seed`):
- **usuário:** `admin`
- **senha:** `maranet2026`

---

## Scripts npm

| Comando         | O que faz |
|-----------------|-----------|
| `npm start`     | Sobe o servidor na porta `PORT` (default 3000). |
| `npm run dev`   | Mesma coisa, com `--watch` (auto-reload). |
| `npm run seed`  | Cria usuário admin, 6 campanhas, ~2.900 linhas diárias (jan/25 a abr/26), metas e notas de exemplo. Idempotente — pula o que já existe. |
| `npm run reset` | **Apaga o banco.** Rode `npm run seed` depois para recriar. |

---

## Estrutura de pastas

```
sistrafego/
├── server.js                  # Express entrypoint
├── db/
│   ├── schema.sql             # DDL (users, campaigns, metrics_daily, goals, notes)
│   ├── index.js               # conexão com compat shim (pragma + transaction)
│   ├── seed.js                # dados de exemplo realistas
│   └── reset.js               # apaga o banco
├── middleware/
│   └── auth.js                # JWT + requireAuth / requireAdmin
├── routes/
│   ├── auth.js                # /api/auth  (login, logout, me)
│   ├── campaigns.js           # /api/campaigns (CRUD)
│   ├── metrics.js             # /api/metrics  (CRUD + agregações + KPIs)
│   ├── goals.js               # /api/goals    (CRUD)
│   ├── notes.js               # /api/notes    (CRUD)
│   └── settings.js            # /api/settings (branding)
├── public/
│   ├── login.html
│   ├── index.html             # dashboard principal
│   ├── css/styles.css
│   └── js/
│       ├── api.js             # wrapper fetch → backend
│       ├── utils.js           # formatadores, datas, toast
│       ├── kpis.js            # cards com MoM, YoY, semáforo de metas
│       ├── charts.js          # 4 gráficos Chart.js
│       ├── tables.js          # detalhe por mês + ranking por campanha
│       ├── modals.js          # entrada de dados, campanhas, metas, notas
│       ├── export.js          # PDF (print-to-pdf), CSV, backup JSON
│       └── app.js             # orquestrador
└── .env.example
```

---

## Funcionalidades

### Filtros
- Ano (dropdown), mês específico (dropdown), 1º/2º semestre, ano todo.
- Canal: Consolidado, Google Ads, Meta Ads.

### KPIs
Cada card traz:
- **Valor absoluto** do período.
- **Δ vs período anterior** (MoM para mês, SoS para semestre, YoY para ano).
- **Δ vs mesmo período do ano anterior** (YoY).
- **Semáforo de meta** (verde/amarelo/vermelho) quando há meta cadastrada,
  com direção `mínimo` (precisa alcançar) ou `máximo` (não ultrapassar).

Métricas: Impressões, Cliques, CTR, Conversões, Investimento, CPL, CPC, Tx Conversão, ROAS.

### Gráficos
- **Impressões por Mês** — barras Google vs Meta (respeita o canal filtrado).
- **Distribuição de Verba** — doughnut Google vs Meta.
- **Cliques & CTR** — barras + linha eixo duplo.
- **Conversões** — linhas empilhadas por canal.

### Tabelas
- **Detalhamento Mês × Canal** — uma linha por combinação, com indicador `•` se houver anotação.
- **Ranking de Campanhas** — ordenadas por investimento, com barra de gasto relativa, CPL e ROAS.

### Gestão (modais)
- **Campanhas** — criar / renomear / marcar pausada-encerrada / excluir.
- **Metas** — cadastrar por (ano, mês, canal, métrica) com alvo e direção.
- **Anotações** — observações por (ano, mês, dia opcional, canal), com tag e texto. Aparecem como bolinha na tabela de detalhe.
- **Inserir Dados** — dois modos:
  - **Por mês** — consolida o período inteiro em uma linha diária (dia 15) por campanha. Bom para importar agregado do Looker.
  - **Por dia** — granularidade diária para uma campanha específica. Permite quem usa Google Ads Editor + CSV diário.

### Exportações
- **PDF** — usa o diálogo nativo de impressão (Cmd/Ctrl+P → "Salvar como PDF"). CSS dedicado para impressão já está aplicado.
- **CSV** — exporta a tabela de detalhamento atual (1 linha por mês × canal) com colunas numéricas prontas para Excel.
- **JSON backup** — dump completo (campanhas, metas, notas, métricas diárias) — útil para arquivar ou migrar.

### Modo apresentação
Clique em **▶ Apresentar** no cabeçalho. Oculta botões operacionais e aumenta os KPIs. Boa para reunião com a diretoria sem fechar a tela.

---

## API (referência rápida)

Todas as rotas exigem cookie `auth` (obtido via `/api/auth/login`), exceto `/api/auth/login` e `/api/health`.

| Método | Rota | Descrição |
|--------|------|-----------|
| POST   | `/api/auth/login`                          | `{ username, password }` |
| POST   | `/api/auth/logout`                         | limpa cookie |
| GET    | `/api/auth/me`                             | usuário logado |
| GET    | `/api/campaigns`                           | `?channel=google&status=active` |
| POST   | `/api/campaigns`                           | cria campanha |
| PATCH  | `/api/campaigns/:id`                       | atualiza |
| DELETE | `/api/campaigns/:id`                       | remove (em cascata) |
| GET    | `/api/metrics/daily`                       | `?from=&to=&channel=&campaign_id=` |
| POST   | `/api/metrics/daily`                       | upsert uma linha |
| POST   | `/api/metrics/bulk`                        | upsert em lote |
| DELETE | `/api/metrics/daily/:id`                   | apaga uma linha |
| GET    | `/api/metrics/monthly?year=2026`           | 1 linha por mês × canal |
| GET    | `/api/metrics/summary?year=2026&month=4`   | diário do mês; sem `month` → anual por canal |
| GET    | `/api/metrics/by-campaign?year=&month=`    | agregado por campanha |
| GET    | `/api/metrics/kpis?year=&month=&channel=`  | totais + previous + yoy |
| GET/POST/DELETE | `/api/goals`                      | metas mensais |
| GET/POST/DELETE | `/api/notes`                      | anotações |
| GET/PUT | `/api/settings`                           | chave/valor (branding) |
| GET    | `/api/health`                              | liveness check |

---

## Modelo de dados

- **users** — `id, username, password_hash, display_name, role('admin'|'viewer')`
- **campaigns** — `id, channel('google'|'meta'), name, objective, status, color`
- **metrics_daily** — `id, campaign_id, date, impressions, clicks, conversions, spend, revenue`
  - chave única `(campaign_id, date)`
- **goals** — `id, year, month, channel('google'|'meta'|'all'), metric, target, direction('min'|'max')`
  - chave única `(year, month, channel, metric)`
- **notes** — `id, year, month, day?, channel?, text, tag`

---

## Deploy / Produção

Para uso na web:

1. Ponha atrás de um proxy HTTPS (Nginx, Caddy, Cloudflare Tunnel).
2. No `middleware/auth.js` (`routes/auth.js`), mude `secure: false` para `secure: true` no cookie.
3. Troque `JWT_SECRET` por um valor forte (`openssl rand -hex 32`).
4. Se for expor na internet, considere trocar a auth para SSO da sua organização.
5. Back-up do banco: o arquivo `db/maranet.db` é tudo que importa. Faça snapshot dele periodicamente.

Para uso local (rede interna):

1. `npm start` e pronto — acesse de qualquer máquina via `http://IP-DA-MAQUINA:3000`.
2. Para auto-start no boot do mac: crie um LaunchAgent apontando para `npm --prefix /caminho/do/sistrafego start`.

---

## Licença

Uso interno NVia Holding · Maranet Telecom.
