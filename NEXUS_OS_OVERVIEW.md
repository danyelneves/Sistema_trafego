# NEXUS OS — Visão Executiva

> Plataforma SaaS B2B multi-tenant de automação de tráfego pago, vendas com IA
> e operações comerciais autônomas. Construída para **rodar negócios — não só medi-los**.

**Produção:** https://nexusagencia.app
**Empresa:** NVia Holding · Maranet Telecom
**Founder & CTO:** Daniel Neves
**Data deste documento:** 2026-05-01

---

## 📌 Resumo executivo

NEXUS OS é uma plataforma de automação operacional que combina painel de
tráfego pago (Google Ads + Meta Ads) com **agentes autônomos de IA** que
executam tarefas comerciais inteiras sem intervenção humana — desde
prospecção de clientes até fechamento de venda no WhatsApp e despacho
de produto físico.

Diferente de SaaS tradicionais que "mostram dados", o NEXUS OS **age
sobre os dados**: pausa campanhas com baixo ROAS, prospecta novos
clientes via Google Maps, dispara mensagens personalizadas, gera links
de pagamento PIX dentro de conversas de WhatsApp, e recupera carrinhos
abandonados — tudo via IA (Claude, Gemini, GPT-4o) operando 24/7.

A plataforma é multi-tenant: cada cliente opera em ambiente isolado
com seus próprios dados, integrações e configurações de IA.

---

## 🎯 Métricas técnicas (snapshot de 2026-05-01)

| Métrica | Valor |
|---------|-------|
| **Linhas de código** | ~14.500 (JavaScript puro) |
| **Arquivos JS** | 138 |
| **Rotas de API** | 41 |
| **Tabelas no banco** | 30+ |
| **Módulos de negócio** | 16 |
| **Modelos de receita** | 5 simultâneos |
| **Testes automatizados** | 23 unit + 8 smoke |
| **Cobertura de tipos** | JavaScript ES2022 sem TypeScript |
| **Dependências de produção** | 14 npm packages |
| **Tempo de build (Vercel)** | ~7 segundos |
| **Cold start (Lambda)** | < 800ms |
| **P95 latência API** | < 250ms |

---

## 🏗️ Stack tecnológica

| Camada | Tecnologia | Por que |
|--------|-----------|---------|
| **Backend** | Node.js 22 + Express 4 | Performance + ecosystem maduro + simplicidade |
| **Banco de dados** | PostgreSQL 17 (Supabase) | Padrão da indústria, RLS multi-tenant nativo |
| **Conexões DB** | Supavisor pooler (porta 6543) | Otimizado para serverless, evita exhaustion |
| **Hospedagem** | Vercel (serverless functions) | Auto-scaling, edge global, deploy via git |
| **Cache/Rate limit** | Upstash Redis | Serverless-safe, sliding window distribuído |
| **Auth** | JWT (httpOnly cookie) + bcrypt | Padrão seguro, sem session storage |
| **Pagamentos** | Mercado Pago + Kiwify | Mercado brasileiro dominante |
| **IA Premium** | Anthropic Claude Sonnet 4.6 | Closer NLP, copy persuasiva |
| **IA Padrão** | Google Gemini 1.5 Flash | Análise de dados, decisões rápidas |
| **IA Pesada** | OpenAI GPT-4o | Geração de landing pages, planejamento |
| **Voz sintética** | ElevenLabs | Clonagem de voz para WhatsApp |
| **WhatsApp** | Z-API + Evolution API (rotativos) | Resiliência contra banimentos |
| **Observabilidade** | Sentry + UptimeRobot | Captura de erros + monitoramento externo |
| **Logs** | JSON estruturado + Vercel Runtime Logs | Filtrável, rastreável via requestId |
| **CI/CD** | GitHub Actions | Testes automáticos em cada PR |

---

## 💼 Modelos de receita (5 simultâneos)

### 1. SaaS Recorrente
Mensalidades via Mercado Pago.
- **STARTER** R$ 97/mês — automações básicas
- **GROWTH** R$ 297/mês — Sentinel + Skynet + Lazarus ativos
- **ELITE** R$ 997/mês — limites elevados, todas as features

### 2. Vending Machine
Cliente paga R$ 297 via PIX → sistema usa 40% (R$ 119) pra subir
campanha real no Facebook → R$ 178 é lucro líquido sem operação humana.
Modelo transacional puro, sem retenção exigida.

### 3. Franquia White-Label
Agências adquirem o sistema rebrandado como produto delas. NEXUS retém
percentual configurável (default 5%) sobre receita gerada. Modelo de
receita passiva escalável.

### 4. Nexus Market — Bolsa de Leads
Sistema captura leads via Forge (landing pages) ou Skynet (prospecção).
Notifica empresas compradoras cadastradas. Quem responder primeiro paga
R$ 35 e recebe contato exclusivo. Arbitragem pura entre custo de
captação e preço de venda.

### 5. Mark-up de IA
Todo uso de modelos de IA pelos clientes é medido e cobrado com 30% de
mark-up sobre o custo real de API. Receita passiva sobre consumo,
escala linearmente com uso da plataforma.

---

## 🤖 Módulos de negócio (16)

### Operação autônoma de tráfego
- **SENTINEL** — Robô que monitora todas as campanhas Meta a cada 15 min
  via API. Gemini analisa CPA, CTR, conversões e decide PAUSAR, ESCALAR
  ou MANTER. Executa direto via API, sem humano. 3 níveis de risco
  configuráveis (frio/morno/quente).

- **LAUNCHER** — Sobe novas campanhas Meta via API com estrutura
  pré-validada por nicho.

- **HIVE** — Monitor de anomalias globais da rede de tráfego.

### Prospecção autônoma
- **SKYNET** — Recebe nicho + cidade, busca empresas via Google Maps API,
  IA escreve mensagem personalizada (modo Oráculo aponta falhas reais
  do site/Instagram), dispara via WhatsApp com áudio sintetizado.

- **MARKET** — Marketplace de leads em leilão automático.

### Vendas autônomas
- **FECHADOR NLP (DOPPELGÄNGER)** — Vendedor IA que conversa no
  WhatsApp imitando estilo do dono (gírias, ritmo, erros sutis para
  parecer humano). Detecta intenção de compra e gera PIX automaticamente.

- **GHOST CHECKOUT** — Geração de PIX dentro da conversa do WhatsApp,
  cliente nem sai do app pra pagar.

- **VENDING MACHINE** — Auto-serviço onde cliente paga e recebe campanha
  rodando em 5 minutos.

### Recuperação e retenção
- **LAZARUS** — Detecta carrinhos abandonados e leads frios, IA escreve
  mensagem empática personalizada por contexto, dispara reativação.

### Geração de assets
- **FORGE** — Cria landing pages completas via IA. Headline muda
  dinamicamente baseado no `utm_term` do anúncio que trouxe o visitante.

- **STUDIO** — Clonagem de voz e geração de áudios via ElevenLabs.

- **VISION** — Engenharia reversa visual de criativos concorrentes.

### Operações físicas
- **POLTERGEIST** — Quando venda fecha, sistema dispara comanda na
  impressora térmica (cloud) e chama motoboy via Uber Direct/Lalamove.
  Loja sem humano.

### Inteligência estratégica
- **TITAN** — "CEO Autônomo": audita saldo MP, identifica nicho mais
  lucrativo do momento via OmniRouter, gera blueprint completo de novo
  spin-off (marca, produto, copy, meta de ROAS).

- **EMPIRE** — Kanban interno por workspace para gestão de tarefas.

### DevOps autônomo
- **HEAL** — Receberia logs de erro e proporia correções de código.
  (Conceptual — não usado em produção).

### Captação
- **NEXUS PIXEL** — Pixel próprio de tracking instalável em qualquer
  site, similar ao Meta Pixel.

- **CHROME EXTENSION** — Espião de criativos do Facebook Ad Library.

---

## 🔐 Segurança & Compliance

### Camadas implementadas

| Categoria | Proteções |
|-----------|-----------|
| **Autenticação** | JWT httpOnly cookie + bcrypt 12 rounds + JWT_SECRET 256 bits |
| **Webhook MP** | HMAC SHA-256 + collector_id check + amount validation + currency check |
| **Webhook Kiwify** | HMAC SHA-1 obrigatório por workspace + raw body capture |
| **Webhook WhatsApp** | Token UUID v4 por workspace na URL, lookup em workspace_settings |
| **Idempotência** | Tabela webhook_events com UNIQUE constraint, retorna 200 silencioso para replays |
| **Rate limiting** | Upstash Redis com sliding window: 10/15min login, 60/min Kiwify, 10/s WhatsApp |
| **CORS/Headers** | HSTS, COOP, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| **LGPD** | PII (CPF, telefone, email) mascarada em todos os logs |
| **Audit trail** | Tabela audit_log para ações sensíveis (upgrade, login admin) |
| **Crons** | Protegidos por CRON_SECRET obrigatório em produção |
| **Anti-fraude** | Validação tripla no upgrade (whitelist de planos + valor exato em centavos + collector_id do dono) |
| **Database** | Connection pooling + queries parametrizadas (zero SQL injection) |

### Auditoria realizada

Plataforma passou por **3 rodadas de auditoria de segurança** com
correção de 16 vulnerabilidades identificadas:
- Rodada 1: 14 issues (3 críticos, 7 moderados, 4 baixos)
- Rodada 2: 2 issues novos descobertos (Mock Fiado em billing + HMAC bypass na Kiwify)
- Rodada 3: 5 melhorias finais (logger filesystem, JWT throw em preview, rotas órfãs, db params, ratelimit hang)

Todas correções aplicadas, validadas e em produção.

---

## 📊 Observabilidade

### Health checks granulares
4 endpoints públicos para diagnóstico em incidentes:
- `GET /api/health` — liveness básico (sempre 200 se lambda subiu)
- `GET /api/health/ready` — readiness agregado (DB obrigatório)
- `GET /api/health/db` — SELECT 1 no Postgres com timeout 3s
- `GET /api/health/redis` — PING no Upstash com timeout 3s
- `GET /api/health/mp` — verifica configuração completa do Mercado Pago

### Sentry
Captura automática de erros 5xx em produção com:
- Stack trace completa
- Contexto (path, method, requestId, workspaceId, userId)
- Filtros para ruído (ECONNRESET, ETIMEDOUT)
- Dashboard com tendências e priorização

### UptimeRobot
Monitor externo bate em `/api/health/ready` a cada 5 minutos.
Alertas por email se 2 falhas consecutivas. Histórico público em
status page (opcional).

### Logger estruturado
Cada log de produção é JSON em uma linha com:
- timestamp ISO 8601
- nível (debug/info/warn/error)
- requestId (rastreável cross-function via x-vercel-id)
- contexto rico (workspaceId, paymentId, etc)

---

## ✅ Qualidade de código

### Testes automatizados
- **Unit tests:** 23 testes sem rede (validate, retry, mask, sentry, logger, pgify) — rodam em < 1s
- **Smoke tests:** 8 testes integrados contra ambiente real, parametrizáveis via DOMAIN env

### CI/CD (GitHub Actions)
- A cada PR: syntax check de todos os JS + npm test
- A cada push em main: deploy Vercel automático + smoke contra produção
- Falha em qualquer etapa bloqueia o merge

### Padrões aplicados
- Validação centralizada via `utils/validate.js` (sem libs externas)
- Retry com exponential backoff em chamadas externas
- Idempotência centralizada via `utils/idempotency.js`
- Audit log via `utils/audit.js` para ações sensíveis
- Lazy require de SDKs pesados (~18MB economizados em cold start)

---

## 🌐 Infraestrutura externa (custo operacional)

| Serviço | Função | Plano atual | Custo |
|---------|--------|-------------|-------|
| **Vercel** | Hospedagem serverless | Hobby | R$ 0 |
| **Supabase** | PostgreSQL gerenciado | Free | R$ 0 |
| **Upstash** | Redis para rate limit | Free | R$ 0 |
| **Sentry** | Captura de erros | Developer | R$ 0 |
| **UptimeRobot** | Monitor externo | Free | R$ 0 |
| **GitHub** | Versionamento + CI | Free | R$ 0 |
| **Mercado Pago** | Processamento de pagamento | — | ~3-5% por transação |
| **Anthropic** | API Claude | Pay-as-you-go | ~US$ 0.01 por mensagem |
| **Google AI** | API Gemini | Free tier generoso | R$ 0 (até limite) |
| **OpenAI** | API GPT-4o | Pay-as-you-go | ~US$ 0.005 por chamada |
| **ElevenLabs** | Síntese de voz | Free | R$ 0 (até 10k chars/mês) |
| **Kiwify** | Webhook de vendas | — | R$ 0 (taxa por venda) |
| **TOTAL** | | | **R$ 0/mês fixo** |

**Sistema completo opera com custo R$ 0/mês fixo** até primeiros
~100 clientes pagantes ou ~1000 mensagens IA/dia. Acima disso, escala
gradualmente com receita.

Estimativa de custos em escala (1.000 clientes ativos):
- Vercel Pro: US$ 20/mês
- Supabase Pro: US$ 25/mês
- Upstash Pay: US$ 10/mês
- Sentry Team: US$ 26/mês
- IA APIs: ~US$ 200-500/mês
- **Total estimado:** US$ 280-580/mês para 1.000 clientes
- **Receita estimada:** R$ 100k-300k/mês (mark-up bruto > 95%)

---

## 🎨 Diferencial competitivo

### Versus Hubspot, RD Station, ActiveCampaign
- Esses são **CRMs** que medem.
- NEXUS OS **age** — IA decide e executa, não pede aprovação humana
  para cada decisão.

### Versus Apollo.io, ZoomInfo
- Esses são **bases de dados** de leads.
- NEXUS OS **gera leads novos** via Google Maps + cria abordagem
  personalizada com IA + dispara via WhatsApp + fecha venda — ciclo
  completo end-to-end.

### Versus ClickFunnels, Leadpages, Builderall
- Esses são **construtores de funil** estáticos.
- NEXUS OS tem landing pages **mutantes** (Forge) que adaptam headline
  ao termo de busca do anúncio + sistema completo por trás.

### Versus Hotmart, Eduzz, Kiwify
- Esses são **plataformas de checkout**.
- NEXUS OS **substitui o vendedor humano** que conversa antes do
  checkout, fecha a venda e gera o link de pagamento dentro do WhatsApp.

### Versus Zapier, Make, n8n
- Esses são **automatizadores genéricos** que precisam de configuração
  manual de cada fluxo.
- NEXUS OS é **especializado em vendas+tráfego** com agentes de IA
  pré-configurados que tomam decisões com base em prompt + dados.

### Único no Brasil
Não existe competidor direto que combine: prospecção autônoma + IA que
imita personalidade do dono + Ghost Checkout + tracking de tráfego em
plataforma única, em português, com integração nativa Mercado Pago e
Kiwify.

---

## 🛣️ Roadmap

### Fase imediata (próximos 30 dias)
- [ ] Lançamento comercial da Vending Machine como produto standalone
- [ ] Ativação do Skynet para 3 nichos (dentistas, advogados, contadores)
- [ ] Onboarding documentado para primeiros 10-20 clientes pagantes

### Fase 2 — Tracking microscópico (Q3 2026)
- [ ] Métricas por criativo individual (não apenas por campanha)
- [ ] Galeria de "Top Criativos" rankeada por CAC real

### Fase 3 — Relatórios executivos automáticos (Q3 2026)
- [ ] PDF executivo gerado via Puppeteer toda segunda 8h
- [ ] Envio automático por email aos clientes

### Fase 4 — LTV e cohort retention (Q4 2026)
- [ ] Tracking de eventos pós-venda (refund, renewal)
- [ ] Dashboard de saúde de produto: cohorts, LTV, churn

### Fase 5 — Holding digital (2027)
- [ ] Titan opera capital de forma plena
- [ ] Sistema funda spin-offs autonomamente
- [ ] Cada nicho/cliente vira potencial nova marca operada por IA

---

## 👥 Equipe & Operação

**Equipe atual:** 1 (Daniel Neves — fundador, CTO, primeiro vendedor)

**Modelo de operação:** Solo founder com sistemas autônomos cobrindo:
- Tráfego (Sentinel)
- Prospecção (Skynet)
- Vendas (Doppelgänger + Ghost Checkout)
- Cobrança (Mercado Pago automatizado)
- Suporte (em desenvolvimento)

**Próximas contratações sugeridas (com receita validada):**
1. QA / SDET — testar features em vez de adicionar novas
2. Customer Success — reter base de clientes pagantes
3. Sales — vendas humanas para tickets ELITE+

---

## 📈 Validação técnica

### Histórico de hardening (últimas 24h)
| Marco | Status |
|-------|--------|
| 16 vulnerabilidades de segurança identificadas e corrigidas | ✅ |
| 7 camadas de qualidade implementadas (observabilidade → docs) | ✅ |
| Sistema migrado de "fora do ar com erro 500" para "8/8 testes verde" | ✅ |
| Cobertura: 23 unit tests + 8 smoke tests automatizados | ✅ |
| Database: 10 índices novos para escala multi-tenant | ✅ |
| Sentry capturando erros em < 1s | ✅ |
| UptimeRobot monitorando externamente a cada 5 min | ✅ |

### Smoke tests em produção (snapshot atual)
```
✅ Health endpoint responde 200
✅ MP webhook bloqueia sem assinatura HMAC
✅ WhatsApp rejeita token inválido
✅ Kiwify bloqueia workspace sem secret
✅ Billing /upgrade exige autenticação
✅ Brute force bloqueado na 11ª tentativa (Upstash)
✅ Headers de segurança globais (4/4)
✅ /f/:slug responde sem 5xx
─────────────────────────────────
8/8 passou | 0 falhou
```

---

## 🎯 Tese de investimento

### Mercado endereçável
- **TAM Brasil:** ~50.000 agências de marketing digital + ~1M de
  PMEs que rodam tráfego pago
- **SAM realista:** ~10.000 agências/empresários ativos pagantes (R$ 297/mês médio)
- **Receita potencial estável:** R$ 30M ARR

### Por que agora
- Custo de IA caiu 100x em 2 anos (Claude, Gemini, GPT viáveis pra produto SaaS)
- Mercado pós-COVID consolidado em torno de Meta + Google Ads (não
  mais 20 plataformas)
- Brasil tem 200M+ usuários ativos de WhatsApp diário (canal único de
  vendas no mundo)
- Mercado Pago + Kiwify + Hotmart fornecem rails financeiros
  completos sem precisar reinventar pagamento

### Por que NEXUS OS
- **Único produto** no Brasil que faz prospecção autônoma + venda WhatsApp + tracking integrado
- **Custo operacional próximo de zero** (todos serviços externos free tier)
- **Margem bruta > 95%** quando escalar
- **Founder com mão na massa** — entende cada linha do produto

### Riscos conhecidos
- Dependência de WhatsApp para vendas (risco regulatório/banimento de chips)
- Dependência de OpenAI/Anthropic/Google para IA (mitigado com OmniRouter — 3 fallbacks)
- Founder único é single point of failure

### Mitigação dos riscos
- Pool rotativo de chips WhatsApp (Z-API + Evolution + WhatsApp Business API oficial)
- OmniRouter alterna entre 3 provedores de IA dinamicamente
- Documentação técnica completa (RUNBOOK + README) reduz risco de bus factor

---

## 📞 Contato técnico

**Repositório:** https://github.com/danyelneves/nexus-os (privado)
**Domínio de produção:** https://nexusagencia.app
**Documentação operacional:** [RUNBOOK.md](RUNBOOK.md)
**Documentação técnica:** [README.md](README.md)
**Histórico de segurança:** [CHANGELOG_SECURITY.md](CHANGELOG_SECURITY.md)

---

*Este documento é mantido vivo no repositório e atualizado conforme
novas features ou módulos são incorporados. Última atualização:
2026-05-01.*
