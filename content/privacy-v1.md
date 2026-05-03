# Política de Privacidade — Nexus OS

**Versão 1.0 · Vigência a partir de 03/05/2026**

Esta Política de Privacidade descreve como o **Nexus OS** ("Nexus", "nós") coleta, utiliza, armazena, compartilha e protege dados pessoais, em conformidade com a **Lei Geral de Proteção de Dados — LGPD (Lei nº 13.709/2018)**.

## 1. Controlador dos Dados

A Nexus atua como **Controladora** dos dados de seus Clientes (titular da conta) e como **Operadora** dos dados de leads/clientes finais que o Cliente trafega pela Plataforma.

**Contato do Encarregado de Dados (DPO):** dpo@nexusagencia.app

## 2. Dados Coletados

### 2.1. Dados do Cliente (titular da conta)

- Identificação: nome completo, e-mail, telefone/WhatsApp, nome da empresa;
- Autenticação: senha (armazenada apenas como hash bcrypt);
- Pagamento: dados são processados diretamente pelo Mercado Pago/Kiwify — a Nexus **não armazena** dados de cartão;
- Uso: logs de acesso (IP, user-agent, timestamps), ações realizadas na Plataforma, histórico de auditoria.

### 2.2. Dados operados em nome do Cliente (leads, contatos, clientes finais)

Quando o Cliente utiliza módulos como Skynet (prospecção), Doppelgänger (atendimento WhatsApp), Lazarus (recuperação) ou Vending (checkout), a Plataforma processa dados de terceiros fornecidos pelo próprio Cliente:

- Dados de identificação de leads: nome, telefone, e-mail, empresa;
- Mensagens trocadas por canais integrados;
- Dados de comportamento: engajamento, conversões, histórico de interação.

**O Cliente é o Controlador** desses dados perante a LGPD e responde pela base legal (consentimento, legítimo interesse, execução de contrato) que autoriza o uso.

### 2.3. Dados de cookies e tracking

A Plataforma utiliza cookies próprios e tecnologias similares para autenticação (cookie httpOnly `auth`), preferências de interface e métricas agregadas de uso. **Não utilizamos cookies de terceiros para publicidade direcionada.**

## 3. Finalidades e Bases Legais

| Finalidade | Base legal (LGPD art. 7º) |
|---|---|
| Prestar o serviço contratado | Execução de contrato (art. 7º, V) |
| Cobrança e cumprimento fiscal | Cumprimento de obrigação legal (art. 7º, II) |
| Comunicações operacionais (login, recibos, alertas) | Execução de contrato (art. 7º, V) |
| Suporte ao Cliente | Execução de contrato (art. 7º, V) |
| Análise antifraude | Legítimo interesse (art. 7º, IX) |
| Auditoria e segurança da informação | Cumprimento de obrigação legal + legítimo interesse |
| Comunicações de marketing (newsletter, novos módulos) | Consentimento (art. 7º, I) — sempre opt-in, com opt-out no rodapé |

## 4. Compartilhamento com Terceiros

A Nexus compartilha dados estritamente para viabilizar o Serviço, com os seguintes operadores:

- **Supabase / PostgreSQL (Frankfurt, UE)** — armazenamento;
- **Vercel (EUA)** — hospedagem da aplicação;
- **Upstash Redis (EUA)** — cache e rate limiting;
- **Sentry (Alemanha)** — monitoramento de erros;
- **OpenAI, Anthropic, Google AI** — processamento por modelos de linguagem (sem retenção para treinamento, conforme contratos enterprise);
- **ElevenLabs (EUA)** — síntese de voz;
- **Mercado Pago, Kiwify** — processamento de pagamento;
- **Gmail SMTP** — envio de e-mails transacionais;
- **Meta (Facebook/Instagram), Google Ads** — apenas APIs de tráfego, com tokens fornecidos pelo próprio Cliente.

**Transferência internacional:** parte dos operadores opera fora do Brasil. A Nexus garante que todos os fornecedores adotam padrões de segurança equivalentes ou superiores aos da LGPD (cláusulas contratuais, certificações SOC 2, ISO 27001, conformidade GDPR).

## 5. Retenção

- **Dados da conta ativa:** mantidos enquanto durar a relação contratual;
- **Após cancelamento:** 30 dias para exportação pelo Cliente, depois excluídos;
- **Logs de auditoria:** 90 dias (configurável por workspace, máximo 1 ano);
- **Dados fiscais (notas, recibos):** 5 anos (obrigação legal);
- **Backups:** rotacionados em até 30 dias após cancelamento.

## 6. Direitos do Titular

Nos termos do art. 18 da LGPD, qualquer titular pode, a qualquer tempo:

a) **confirmar** a existência de tratamento de seus dados;
b) **acessar** os dados;
c) **corrigir** dados incompletos, inexatos ou desatualizados;
d) **anonimizar, bloquear ou eliminar** dados desnecessários ou tratados em desconformidade;
e) **portar** os dados a outro fornecedor de serviço;
f) **eliminar** dados tratados com base em consentimento;
g) **revogar** consentimento;
h) **opor-se** a tratamento realizado com base em legítimo interesse.

**Como exercer:** envie e-mail para **dpo@nexusagencia.app** com assunto "LGPD — Solicitação de [direito]". Respondemos em até 15 dias.

## 7. Segurança

A Nexus adota medidas técnicas e organizacionais para proteger os dados, incluindo:

- Criptografia em trânsito (TLS 1.2+) e em repouso (AES-256);
- Senhas armazenadas com hash bcrypt (cost factor 10);
- Tokens JWT em cookie httpOnly + SameSite;
- Isolamento por workspace_id em todas as queries (multi-tenancy);
- Rate limiting e proteção contra força bruta;
- Logs de auditoria de toda ação sensível;
- Monitoramento contínuo via Sentry.

**Incidentes de segurança:** em caso de incidente que possa acarretar risco aos titulares, comunicaremos a ANPD e os titulares afetados em até 48h, conforme art. 48 da LGPD.

## 8. Cookies

| Cookie | Finalidade | Duração |
|---|---|---|
| `auth` | Token de sessão (httpOnly, Secure, SameSite=Lax) | 7 dias |
| `nx_*` (localStorage) | Preferências de UI no navegador | Persistente até logout |

Não utilizamos cookies de tracking publicitário de terceiros.

## 9. Menores de 18 Anos

O Serviço é destinado a pessoas físicas maiores de 18 anos ou pessoas jurídicas. Não coletamos deliberadamente dados de menores. Caso identificado, os dados serão excluídos imediatamente.

## 10. Alterações

Esta Política pode ser atualizada. Mudanças materiais serão comunicadas por e-mail e/ou aviso na Plataforma com 30 dias de antecedência.

## 11. Contato

- **Encarregado (DPO):** dpo@nexusagencia.app
- **Suporte geral:** suporte@nexusagencia.app
- **ANPD:** https://www.gov.br/anpd (canal oficial para reclamações)

---

*Versão 1.0 · publicada em 03 de maio de 2026.*
