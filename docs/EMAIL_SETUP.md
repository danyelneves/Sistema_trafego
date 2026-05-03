# Setup de E-mail — Nexus OS

Estratégia: o usuário final só vê e-mails brandados (`suporte@nexusagencia.app`, `dpo@nexusagencia.app`, `noreply@nexusagencia.app`). Internamente, tudo cai em **danyelneves@gmail.com** via forwarding + BCC automático.

## 1. Endereços visíveis ao usuário

| Endereço | Onde aparece | Função |
|---|---|---|
| `suporte@nexusagencia.app` | Termos de Uso, rodapés, RUNBOOK | Suporte geral |
| `dpo@nexusagencia.app` | Política de Privacidade | Encarregado de dados (LGPD) |
| `noreply@nexusagencia.app` | `From:` de transacionais (opcional) | Envio outbound |

## 2. Endereço operacional interno

`danyelneves@gmail.com` — **nunca** aparece em template, link, texto público ou rodapé. Usado só por:

- **`SMTP_USER`** (Gmail SMTP — autenticação outbound do nodemailer)
- **`INTERNAL_ADMIN_EMAIL`** (BCC silencioso de todo transacional + alvo de `sendAdminAlert()`)

## 3. Forwarding (1x setup, fora do código)

Configurar redirecionamento dos endereços brandados → Gmail. Duas opções:

### Opção A — Cloudflare Email Routing (gratuito, recomendado)

1. Acesse Cloudflare → seu domínio `nexusagencia.app` → **Email** → **Email Routing**
2. Habilite Email Routing (Cloudflare adiciona MX + SPF automaticamente)
3. Em **Routing rules**, criar:
   - `suporte@nexusagencia.app` → `danyelneves@gmail.com`
   - `dpo@nexusagencia.app` → `danyelneves@gmail.com`
   - `noreply@nexusagencia.app` → `danyelneves@gmail.com` (caso alguém responda)
   - **Catch-all** → `danyelneves@gmail.com` (qualquer outro endereço @nexusagencia.app)
4. Verificar `danyelneves@gmail.com` no Cloudflare (clicar no link de confirmação)

### Opção B — Google Workspace (~R$30/usuário/mês)

Se quiser **enviar** com `suporte@nexusagencia.app` (não só receber):
1. Assinar Workspace pro domínio `nexusagencia.app`
2. Criar usuário/alias `suporte@`
3. No Gmail pessoal: Settings → Accounts → "Send mail as" → adicionar `suporte@nexusagencia.app`

## 4. Variáveis de ambiente (Vercel)

```bash
# SMTP — autenticação Gmail (App Password de 16 chars)
SMTP_USER=danyelneves@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
SMTP_FROM=Nexus OS <noreply@nexusagencia.app>     # opcional, se usar Workspace

# E-mail interno do operador (default: danyelneves@gmail.com)
INTERNAL_ADMIN_EMAIL=danyelneves@gmail.com
```

**Sem Workspace:** o `From:` vai mostrar `danyelneves@gmail.com` no Gmail do destinatário (não tem como falsificar). Solução paliativa: deixar `SMTP_FROM` vazio e configurar uma label/assinatura que reforce a marca Nexus.

## 5. Comportamento esperado

- **Onboarding aprovado** → cliente recebe credenciais; admin recebe BCC silencioso (mesmo email completo, sem linkar com o cliente)
- **Alertas KPI** → vão pro `to` configurado no workspace; admin BCC se diferente
- **Suporte respondido pelo cliente** → e-mail cai em `danyelneves@gmail.com` via forwarding Cloudflare
- **Cliente vê resposta** com `From: suporte@nexusagencia.app` se você configurar SendAs no Gmail (precisa Workspace ou SMTP relay externo)

## 6. Override por workspace (futuro, não implementado)

Quando expandir, criar `workspace_settings.support_email` pra cada cliente customizar pra onde caem os e-mails do próprio painel (em vez de todos caírem no admin global).
