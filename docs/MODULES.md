# Módulos do Nexus OS

Catálogo completo dos 16 módulos de negócio + 4 módulos de infraestrutura. Pra cada um: o que faz, arquivos-chave, endpoints principais, tabelas envolvidas, dependências externas.

> **Endpoints completos:** [`docs/auto/API.md`](auto/API.md) (gerado automaticamente)
> **Schema completo:** [`docs/auto/SCHEMA.md`](auto/SCHEMA.md) (gerado automaticamente)

---

## Índice

### Operação autônoma de tráfego
1. [Sentinel](#1-sentinel) · [Launcher](#2-launcher) · [Hive](#3-hive)

### Prospecção
4. [Skynet](#4-skynet) · [Market](#5-market)

### Vendas autônomas
6. [Doppelgänger](#6-doppelgänger) · [Vending](#7-vending) · [Checkout](#8-checkout--ghost-checkout)

### Recuperação
9. [Lazarus](#9-lazarus)

### Geração de assets
10. [Forge](#10-forge) · [Studio](#11-studio) · [Vision](#12-vision)

### Operação física
13. [Poltergeist](#13-poltergeist)

### Inteligência estratégica
14. [Titan](#14-titan) · [Empire](#15-empire) · [Franchise](#16-franchise)

### Infraestrutura
- [Auth](#auth) · [Audit](#audit) · [Billing](#billing) · [Settings + Workspaces](#settings--workspaces)

---

## 1. Sentinel · Monitor de Campanhas Meta
**O que faz:** Monitor autônomo de campanhas Meta Ads. A cada 15 minutos puxa métricas via API (CPA, CTR, ROAS, conversões) e o Gemini decide pra cada ad set se PAUSA, ESCALA ou MANTÉM. Executa a ação direto via API, sem humano. 3 níveis de tolerância configuráveis (frio/morno/quente) por workspace.

**Trigger:** Vercel Cron `*/15 * * * *` → `GET /api/sentinel/cron`

**Arquivos:**
- [routes/sentinel.js](../routes/sentinel.js) — endpoint do cron + configuração
- [public/sentinel.html](../public/sentinel.html) — UI de configuração
- [public/js/sentinel.js](../public/js/sentinel.js) — front

**DB:** Lê `meta_campaigns_cache`, `workspace_settings` (chaves `meta.adAccountId`, `meta.accessToken`, `sentinel.risk_level`). Grava decisões em `audit_log` (`sentinel.action.paused/scaled/kept`).

**Dependências externas:** Meta Marketing API · Gemini 2.5 Flash (LOW complexity)

**Endpoints relevantes:**
- `GET  /api/sentinel/cron` — execução agendada (auth via `CRON_SECRET`)
- `GET  /api/sentinel/config` — pega config do workspace
- `POST /api/sentinel/config` — atualiza tolerância e regras
- `GET  /api/sentinel/log` — histórico de decisões

**Customização:** A persona de "analista" pode ser ajustada em `workspace_settings.sentinel.persona_prompt`.

---

## 2. Launcher · Lançador de Campanhas
**O que faz:** Sobe campanhas Meta novas via API com estrutura pré-validada por nicho (estética, dentista, advocacia, etc). IA monta o copy, escolhe interesses de segmentação, define orçamento.

**Trigger:** Manual via UI ou via Vending Machine.

**Arquivos:**
- [routes/launcher.js](../routes/launcher.js)
- [public/launcher.html](../public/launcher.html)

**Dependências:** Meta Marketing API · OmniRouter (MEDIUM)

**Endpoints relevantes:**
- `POST /api/launcher/build` — gera blueprint sem subir
- `POST /api/launcher/deploy` — sobe ao Meta
- `GET  /api/launcher/templates` — templates de nicho

---

## 3. Hive · Inteligência Coletiva
**O que faz:** "Mente de Colmeia". Coleta anomalias de alta conversão observadas em todos os workspaces da rede, IA extrai padrões e gera um boletim com lições + sugestões pra replicar nas campanhas do usuário hoje.

**Arquivos:**
- [routes/hive.js](../routes/hive.js) — agrega anomalias e roda Gemini Flash
- [public/hive.html](../public/hive.html)

**DB:** Lê `workspace_settings` com chaves `hive.anomaly.%` (anomalias capturadas pelo Sentinel).

**Endpoints:**
- `GET /api/hive/pulse` — boletim diário com 3 insights

---

## 4. Skynet · Prospecção em Massa
**O que faz:** Prospecção em massa. Recebe nicho + cidade, busca empresas no Google Maps Places API, IA analisa o site/Instagram de cada lead (modo "Oráculo" aponta falhas reais), gera mensagem personalizada e dispara via WhatsApp (texto ou áudio sintetizado pela ElevenLabs).

**Trigger:** Manual ou Vercel Cron `0 9 * * *` (campanhas de prospecção diárias).

**Arquivos:**
- [routes/skynet.js](../routes/skynet.js)
- [public/skynet.html](../public/skynet.html)

**DB:** `prospects`, `prospect_messages`, `wa_settings` (config WhatsApp por workspace).

**Dependências:** Google Places API · OmniRouter (MEDIUM/HIGH) · ElevenLabs · Evolution/Z-API (WhatsApp)

---

## 5. Market · Marketplace de Leads
**O que faz:** Marketplace de leads em leilão automático. Workspaces que não conseguem responder leads no prazo viram fornecedores, outros viram compradores. Match e cobrança automáticos.

**Arquivos:**
- [routes/market.js](../routes/market.js)
- [public/market.html](../public/market.html)

**DB:** `market_listings`, `market_bids`, `market_transactions`.

**Status:** Em produção, baixo volume. Flag conceitual.

---

## 6. Doppelgänger · Vendedor IA Clone
**O que faz:** Vendedor IA que conversa no WhatsApp imitando uma persona configurada por workspace. Detecta intenção de compra na conversa e injeta a tag `[GERAR_PIX]`, que o webhook intercepta e cobra via Mercado Pago direto na conversa (Ghost Checkout).

**Configurável por workspace** via `workspace_settings`:
- `doppelganger.persona_name` — ex: "Marina da Bella Pele"
- `doppelganger.persona_bio` — ex: "Sócia da clínica Bella Pele em SP, 8 anos de experiência"
- `doppelganger.persona_traits` — tom, gírias, estilo

**UI de configuração:** [/doppelganger](../public/doppelganger.html) — form em cima do chat de teste.

**Arquivos:**
- [routes/doppelganger.js](../routes/doppelganger.js) — chat + GET/PUT persona
- [routes/webhook.js](../routes/webhook.js) (linhas ~140-170) — quando `toggle.doppelganger=true`, usa a mesma persona pra responder webhooks reais do WhatsApp

**Dependências:** OmniRouter (MEDIUM, prefere Claude Sonnet 4.6) · Mercado Pago · Evolution/Z-API

**Endpoints:**
- `POST /api/doppelganger/chat` — chat de teste
- `GET  /api/doppelganger/persona` — persona atual + defaults
- `PUT  /api/doppelganger/persona` — atualiza (admin only)

---

## 7. Vending · Auto-Atendimento
**O que faz:** Self-service de campanha. Cliente entra no site público, escolhe nicho, paga (Mercado Pago), e em 5 minutos recebe campanha rodando + WhatsApp configurado. Onboarding 100% automatizado.

**Arquivos:**
- [routes/vending.js](../routes/vending.js)
- [public/vending.html](../public/vending.html) — UI admin

**Fluxo:**
1. Pagamento aprovado (webhook MP) → cria workspace → roda Launcher pra subir campanha
2. Notifica cliente via WhatsApp ("seu robô de vendas está rodando, parceiro")
3. `audit_log: payment.vending.completed`

---

## 8. Checkout + Ghost Checkout

**O que faz:**
- **Checkout** ([public/checkout/](../public/checkout/)): página pública de venda direta dos planos (Growth, Elite).
- **Ghost Checkout** (parte do Doppelgänger): geração de PIX dentro da conversa de WhatsApp. Cliente nem sai do app.

**Arquivos:**
- [routes/checkout.js](../routes/checkout.js) — cria preferência MP
- [routes/webhook.js](../routes/webhook.js) — recebe confirmação de pagamento (HMAC SHA-256)
- [routes/webhooks.js](../routes/webhooks.js) — webhook Kiwify (HMAC SHA-1)

**DB:** `payments_log`, `webhook_events` (idempotência), `workspace_billing` (plano + limites).

**Validações anti-fraude:**
- HMAC obrigatório
- `currency_id === 'BRL'` (rejeita moedas estranhas)
- Idempotência por `external_id`

---

## 9. Lazarus · Recuperação de Leads
**O que faz:** "Ressurreição" de leads/carrinhos. Detecta:
- Carrinhos abandonados (sem pagamento em 30 min)
- Leads frios (>14 dias sem resposta)

IA escreve mensagem empática contextualizada com o histórico do lead (não é template genérico) e dispara via WhatsApp.

**Trigger:** Vercel Cron `*/15 * * * *` → `GET /api/lazarus/cron`

**Arquivos:**
- [routes/lazarus.js](../routes/lazarus.js)
- [public/lazarus.html](../public/lazarus.html)

**Dependências:** OmniRouter (MEDIUM) · ElevenLabs (áudio opcional) · Evolution/Z-API

---

## 10. Forge · Construtor de Landing Pages
**O que faz:** Gera landing pages completas via IA. Diferencial: a headline da LP é **dinâmica** e muda baseada no `utm_term` do anúncio que trouxe o visitante. Mesma LP, mil headlines.

**Arquivos:**
- [routes/forge.js](../routes/forge.js)
- [public/forge.html](../public/forge.html) — UI de criação
- Slug público: `/f/<slug>` renderiza a LP

**DB:** `funnels` (id, slug, name, niche, html, visits).

**Endpoints:**
- `POST /api/forge/generate` — IA gera HTML baseado em nicho
- `GET  /api/forge/list` — lista LPs do workspace
- `GET  /f/:slug` — renderização pública (substitui placeholders por UTMs)

**Dependências:** OmniRouter (MEDIUM/HIGH)

---

## 11. Studio · Estúdio de Voz
**O que faz:** Clonagem de voz + síntese de áudio via ElevenLabs. Gera áudio personalizado pra disparar em WhatsApp (Lazarus, Skynet) ou pra usar em VSLs.

**Arquivos:**
- [routes/studio.js](../routes/studio.js)
- [public/studio.html](../public/studio.html)

**Configuração:** `workspace_settings.elevenlabs.apiKey` + `elevenlabs.voiceId` (default Sarah `EXAVITQu4vr4xnSDxMaL`).

**Endpoints:**
- `POST /api/studio/audio` — texto → MP3 base64
- `POST /api/studio/video` — VSL via HeyGen (em dev)

---

## 12. Vision · Análise de Criativos
**O que faz:** Engenharia reversa visual de criativos. Recebe URL/imagem, IA descreve cores, tipografia, layout, copy, gancho. Útil pra entender por que o criativo do concorrente performa.

**Arquivos:**
- [routes/vision.js](../routes/vision.js)
- Chrome extension `chrome-extension/` ("Nexus Spy") salva criativos da Biblioteca FB direto no Empire.

**Dependências:** Gemini 2.5 Pro Vision · OpenAI GPT-4o Vision

---

## 13. Poltergeist · Operação Física Autônoma
**O que faz:** Operação física headless. Quando uma venda fecha (ex: pizzaria, açaí), Poltergeist:
1. Dispara comanda direto na impressora térmica (via API cloud)
2. Chama motoboy via Uber Direct ou Lalamove
3. Notifica cliente do andamento

Loja sem operador humano.

**Arquivos:**
- [services/poltergeist.js](../services/poltergeist.js)
- [routes/poltergeist.js](../routes/poltergeist.js)
- [public/poltergeist.html](../public/poltergeist.html)

**Status:** Funcional em dev. Em produção depende de impressora ZPL com IP público.

---

## 14. Titan · Auditor Estratégico
**O que faz:** "CEO Autônomo". Auditoria estratégica do workspace:
1. Audita saldo Mercado Pago
2. Identifica nicho mais lucrativo do momento via OmniRouter
3. Gera blueprint completo de novo spin-off (marca, produto, copy, meta de ROAS, plano de mídia)

Roda quando o usuário quer "expandir" — Titan fala onde investir o caixa.

**Arquivos:**
- [routes/titan.js](../routes/titan.js)
- [public/titan.html](../public/titan.html)

**Dependências:** OmniRouter (HIGH — Claude Opus ou GPT-4o) · API Mercado Pago

**Endpoint:** `POST /api/titan/audit`

---

## 15. Empire · Gestão de Tarefas
**O que faz:** Kanban interno do workspace. Tasks, status, prioridade. Espionagem de criativos vinda do Chrome extension "Nexus Spy" também aterrissa aqui (board "Raio-X").

**Arquivos:**
- [routes/empire.js](../routes/empire.js)
- [public/empire.html](../public/empire.html)

**DB:** `empire_tasks`, `empire_spy_creatives`.

---

## 16. Franchise · Sistema de Franquias
**O que faz:** Sistema de franquias do próprio Nexus OS. Permite que terceiros criem subworkspaces (com cobrança proporcional ao volume) e revendam sob a marca deles.

**Arquivos:**
- [routes/franchise.js](../routes/franchise.js)
- [public/franchise.html](../public/franchise.html)

**DB:** `workspaces.parent_id`, `workspaces.nexus_fee_percentage` (padrão 5%), `franchise_payouts`.

**Status:** Em produção, modelo de receita ativo.

---

## Infraestrutura

### Auth

[routes/auth.js](../routes/auth.js) — login, logout, viewer-link (acesso read-only via JWT).

- Rate limit: 10 tentativas / 15 min por IP ([middleware/ratelimit.js](../middleware/ratelimit.js))
- JWT em cookie httpOnly `auth`, expira em 7 dias
- Logs em `audit_log`: `auth.login.success/failed/logout`, `auth.viewer_link.generated`

### Audit

[routes/audit.js](../routes/audit.js) + [utils/audit.js](../utils/audit.js) — log canônico do sistema.

- UI: [/audit](../public/audit.html) (admin only)
- Mascara segredos automaticamente
- Retenção 90d (configurável via `AUDIT_RETENTION_DAYS`)
- Cleanup roda no cron diário `/api/cron/alerts`
- 12+ pontos plugados: auth, settings, doppelganger persona, workspace branding, payments MP+Kiwify, etc.

### Billing

[routes/billing.js](../routes/billing.js) — visão de faturamento agregado (admin only, workspace=1).

**DB:** `workspace_billing`, `payments_log`.

### Settings + Workspaces

- [routes/settings.js](../routes/settings.js) — chave/valor por workspace (API keys, branding, toggles)
- [routes/workspaces.js](../routes/workspaces.js) — CRUD de workspace, switch, branding (logo, theme color)

**DB:** `workspaces`, `workspace_settings (workspace_id, key, value)`, `users`.

---

## Módulos auxiliares

| Módulo | Arquivo | O que faz |
|---|---|---|
| **Heal** | [routes/heal.js](../routes/heal.js) | Receberia logs de erro e proporia correções (conceitual, não usado) |
| **Pixel** | [routes/pixel.js](../routes/pixel.js) + [public/js/nexus-pixel.js](../public/js/nexus-pixel.js) | Pixel próprio de tracking instalável em sites externos (substituto do Meta Pixel) |
| **Health** | [routes/health.js](../routes/health.js) | 4 endpoints de health check para UptimeRobot e LB |
| **Sync** | [routes/sync.js](../routes/sync.js) | Sincronização Google Ads + Meta Ads, salva em `meta_campaigns_cache` e `google_campaigns_cache` |
| **Reports** | [routes/reports.js](../routes/reports.js) | Geração de relatórios PDF/CSV pra envio à diretoria |
| **Cron** | [routes/cron.js](../routes/cron.js) | Endpoint protegido por `CRON_SECRET` que orquestra alertScheduler + automationsRunner + cleanup audit |

---

## Dependências de IA por módulo

| Módulo | Modelo preferido | Fallback | Por que |
|---|---|---|---|
| Sentinel, Hive, Heal | Gemini 2.5 Flash (LOW) | — | Decisões rápidas e baratas |
| Skynet, Lazarus, Forge, Doppelgänger, Webhook NLP | Claude Sonnet 4.6 (MEDIUM) | GPT-4o | Copy persuasivo, persona consistente |
| Titan, Vision (raciocínio denso) | GPT-4o (HIGH) | Claude Opus | Análise estratégica multimodal |
| Studio | ElevenLabs (`eleven_multilingual_v2`) | — | Áudio brasileiro natural |

Toda chamada passa por [`utils/omni-router.js`](../utils/omni-router.js) que aplica essa hierarquia + fallback automático.

---

## Como cada módulo é configurado por workspace

| Setting | Pra quem | Default |
|---|---|---|
| `gemini.apiKey` | todos | env `GEMINI_API_KEY` |
| `anthropic.apiKey` | todos | env `ANTHROPIC_API_KEY` |
| `openai.apiKey` | todos | env `OPENAI_API_KEY` |
| `elevenlabs.apiKey` + `elevenlabs.voiceId` | Studio, Lazarus, Skynet | env + voice Sarah |
| `mercadopago.accessToken` | Vending, Checkout, Titan, Webhook | — (obrigatório) |
| `kiwify.webhook.secret` | Webhooks Kiwify | — |
| `meta.adAccountId` + `meta.accessToken` | Sentinel, Launcher | — |
| `doppelganger.persona_name/bio/traits` | Doppelgänger, Webhook NLP | persona genérica Nexus |
| `toggle.doppelganger` | Webhook NLP | `false` |
| `webhook.secret` | Webhooks externos custom | gerado automaticamente no primeiro GET |

---

## Ver mais

- **Endpoints completos com middlewares:** [docs/auto/API.md](auto/API.md)
- **Schema completo do banco:** [docs/auto/SCHEMA.md](auto/SCHEMA.md)
- **Convenções e gotchas:** [CLAUDE.md](../CLAUDE.md)
- **Operação e debug:** [RUNBOOK.md](../RUNBOOK.md)
- **Pitch e visão estratégica:** [NEXUS_OS_OVERVIEW.md](../NEXUS_OS_OVERVIEW.md)
