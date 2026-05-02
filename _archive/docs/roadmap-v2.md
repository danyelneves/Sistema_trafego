# Roadmap Maranet Dashboard v2.0 🚀

Este documento define o planejamento estruturado para a próxima evolução do Sistema de Tráfego Maranet. O objetivo é transformar o painel atual (v1.0) em uma ferramenta de "Nível Enterprise", focada em tracking de ponta a ponta, automação de alertas e distribuição de relatórios para a diretoria.

---

## 🎯 Visão Geral das Fases

### 🟢 Fase 1: Inteligência Financeira e Previsibilidade
**Foco:** Evitar surpresas no orçamento e trazer o "Custo de Aquisição de Cliente" (CAC) real para a tela.

- [ ] **1.1 Webhook de CRM (O Funil Completo)**
  - Criar uma rota de API (`POST /api/webhook/crm`) para receber dados de fechamento de contratos.
  - Atualizar a tabela `metrics_daily` ou criar uma nova tabela `sales` para atrelar a venda ao canal/campanha.
  - Exibir o KPI de **CAC Real** e **ROI/ROAS** no Dashboard.
- [ ] **1.2 Calculadora de Pacing (Ritmo de Verba)**
  - Permitir o cadastro de um "Orçamento Mensal Total" nas Metas.
  - Criar uma barra de progresso no topo do Dashboard mostrando: `% Gasto vs % do Mês Percorrido`.
  - Indicadores Visuais: Verde (No ritmo), Amarelo (Atenção), Vermelho (Estouro projetado).

### 🔵 Fase 2: Governança e Compartilhamento
**Foco:** Levar o dado para quem importa sem arriscar a segurança do sistema.

- [ ] **2.1 Modo "Diretoria" (Read-Only View)**
  - Adicionar o nível de permissão `viewer` ou um link estático (token JWT via URL) para visualização.
  - Esconder todos os botões de ação (Sincronizar, Inserir Dados, Apagar, Metas) quando o usuário for um `viewer`.
  - Layout focado 100% em Full-Screen / Apresentação.

### 🟠 Fase 3: Automação e Alertas Proativos
**Foco:** O sistema avisa você antes que o problema fique caro.

- [ ] **3.1 Motor de Alertas Automáticos**
  - Configuração de gatilhos: Ex: "Se CPL Meta > R$ 25 nos últimos 3 dias".
  - Integração de envio via Webhook para **Slack** ou **Telegram/WhatsApp**.
  - Execução via Vercel Cron (roda todo dia às 08:00 para checar as regras de alerta e disparar as mensagens).

### 🟣 Fase 4: Inteligência Geográfica e Demográfica
**Foco:** Saber *onde* e *com quem* o dinheiro rende mais.

- [ ] **4.1 Sincronização Demográfica (Google/Meta)**
  - Expandir o arquivo `services/metaAds.js` e `services/googleAds.js` para buscar dados com quebra por região (Cidades) e Idade.
  - Atualização do banco de dados (tabela `metrics_demographics`).
- [ ] **4.2 Mapa de Calor e Distribuição**
  - Novo gráfico no Frontend: Um gráfico de barras ou tabela mostrando quais cidades da Maranet geraram Leads mais baratos no mês.

---

## 🛠️ Stack Técnica e Complexidade
*   **Banco de Dados:** Novas tabelas e colunas no PostgreSQL (Supabase) serão criadas sem afetar o histórico atual.
*   **API / Backend:** Totalmente suportado pela arquitetura assíncrona que já implementamos na Vercel.
*   **Frontend:** Reutilização dos componentes Brutalistas recém-criados.

## 🏁 Critérios de Sucesso para a v2.0
A v2.0 será considerada concluída quando:
1. O painel mostrar não só o CPL, mas quantas vendas reais vieram do Marketing (CAC).
2. O sistema avisar ativamente via chat se o custo disparar.
3. O link da diretoria puder ser acessado sem login corporativo ou com segurança reduzida sem comprometer os dados.

---
*Status: Aguardando aprovação do usuário para iniciar a Fase 1.*
