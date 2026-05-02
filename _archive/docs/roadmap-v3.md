# Roadmap Maranet Dashboard v3.0 🚀

Este documento define o planejamento estruturado para a **versão 3.0** do Sistema de Tráfego Maranet. Com a base "Enterprise" consolidada na v2.0 (tracking demográfico, CRM e automação), o objetivo da v3.0 é transformar a ferramenta de um painel de uso único em uma **plataforma SaaS escalável e inteligente**, com análises preditivas movidas a IA e visão microscópica de anúncios.

---

## 🎯 Visão Geral das Fases

### 🟣 Fase 1: Tracking Microscópico (Ad-Level)
**Foco:** Descobrir não apenas qual campanha funciona, mas exatamente *qual vídeo/imagem* está trazendo vendas.
- [ ] **1.1 Sincronização Nível de Anúncio (Criativos):**
  - Atualizar os serviços (Google/Meta) para buscar métricas por `ad_id` / `ad_name`.
  - Criar uma galeria/tabela no dashboard exibindo as miniaturas (thumbnails) dos anúncios mais performáticos.
- [ ] **1.2 UTM Avançada e Jornada do Lead:**
  - Ligar parâmetros UTM específicos (`utm_content`, `utm_term`) direto na tabela de CRM (webhook).
  - Tabela "Top Criativos": Classificar imagens e vídeos baseados no CAC (Custo de Aquisição Real) e não apenas no CPL.

### 🔵 Fase 2: O Passo para SaaS (Agency Mode / Multi-Tenant)
**Foco:** Transformar o sistema para rodar múltiplas marcas ou clientes simultaneamente em ambientes isolados.
- [ ] **2.1 Workspaces e Clientes:**
  - Adicionar o conceito de `workspace_id` (Cliente A, Cliente B) em todas as tabelas principais (`metrics_daily`, `campaigns`, `sales`).
  - Dropdown global no painel para alternar entre ambientes de clientes instantaneamente.
- [ ] **2.2 White-labeling Dinâmico:**
  - Configurações por cliente: Logomarca personalizada, paleta de cores primária e nome da empresa na interface Read-Only.
- [ ] **2.3 Faturamento Compartilhado:**
  - Painel global (Admin) para ver o investimento e a receita somada de todos os clientes da agência na mesma tela.

### 🟢 Fase 3: Analista de IA Integrado (Copilot)
**Foco:** Deixar de apenas exibir dados para começar a dar **direcionamentos práticos**.
- [ ] **3.1 Integração com LLM (OpenAI / Gemini):**
  - Rota assíncrona que lê as tabelas de métricas dos últimos 7 dias e gera um "Relatório de Insights" textual.
  - *Exemplo gerado pela IA:* "Notei que a campanha 'Promo SP' subiu o CPL em 45% nos últimos 3 dias e a taxa de conversão caiu. Sugiro pausar os criativos B e C."
- [ ] **3.2 Previsão de Churn e Sazonalidade:**
  - IA analisa a taxa de decaimento do CTR e alerta proativamente quando um criativo atingir o limite de "fadiga de público".

### 🟠 Fase 4: Automação Pós-Venda e LTV
**Foco:** Olhar além da primeira venda. Entender o verdadeiro valor do cliente (Lifetime Value).
- [ ] **4.1 Painel de Assinaturas (Recorrência e LTV):**
  - Expansão do Webhook do CRM para aceitar eventos de `refund` (reembolso) e `renewal` (renovação - Hotmart/Kiwify).
  - Dashboard isolado para Saúde de Produto: Taxa de Reembolso, Cohort de Retenção (Mês a Mês) e LTV (Lifetime Value).
- [ ] **4.2 Relatórios Executivos Automatizados:**
  - Cronjob semanal que compila os dados, gera um PDF com design impecável via Puppeteer, e envia pro-ativamente no e-mail do cliente toda segunda-feira às 08h.

---

## 🛠️ Desafios Técnicos e Stack
*   **Supabase (Row Level Security):** A Fase 2 (Multi-Tenant) exigirá regras de segurança rígidas (RLS) no Supabase para garantir que os dados de um cliente jamais vazem para outro.
*   **Armazenamento de Thumbnails:** Na Fase 1, precisaremos fazer cache das URLs das imagens dos criativos no painel para evitar lentidão.
*   **Integração IA:** Roteamento eficiente de prompts com a OpenAI API para ler as matrizes de performance sem estourar limites de tokens.

---
*Status: Projeção de visão de longo prazo. Defina qual das fases atacar primeiro para iniciarmos o desenvolvimento da V3.*
