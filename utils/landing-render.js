/**
 * utils/landing-render.js
 *
 * Renderiza public/landing.html aplicando JSON de conteúdo via REGEX.
 * Zero dependências externas (jsdom dava timeout em cold-start Vercel
 * e tinha problema de ESM em html-encoding-sniffer).
 *
 * Estratégia:
 *   1. Carrega landing.html cru (cache de processo).
 *   2. Faz substituições cirúrgicas por padrões conhecidos:
 *      - inside-tag: <h1>...</h1>, <title>...</title>
 *      - attribute:  meta[name=description] content="..."
 *      - blocos:     stats, steps, footer.links via regex de capture
 *   3. Injeta seções opcionais (pricing/testimonials/faq) antes do CTA.
 */
const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(__dirname, '..', 'public', 'landing.html');
let _baseHtml = null;
function getBaseHtml() {
  if (!_baseHtml) _baseHtml = fs.readFileSync(HTML_PATH, 'utf8');
  return _baseHtml;
}

const escAttr = s => String(s ?? '').replace(/"/g, '&quot;');
const escText = s => String(s ?? '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

// Substitui o conteúdo entre uma tag de abertura específica e seu fechamento.
// `openRegex` deve ser uma regex que casa a tag de abertura (com flags).
function replaceTagContent(html, openRegex, closeTag, newInnerHtml) {
  return html.replace(
    new RegExp(`(${openRegex.source})[\\s\\S]*?(${closeTag.replace(/[/]/g,'\\/')})`, openRegex.flags),
    `$1${newInnerHtml}$2`
  );
}

function replaceMetaContent(html, metaName, value) {
  const re = new RegExp(`(<meta\\s+name="${metaName}"\\s+content=")[^"]*(")`);
  return html.replace(re, `$1${escAttr(value)}$2`);
}
function replaceMetaProperty(html, prop, value) {
  const re = new RegExp(`(<meta\\s+property="${prop}"\\s+content=")[^"]*(")`);
  return html.replace(re, `$1${escAttr(value)}$2`);
}

function render(content) {
  let html = getBaseHtml();
  const c = content || {};

  // ============== <head> ==============
  if (c.meta) {
    if (c.meta.title != null) {
      html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escText(c.meta.title)}</title>`);
    }
    if (c.meta.description != null) {
      html = replaceMetaContent(html, 'description', c.meta.description);
      html = replaceMetaProperty(html, 'og:description', c.meta.description);
    }
    if (c.meta.title != null) html = replaceMetaProperty(html, 'og:title', c.meta.title);
    if (c.meta.theme_color != null) html = replaceMetaContent(html, 'theme-color', c.meta.theme_color);
  }

  // ============== Hero ==============
  if (c.hero) {
    if (c.hero.badge != null) {
      // .badge contém um span.dot — preservamos
      html = html.replace(
        /(<div class="badge">\s*<span class="dot"[^>]*><\/span>\s*)([^<]*)(\s*<\/div>)/,
        `$1${escText(c.hero.badge)}$3`
      );
    }
    // h1: estrutura <h1> pre <span class="grad">grad</span> post </h1>
    if (c.hero.title_pre != null || c.hero.title_grad != null || c.hero.title_post != null) {
      const pre = escText(c.hero.title_pre ?? '');
      const grad = escText(c.hero.title_grad ?? '');
      const post = escText(c.hero.title_post ?? '');
      html = html.replace(
        /<h1>[\s\S]*?<\/h1>/,
        `<h1>\n      ${pre} <span class="grad">${grad}</span>${post ? ' ' + post : ''}\n    </h1>`
      );
    }
    if (c.hero.subtitle != null) {
      html = html.replace(
        /(<p class="hero-sub">)[\s\S]*?(<\/p>)/,
        `$1${escText(c.hero.subtitle)}$2`
      );
    }
    // hero CTAs
    if (c.hero.cta_primary_label || c.hero.cta_primary_href || c.hero.cta_secondary_label || c.hero.cta_secondary_href) {
      html = html.replace(
        /<div class="hero-cta"[^>]*>[\s\S]*?<\/div>/,
        () => {
          const p = `<a href="${escAttr(c.hero.cta_primary_href || '/login')}" class="btn-primary">${escText(c.hero.cta_primary_label || 'Acessar →')}</a>`;
          const s = c.hero.cta_secondary_label
            ? `<a href="${escAttr(c.hero.cta_secondary_href || '/comprar')}" class="btn-secondary">${escText(c.hero.cta_secondary_label)}</a>`
            : '';
          return `<div class="hero-cta">${p}${s}</div>`;
        }
      );
    }
  }

  // ============== Stats ==============
  if (Array.isArray(c.stats)) {
    html = html.replace(
      /(<div class="stats-grid">)[\s\S]*?(<\/div>\s*<\/div>\s*<\/section>)/,
      (match, open, close) => {
        const items = c.stats.map(s => `
        <div>
          <div class="stat-num">${escText(s.num ?? '')}</div>
          <div class="stat-label">${escText(s.label ?? '')}</div>
        </div>`).join('');
        return `${open}${items}\n      ${close}`;
      }
    );
  }

  // ============== How section (3 steps) ==============
  if (c.how) {
    if (c.how.tag != null || c.how.title != null || c.how.subtitle != null) {
      // Primeiro <section class="s"> contém Como funciona
      html = html.replace(
        /(<section class="s">[\s\S]*?<div class="container">\s*)(<div class="section-tag">)[\s\S]*?(<\/p>)/,
        (m, prefix) => {
          return prefix +
            `<div class="section-tag">${escText(c.how.tag ?? 'Como funciona')}</div>\n      ` +
            `<h2 class="section-title">${escText(c.how.title ?? '')}</h2>\n      ` +
            `<p class="section-sub">${escText(c.how.subtitle ?? '')}</p>`;
        }
      );
    }
    if (Array.isArray(c.how.steps)) {
      html = html.replace(
        /(<div class="how">)[\s\S]*?(<\/div>\s*<\/div>\s*<\/section>)/,
        (m, open, close) => {
          // mantém ícones SVG originais — pega do landing.html base
          const baseIconsMatch = getBaseHtml().match(/<div class="how">([\s\S]*?)<\/div>\s*<\/div>\s*<\/section>/);
          const stepIcons = [];
          if (baseIconsMatch) {
            const stepBlocks = baseIconsMatch[1].match(/<div class="step-icon">[\s\S]*?<\/div>/g) || [];
            stepIcons.push(...stepBlocks);
          }
          const items = c.how.steps.map((s, i) => `
      <div class="step">
        <div class="step-num">${i + 1}</div>
        ${stepIcons[i] || '<div class="step-icon"></div>'}
        <h3 class="step-title">${escText(s.title ?? '')}</h3>
        <p class="step-desc">${escText(s.desc ?? '')}</p>
      </div>`).join('');
          return `${open}${items}\n    ${close}`;
        }
      );
    }
  }

  // ============== Modules section header ==============
  if (c.modules_section) {
    html = html.replace(
      /(<section class="s">[\s\S]*?<div class="section-tag">Módulos<\/div>[\s\S]*?<p class="section-sub">)[\s\S]*?(<\/p>)/,
      (m, p1, p2) => {
        // Substitui o tag/título/subtítulo da seção Módulos
        const tagText = c.modules_section.tag ?? 'Módulos';
        const titleText = c.modules_section.title ?? '';
        const subText = c.modules_section.subtitle ?? '';
        return p1
          .replace(/<div class="section-tag">[^<]*<\/div>/, `<div class="section-tag">${escText(tagText)}</div>`)
          .replace(/<h2 class="section-title">[\s\S]*?<\/h2>/, `<h2 class="section-title">${escText(titleText)}</h2>`)
          .replace(/<p class="section-sub">$/, `<p class="section-sub">${escText(subText)}`)
          + p2;
      }
    );
  }

  // ============== Quote ==============
  if (c.quote) {
    if (c.quote.text != null) {
      html = html.replace(
        /(<p class="big-quote">)[\s\S]*?(<\/p>)/,
        `$1${escText(c.quote.text)}$2`
      );
    }
    if (c.quote.author != null) {
      html = html.replace(
        /(<div class="quote-author">)[\s\S]*?(<\/div>)/,
        `$1${escText(c.quote.author)}$2`
      );
    }
  }

  // ============== CTA final ==============
  if (c.cta_final) {
    if (c.cta_final.title != null) {
      html = html.replace(
        /(<h2 class="cta-title">)[\s\S]*?(<\/h2>)/,
        `$1${escText(c.cta_final.title)}$2`
      );
    }
    if (c.cta_final.subtitle != null) {
      html = html.replace(
        /(<p class="cta-sub">)[\s\S]*?(<\/p>)/,
        `$1${escText(c.cta_final.subtitle)}$2`
      );
    }
    if (c.cta_final.button_label != null || c.cta_final.button_href != null) {
      html = html.replace(
        /(<section class="cta-section">[\s\S]*?<a\s+)href="[^"]*"([^>]*>)[\s\S]*?(<\/a>)/,
        `$1href="${escAttr(c.cta_final.button_href || '/login')}"$2${escText(c.cta_final.button_label || 'Entrar →')}$3`
      );
    }
  }

  // ============== Footer ==============
  if (c.footer) {
    if (c.footer.copyright != null) {
      html = html.replace(
        /(<div class="footer-left">)[\s\S]*?(<\/div>)/,
        `$1${escText(c.footer.copyright)}$2`
      );
    }
    if (Array.isArray(c.footer.links)) {
      const linksHtml = c.footer.links.map(l =>
        `<a href="${escAttr(l.href || '#')}" class="footer-link">${escText(l.label || '')}</a>`
      ).join('');
      html = html.replace(
        /(<div class="footer-links">)[\s\S]*?(<\/div>)/,
        `$1${linksHtml}$2`
      );
    }
  }

  // ============== Seções opcionais ==============
  if (c.sections) {
    const optHtml = renderOptionalSections(c.sections);
    if (optHtml) {
      // Insere antes do <section class="cta-section">
      html = html.replace(
        /<section class="cta-section">/,
        `${optHtml}\n<section class="cta-section">`
      );
      // Adiciona CSS antes de </head>
      html = html.replace(
        /<\/head>/,
        `<style>${OPTIONAL_SECTIONS_CSS}</style>\n</head>`
      );
    }
  }

  return html;
}

// ============================================================
// Seções opcionais
// ============================================================

function renderOptionalSections(sec) {
  let html = '';
  if (sec.pricing?.enabled)      html += renderPricing(sec.pricing);
  if (sec.testimonials?.enabled) html += renderTestimonials(sec.testimonials);
  if (sec.faq?.enabled)          html += renderFAQ(sec.faq);
  return html;
}

function renderPricing(p) {
  const plans = (p.plans || []).map(plan => {
    const features = (plan.features || []).map(f => {
      // Retrocompat: feature pode ser string (legado) ou {title, desc} (novo)
      if (typeof f === 'string') return `<li class="opt-feat"><div class="opt-feat-title">${escText(f)}</div></li>`;
      const title = escText(f.title || '');
      const desc = f.desc ? `<div class="opt-feat-desc">${escText(f.desc)}</div>` : '';
      return `<li class="opt-feat"><div class="opt-feat-title">${title}</div>${desc}</li>`;
    }).join('');
    return `
    <div class="opt-pcard ${plan.highlight ? 'opt-pcard-highlight' : ''}">
      ${plan.highlight ? '<div class="opt-pcard-tag">Mais popular</div>' : ''}
      <div class="opt-pcard-name">${escText(plan.name)}</div>
      ${plan.tagline ? `<div class="opt-pcard-tagline">${escText(plan.tagline)}</div>` : ''}
      <div class="opt-pcard-price">R$ ${escText(plan.price)}<small>${escText(plan.period || '/mês')}</small></div>
      ${plan.description ? `<div class="opt-pcard-desc">${escText(plan.description)}</div>` : ''}
      <ul class="opt-pcard-feats">${features}</ul>
      <a href="${escAttr(plan.cta_href || '/comprar')}" class="opt-pcard-btn">${escText(plan.cta_label || 'Começar')}</a>
    </div>`;
  }).join('');
  return `<section class="s opt-pricing">
    <div class="container">
      <div class="section-tag">${escText(p.tag || 'Planos')}</div>
      <h2 class="section-title">${escText(p.title || 'Escolha seu plano')}</h2>
      <p class="section-sub">${escText(p.subtitle || '')}</p>
      <div class="opt-pricing-grid">${plans}</div>
    </div>
  </section>`;
}

function renderTestimonials(t) {
  const cards = (t.items || []).map(it => `
    <div class="opt-test-card">
      <div class="opt-test-quote">"${escText(it.quote || '')}"</div>
      <div class="opt-test-author">
        ${it.avatar ? `<img class="opt-test-avatar" src="${escAttr(it.avatar)}" alt="${escAttr(it.name)}">` : `<div class="opt-test-avatar opt-test-avatar-fallback">${escText((it.name || '?').charAt(0))}</div>`}
        <div>
          <div class="opt-test-name">${escText(it.name || '')}</div>
          <div class="opt-test-role">${escText(it.role || '')}</div>
        </div>
      </div>
    </div>`).join('');
  return `<section class="s opt-test">
    <div class="container">
      <div class="section-tag">${escText(t.tag || 'Quem usa fala')}</div>
      <h2 class="section-title">${escText(t.title || 'Resultado em prova')}</h2>
      <p class="section-sub">${escText(t.subtitle || '')}</p>
      <div class="opt-test-grid">${cards}</div>
    </div>
  </section>`;
}

function renderFAQ(f) {
  const items = (f.items || []).map((it, i) => `
    <details class="opt-faq-item" ${i === 0 ? 'open' : ''}>
      <summary>${escText(it.q || '')}</summary>
      <div class="opt-faq-a">${escText(it.a || '')}</div>
    </details>`).join('');
  return `<section class="s opt-faq">
    <div class="container" style="max-width:760px;">
      <div class="section-tag">${escText(f.tag || 'FAQ')}</div>
      <h2 class="section-title">${escText(f.title || 'Perguntas frequentes')}</h2>
      ${f.subtitle ? `<p class="section-sub">${escText(f.subtitle)}</p>` : ''}
      <div class="opt-faq-list">${items}</div>
    </div>
  </section>`;
}

const OPTIONAL_SECTIONS_CSS = `
.opt-pricing-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;margin-top:32px}
.opt-pcard{background:var(--bg-card,#15151d);border:1px solid var(--border,#222230);border-radius:14px;padding:28px 24px;position:relative;transition:transform .2s,border-color .2s}
.opt-pcard:hover{transform:translateY(-3px);border-color:var(--border-2,#2a2a38)}
.opt-pcard-highlight{border-color:var(--accent,#0099ff);background:linear-gradient(135deg,rgba(0,153,255,.08),rgba(0,212,255,.02))}
.opt-pcard-tag{position:absolute;top:-10px;left:24px;background:var(--gradient,linear-gradient(135deg,#0099ff,#00d4ff));color:#000;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
.opt-pcard-name{font-size:20px;font-weight:800;margin-bottom:4px}
.opt-pcard-tagline{color:var(--accent-2,#00d4ff);font-size:12px;text-transform:uppercase;letter-spacing:.05em;font-weight:600;margin-bottom:16px;font-family:'JetBrains Mono',monospace}
.opt-pcard-desc{color:var(--text-2,#b8b8c5);font-size:13px;line-height:1.55;margin-bottom:18px}
.opt-pcard-price{font-family:'JetBrains Mono',monospace;font-size:36px;font-weight:800;color:var(--accent,#0099ff);margin-bottom:6px;line-height:1}
.opt-pcard-price small{font-size:13px;color:var(--muted,#7a7a88);font-weight:400}
.opt-pcard-feats{list-style:none;padding:0;margin:18px 0 24px 0}
.opt-pcard-feats .opt-feat{padding:10px 0;border-top:1px solid var(--border,#222230);display:flex;flex-direction:column;gap:3px}
.opt-pcard-feats .opt-feat:first-child{border-top:none;padding-top:4px}
.opt-pcard-feats .opt-feat-title{font-size:13px;font-weight:700;color:var(--text,#f0f0f5);position:relative;padding-left:18px}
.opt-pcard-feats .opt-feat-title::before{content:'';position:absolute;left:0;top:5px;width:11px;height:6px;border-left:2px solid #22c55e;border-bottom:2px solid #22c55e;transform:rotate(-45deg)}
.opt-pcard-feats .opt-feat-desc{font-size:12px;color:var(--muted,#7a7a88);line-height:1.45;padding-left:18px}
.opt-pcard-btn{display:block;width:100%;padding:11px;background:var(--gradient,linear-gradient(135deg,#0099ff,#00d4ff));color:#000;font-weight:700;text-align:center;border-radius:8px;text-decoration:none;font-size:14px}
.opt-pcard-btn:hover{opacity:.9}
.opt-test-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin-top:32px}
.opt-test-card{background:var(--bg-card,#15151d);border:1px solid var(--border,#222230);border-radius:12px;padding:24px}
.opt-test-quote{color:var(--text,#f0f0f5);font-size:15px;line-height:1.55;margin-bottom:20px;font-style:italic}
.opt-test-author{display:flex;align-items:center;gap:12px}
.opt-test-avatar{width:42px;height:42px;border-radius:50%;object-fit:cover}
.opt-test-avatar-fallback{background:var(--gradient,linear-gradient(135deg,#0099ff,#00d4ff));color:#000;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px}
.opt-test-name{font-weight:700;font-size:14px}
.opt-test-role{color:var(--muted,#7a7a88);font-size:12px}
.opt-faq-list{margin-top:32px}
.opt-faq-item{background:var(--bg-card,#15151d);border:1px solid var(--border,#222230);border-radius:10px;padding:0;margin-bottom:10px;overflow:hidden}
.opt-faq-item summary{padding:18px 22px;cursor:pointer;font-weight:600;font-size:15px;list-style:none;position:relative}
.opt-faq-item summary::-webkit-details-marker{display:none}
.opt-faq-item summary::after{content:'+';position:absolute;right:22px;color:var(--accent,#0099ff);font-size:22px;line-height:1;transition:transform .2s}
.opt-faq-item[open] summary::after{transform:rotate(45deg)}
.opt-faq-a{padding:0 22px 20px;color:var(--text-2,#b8b8c5);font-size:14px;line-height:1.6}
`.trim();

module.exports = { render };
