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

  // ============================================================
  // SEÇÕES OPCIONAIS — desligadas por padrão.
  // Quando enabled=true, renderizam entre o Quote e o CTA final.
  // Ordem de exibição: pricing → testimonials → faq.
  // ============================================================
  sections: {
    pricing: {
      enabled: false,
      tag: 'Planos',
      title: 'Escolha seu Nexus',
      subtitle: 'Comece simples, expanda quando o caixa pedir.',
      plans: [
        {
          name: 'Starter',
          tagline: 'Pra quem quer otimizar tráfego no automático',
          price: '297', period: '/mês',
          description: 'Tráfego pago monitorado e ajustado por IA, sem você abrir o Business Manager.',
          features: [
            { title: 'Sentinel', desc: 'Monitora suas campanhas Meta a cada 15 min e pausa, escala ou mantém — IA decide sozinha.' },
            { title: 'Launcher', desc: 'Sobe campanhas novas com estrutura pré-validada por nicho. Copy + segmentação geradas pela IA.' },
            { title: 'Hive',     desc: 'Boletim diário com padrões de alta conversão da rede pra replicar nas suas campanhas.' },
            { title: 'Suporte por e-mail', desc: 'Resposta em até 24h em dias úteis.' },
          ],
          cta_label: 'Começar', cta_href: '/comprar?plan=starter', highlight: false,
        },
        {
          name: 'Growth',
          tagline: 'Pra fechar venda sem você estar no WhatsApp',
          price: '497', period: '/mês',
          description: 'Tudo do Starter + vendedor IA que conversa, fecha e cobra direto no WhatsApp.',
          features: [
            { title: 'Tudo do Starter',  desc: 'Sentinel, Launcher e Hive incluídos.' },
            { title: 'Doppelgänger',     desc: 'Vendedor IA com a sua personalidade. Conversa, quebra objeção e gera PIX no WhatsApp.' },
            { title: 'Vending Machine',  desc: 'Auto-atendimento: cliente paga e em 5 min recebe campanha rodando.' },
            { title: 'Lazarus',          desc: 'Recupera carrinho abandonado e lead frio com mensagem personalizada por IA.' },
            { title: 'Suporte WhatsApp', desc: 'Resposta no mesmo dia em horário comercial.' },
          ],
          cta_label: 'Quero esse', cta_href: '/comprar?plan=growth', highlight: true,
        },
        {
          name: 'Elite',
          tagline: 'Pra rodar uma operação completa no piloto automático',
          price: '997', period: '/mês',
          description: 'Tudo do Growth + criação de assets, voz clonada e auditor estratégico autônomo.',
          features: [
            { title: 'Tudo do Growth',     desc: 'Sentinel, Doppelgänger, Vending, Lazarus.' },
            { title: 'Forge',              desc: 'Cria landing pages com headline dinâmica por anúncio. Mil variações da mesma LP.' },
            { title: 'Studio',             desc: 'Estúdio de voz IA via ElevenLabs pra disparar áudio personalizado no WhatsApp.' },
            { title: 'Titan',              desc: 'Auditor estratégico que aponta onde investir o caixa. CEO autônomo.' },
            { title: 'Onboarding 1:1',     desc: 'Sessão guiada de 1h pra setup das suas integrações e workflows.' },
          ],
          cta_label: 'Falar com vendas', cta_href: '/comprar?plan=elite', highlight: false,
        },
      ],
    },
    testimonials: {
      enabled: false,
      tag: 'Quem usa fala',
      title: 'Resultado em prova',
      subtitle: 'Donos de negócios que trocaram time inteiro pelo Nexus.',
      items: [
        { name: 'Carlos Mendes', role: 'CEO · Clínica Bella Pele',     quote: 'Em 30 dias o Doppelgänger fechou mais vendas que minha SDR fechou em 3 meses. Não dou mais conta de viver sem.', avatar: '' },
        { name: 'Ana Oliveira',  role: 'Sócia · Estúdio Acquaverde',    quote: 'O Sentinel pausou 6 anúncios que eu não tinha tempo de monitorar. Salvou R$ 4.200 num mês só.', avatar: '' },
        { name: 'Rafael Souza',  role: 'Founder · Acai do Bairro',      quote: 'Poltergeist + Vending: pedido cai, motoboy sai, comanda imprime. Sem operador. É surreal.', avatar: '' },
      ],
    },
    faq: {
      enabled: false,
      tag: 'Perguntas frequentes',
      title: 'Tira dúvidas em 30 segundos',
      subtitle: '',
      items: [
        { q: 'Preciso saber programar?',                 a: 'Não. Você só conecta suas contas (Meta Ads, WhatsApp, Mercado Pago) e o sistema opera sozinho. Quem programa é nossa IA.' },
        { q: 'Quanto tempo leva pra ativar?',            a: 'Em média 5 minutos depois do pagamento. Você recebe credenciais por e-mail, faz login e está dentro com os módulos liberados.' },
        { q: 'Posso cancelar a qualquer momento?',       a: 'Sim. Sem fidelidade, sem multa. Cancela direto pelo painel ou via WhatsApp.' },
        { q: 'O Doppelgänger fala como meus clientes?',  a: 'Configurável por workspace: você define nome, bio e estilo de escrita do "vendedor IA". Ele responde no WhatsApp imitando essa persona.' },
        { q: 'E se eu trocar de plano?',                 a: 'Troca direto na área Meu Plano. Upgrade libera módulos imediatamente. Downgrade vale a partir do próximo ciclo.' },
      ],
    },
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
