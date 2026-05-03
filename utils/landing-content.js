/**
 * utils/landing-content.js
 *
 * Schema canônico do conteúdo da landing + resolução com fallback.
 *
 * Ordem de fallback ao buscar conteúdo:
 *   1. Conteúdo publicado do tenant (se workspaceId fornecido)
 *   2. Conteúdo publicado do system_default
 *   3. DEFAULT_CONTENT (hardcoded aqui — espelha a landing.html original)
 */
const db = require('../db');

const DEFAULT_CONTENT = {
  meta: {
    title: 'Nexus Agência · Sistema Inteligente de IA',
    description: 'A agência operada por software, 24/7. Sistema autônomo de IA que prospecta clientes, conversa pelo WhatsApp, fecha vendas e despacha pedidos sem humano.',
    theme_color: '#0099ff',
  },
  nav: {
    logo_text: 'NEXUS·OS',
    cta_label: 'Entrar',
    cta_href: '/login',
  },
  hero: {
    badge: 'SISTEMA INTELIGENTE DE IA · OPERANDO 24/7',
    title_pre: 'A agência operada por',
    title_grad: 'software',
    title_post: ', 24/7',
    subtitle: 'IA que prospecta clientes, conversa pelo WhatsApp, fecha venda no PIX e despacha pedido. Tudo sem humano. Você só recebe o relatório no fim do dia.',
    cta_primary_label: 'Ver o sistema operar →',
    cta_primary_href: '/login',
    cta_secondary_label: 'Comprar agora',
    cta_secondary_href: '/comprar',
  },
  stats: [
    { num: '16', label: 'Módulos integrados' },
    { num: '5',  label: 'Modelos de receita' },
    { num: '24/7', label: 'Operação autônoma' },
    { num: '3',  label: 'IAs em paralelo' },
  ],
  how: {
    tag: 'Como funciona',
    title: '3 passos. Zero esforço humano.',
    subtitle: 'O sistema cuida de cada etapa do funil — do primeiro contato até a entrega.',
    steps: [
      { title: 'IA Prospecta', desc: 'Skynet busca empresas via Google Maps por nicho e cidade, audita o site/Instagram com IA, e dispara mensagem ultra-personalizada via WhatsApp.' },
      { title: 'IA Vende',     desc: 'Doppelgänger conversa imitando seu jeito de falar. Quebra objeções, gera PIX dentro do WhatsApp e fecha a venda. Você nem precisa estar online.' },
      { title: 'IA Entrega',   desc: 'Sistema dispara comanda na impressora, chama motoboy via Uber Direct, ou libera produto digital. Você só recebe o relatório no fim do dia.' },
    ],
  },
  modules_section: {
    tag: 'Módulos',
    title: '16 sistemas autônomos integrados',
    subtitle: 'Cada módulo é uma IA especializada que substitui um cargo da agência tradicional.',
  },
  quote: {
    text: 'Nexus Agência não é um SaaS. É um sócio que nunca dorme, nunca pede aumento, e gera dinheiro em múltiplas frentes ao mesmo tempo.',
    author: '— TIME NEXUS',
  },
  cta_final: {
    title: 'Pronto pra ver o sistema operando?',
    subtitle: 'Acesso restrito. Plataforma em fase de uso interno + parceiros estratégicos.',
    button_label: 'Entrar no sistema →',
    button_href: '/login',
  },
  footer: {
    copyright: '© 2026 Nexus · Todos os direitos reservados',
    links: [
      { label: 'Status', href: '/api/health' },
      { label: 'Login', href: '/login' },
    ],
  },
};

/** Merge raso 2 níveis: customContent.field sobrescreve default.field (sem deep merge complexo) */
function merge(base, override) {
  if (!override) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v == null) continue;
    if (Array.isArray(v)) out[k] = v;
    else if (typeof v === 'object' && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = { ...base[k], ...v };
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Resolve conteúdo com fallback chain.
 * @param {object} opts
 * @param {number} [opts.workspaceId] — se fornecido, tenta tenant primeiro
 * @returns {Promise<{ content, source }>}
 */
async function resolveContent({ workspaceId } = {}) {
  // 1. Tenant publicado
  if (workspaceId) {
    const tenant = await db.get(
      `SELECT published_json FROM landing_page_content
       WHERE scope='tenant' AND workspace_id = $1 AND is_published = true`,
      [workspaceId]
    );
    if (tenant?.published_json) {
      return { content: merge(DEFAULT_CONTENT, tenant.published_json), source: 'tenant' };
    }
  }
  // 2. System default publicado
  const sys = await db.get(
    `SELECT published_json FROM landing_page_content
     WHERE scope='system_default' AND is_published = true`
  );
  if (sys?.published_json) {
    return { content: merge(DEFAULT_CONTENT, sys.published_json), source: 'system_default' };
  }
  // 3. Fallback hardcoded
  return { content: DEFAULT_CONTENT, source: 'hardcoded' };
}

/** Resolve conteúdo de rascunho (pra preview no admin) */
async function resolveDraft({ scope, workspaceId }) {
  if (scope === 'tenant') {
    const row = await db.get(
      `SELECT content_json FROM landing_page_content WHERE scope='tenant' AND workspace_id = $1`,
      [workspaceId]
    );
    if (row) return merge(DEFAULT_CONTENT, row.content_json);
  } else {
    const row = await db.get(
      `SELECT content_json FROM landing_page_content WHERE scope='system_default'`
    );
    if (row) return merge(DEFAULT_CONTENT, row.content_json);
  }
  return DEFAULT_CONTENT;
}

module.exports = { DEFAULT_CONTENT, resolveContent, resolveDraft, merge };
