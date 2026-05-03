/**
 * utils/landing-render.js
 *
 * Renderiza public/landing.html aplicando o JSON de conteúdo via DOM.
 * Mantém o layout existente intocado — só substitui textos/atributos
 * de elementos identificados.
 *
 * O HTML base é lido 1x na inicialização (cache de processo).
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const HTML_PATH = path.join(__dirname, '..', 'public', 'landing.html');
let _baseHtml = null;
function getBaseHtml() {
  if (!_baseHtml) _baseHtml = fs.readFileSync(HTML_PATH, 'utf8');
  return _baseHtml;
}

function setText(doc, selector, text) {
  if (text == null) return;
  const el = doc.querySelector(selector);
  if (el) el.textContent = text;
}
function setHref(doc, selector, href) {
  if (href == null) return;
  const el = doc.querySelector(selector);
  if (el) el.setAttribute('href', href);
}
function setAttr(doc, selector, attr, value) {
  if (value == null) return;
  const el = doc.querySelector(selector);
  if (el) el.setAttribute(attr, value);
}

function render(content) {
  const dom = new JSDOM(getBaseHtml());
  const { document: doc } = dom.window;
  const c = content || {};

  // <head>
  if (c.meta) {
    setText(doc, 'title', c.meta.title);
    setAttr(doc, 'meta[name="description"]',     'content', c.meta.description);
    setAttr(doc, 'meta[property="og:title"]',     'content', c.meta.title);
    setAttr(doc, 'meta[property="og:description"]', 'content', c.meta.description);
    setAttr(doc, 'meta[name="theme-color"]',      'content', c.meta.theme_color);
  }

  // Nav (logo + CTA topo) — opcional
  // .logo é o texto do header; estrutura atual: <a class="logo">...
  if (c.nav) {
    setHref(doc, '.nav-links a.btn-primary', c.nav.cta_href);
    const cta = doc.querySelector('.nav-links a.btn-primary');
    if (cta && c.nav.cta_label) {
      // mantém setas/elementos internos: troca só o texto do nó
      cta.textContent = c.nav.cta_label;
    }
  }

  // Hero
  if (c.hero) {
    setText(doc, '.hero .badge', c.hero.badge);

    const h1 = doc.querySelector('.hero h1');
    if (h1) {
      // Estrutura: "<pre> <span class=grad>grad</span><post>"
      const grad = h1.querySelector('.grad');
      if (grad && c.hero.title_grad != null) grad.textContent = c.hero.title_grad;
      // Substitui apenas os text-nodes adjacentes (seguro)
      let pre = c.hero.title_pre, post = c.hero.title_post;
      if (pre != null || post != null) {
        // Remove text nodes existentes mantendo o span
        const children = Array.from(h1.childNodes);
        children.forEach(n => { if (n.nodeType === 3) h1.removeChild(n); });
        if (pre != null) h1.insertBefore(doc.createTextNode(pre + ' '), grad || null);
        if (post != null) h1.appendChild(doc.createTextNode(' ' + post));
      }
    }

    setText(doc, '.hero p.hero-sub', c.hero.subtitle);

    const ctas = doc.querySelectorAll('.hero-cta a, .hero-cta button');
    if (ctas[0] && c.hero.cta_primary_label != null) ctas[0].textContent = c.hero.cta_primary_label;
    if (ctas[0] && c.hero.cta_primary_href != null && ctas[0].tagName === 'A') ctas[0].setAttribute('href', c.hero.cta_primary_href);
    if (ctas[1] && c.hero.cta_secondary_label != null) ctas[1].textContent = c.hero.cta_secondary_label;
    if (ctas[1] && c.hero.cta_secondary_href != null && ctas[1].tagName === 'A') ctas[1].setAttribute('href', c.hero.cta_secondary_href);
  }

  // Stats
  if (Array.isArray(c.stats)) {
    const items = doc.querySelectorAll('.stats-grid > div');
    c.stats.forEach((s, i) => {
      if (!items[i]) return;
      const num = items[i].querySelector('.stat-num');
      const lab = items[i].querySelector('.stat-label');
      if (num && s.num != null) num.textContent = s.num;
      if (lab && s.label != null) lab.textContent = s.label;
    });
  }

  // How section
  if (c.how) {
    const sections = doc.querySelectorAll('section.s');
    const howSection = sections[0]; // primeiro "section.s" = "Como funciona"
    if (howSection) {
      const tag = howSection.querySelector('.section-tag');
      const title = howSection.querySelector('.section-title');
      const sub = howSection.querySelector('.section-sub');
      if (tag && c.how.tag) tag.textContent = c.how.tag;
      if (title && c.how.title) title.textContent = c.how.title;
      if (sub && c.how.subtitle) sub.textContent = c.how.subtitle;
      if (Array.isArray(c.how.steps)) {
        const stepEls = howSection.querySelectorAll('.step');
        c.how.steps.forEach((s, i) => {
          if (!stepEls[i]) return;
          const t = stepEls[i].querySelector('.step-title');
          const d = stepEls[i].querySelector('.step-desc');
          if (t && s.title) t.textContent = s.title;
          if (d && s.desc) d.textContent = s.desc;
        });
      }
    }
  }

  // Modules section header (cards das modules ficam estáticos por enquanto)
  if (c.modules_section) {
    const sections = doc.querySelectorAll('section.s');
    const modSection = sections[1]; // segundo "section.s" = "Módulos"
    if (modSection) {
      const tag = modSection.querySelector('.section-tag');
      const title = modSection.querySelector('.section-title');
      const sub = modSection.querySelector('.section-sub');
      if (tag && c.modules_section.tag) tag.textContent = c.modules_section.tag;
      if (title && c.modules_section.title) title.textContent = c.modules_section.title;
      if (sub && c.modules_section.subtitle) sub.textContent = c.modules_section.subtitle;
    }
  }

  // Quote
  if (c.quote) {
    const q = doc.querySelector('.big-quote');
    const a = doc.querySelector('.quote-author');
    if (q && c.quote.text) {
      // Mantém .grad se existir
      const grad = q.querySelector('.grad');
      if (grad) {
        // Reconstrói: "Texto antes <grad>grad</grad> Texto depois"
        // No template original o grad é "não é um SaaS"; aqui simplificamos:
        // se houver grad, deixa o conteúdo todo no q sem grad — usuário pode editar texto cheio
        q.textContent = c.quote.text;
      } else {
        q.textContent = c.quote.text;
      }
    }
    if (a && c.quote.author) a.textContent = c.quote.author;
  }

  // CTA final
  if (c.cta_final) {
    const ctaSection = doc.querySelector('.cta-section');
    if (ctaSection) {
      const t = ctaSection.querySelector('.cta-title');
      const s = ctaSection.querySelector('.cta-sub');
      const btn = ctaSection.querySelector('a, button');
      if (t && c.cta_final.title) t.textContent = c.cta_final.title;
      if (s && c.cta_final.subtitle) s.textContent = c.cta_final.subtitle;
      if (btn) {
        if (c.cta_final.button_label) btn.textContent = c.cta_final.button_label;
        if (c.cta_final.button_href && btn.tagName === 'A') btn.setAttribute('href', c.cta_final.button_href);
      }
    }
  }

  // Footer
  if (c.footer) {
    const footer = doc.querySelector('footer');
    if (footer) {
      const left = footer.querySelector('.footer-left');
      if (left && c.footer.copyright) left.textContent = c.footer.copyright;
      if (Array.isArray(c.footer.links)) {
        const linksWrap = footer.querySelector('.footer-links');
        if (linksWrap) {
          linksWrap.innerHTML = c.footer.links.map(l =>
            `<a href="${escapeAttr(l.href)}" class="footer-link">${escapeText(l.label)}</a>`
          ).join('');
        }
      }
    }
  }

  // Seções opcionais: pricing → testimonials → faq, inseridas antes do CTA final.
  if (c.sections) {
    const ctaSection = doc.querySelector('section.cta-section');
    const optHtml = renderOptionalSections(c.sections);
    if (optHtml && ctaSection?.parentNode) {
      const wrapper = doc.createElement('div');
      wrapper.innerHTML = optHtml;
      // Insere todos os children antes do CTA
      while (wrapper.firstChild) {
        ctaSection.parentNode.insertBefore(wrapper.firstChild, ctaSection);
      }
      // Adiciona CSS uma vez no <head>
      const style = doc.createElement('style');
      style.textContent = OPTIONAL_SECTIONS_CSS;
      doc.head.appendChild(style);
    }
  }

  return dom.serialize();
}

function escapeAttr(s) { return String(s || '').replace(/"/g, '&quot;'); }
function escapeText(s) { return String(s || '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

// ============================================================
// Seções opcionais (renderizadas só quando enabled=true)
// ============================================================

function renderOptionalSections(sec) {
  let html = '';
  if (sec.pricing?.enabled)      html += renderPricing(sec.pricing);
  if (sec.testimonials?.enabled) html += renderTestimonials(sec.testimonials);
  if (sec.faq?.enabled)          html += renderFAQ(sec.faq);
  return html;
}

function renderPricing(p) {
  const plans = (p.plans || []).map(plan => `
    <div class="opt-pcard ${plan.highlight ? 'opt-pcard-highlight' : ''}">
      ${plan.highlight ? '<div class="opt-pcard-tag">Mais popular</div>' : ''}
      <div class="opt-pcard-name">${escapeText(plan.name)}</div>
      <div class="opt-pcard-desc">${escapeText(plan.description || '')}</div>
      <div class="opt-pcard-price">R$ ${escapeText(plan.price)}<small>${escapeText(plan.period || '/mês')}</small></div>
      <ul class="opt-pcard-feats">${(plan.features || []).map(f => `<li>${escapeText(f)}</li>`).join('')}</ul>
      <a href="${escapeAttr(plan.cta_href || '/comprar')}" class="opt-pcard-btn">${escapeText(plan.cta_label || 'Começar')}</a>
    </div>`).join('');
  return `<section class="s opt-pricing">
    <div class="container">
      <div class="section-tag">${escapeText(p.tag || 'Planos')}</div>
      <h2 class="section-title">${escapeText(p.title || 'Escolha seu plano')}</h2>
      <p class="section-sub">${escapeText(p.subtitle || '')}</p>
      <div class="opt-pricing-grid">${plans}</div>
    </div>
  </section>`;
}

function renderTestimonials(t) {
  const cards = (t.items || []).map(it => `
    <div class="opt-test-card">
      <div class="opt-test-quote">"${escapeText(it.quote || '')}"</div>
      <div class="opt-test-author">
        ${it.avatar ? `<img class="opt-test-avatar" src="${escapeAttr(it.avatar)}" alt="${escapeAttr(it.name)}">` : `<div class="opt-test-avatar opt-test-avatar-fallback">${escapeText((it.name || '?').charAt(0))}</div>`}
        <div>
          <div class="opt-test-name">${escapeText(it.name || '')}</div>
          <div class="opt-test-role">${escapeText(it.role || '')}</div>
        </div>
      </div>
    </div>`).join('');
  return `<section class="s opt-test">
    <div class="container">
      <div class="section-tag">${escapeText(t.tag || 'Quem usa fala')}</div>
      <h2 class="section-title">${escapeText(t.title || 'Resultado em prova')}</h2>
      <p class="section-sub">${escapeText(t.subtitle || '')}</p>
      <div class="opt-test-grid">${cards}</div>
    </div>
  </section>`;
}

function renderFAQ(f) {
  const items = (f.items || []).map((it, i) => `
    <details class="opt-faq-item" ${i === 0 ? 'open' : ''}>
      <summary>${escapeText(it.q || '')}</summary>
      <div class="opt-faq-a">${escapeText(it.a || '')}</div>
    </details>`).join('');
  return `<section class="s opt-faq">
    <div class="container" style="max-width:760px;">
      <div class="section-tag">${escapeText(f.tag || 'FAQ')}</div>
      <h2 class="section-title">${escapeText(f.title || 'Perguntas frequentes')}</h2>
      ${f.subtitle ? `<p class="section-sub">${escapeText(f.subtitle)}</p>` : ''}
      <div class="opt-faq-list">${items}</div>
    </div>
  </section>`;
}

const OPTIONAL_SECTIONS_CSS = `
/* === seções opcionais (geradas pelo editor de landing) === */
.opt-pricing-grid{display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:20px; margin-top:32px;}
.opt-pcard{background:var(--bg-card,#15151d); border:1px solid var(--border,#222230); border-radius:14px; padding:28px 24px; position:relative; transition:transform .2s, border-color .2s;}
.opt-pcard:hover{transform:translateY(-3px); border-color:var(--border-2,#2a2a38);}
.opt-pcard-highlight{border-color:var(--accent,#0099ff); background:linear-gradient(135deg, rgba(0,153,255,.08), rgba(0,212,255,.02));}
.opt-pcard-tag{position:absolute; top:-10px; left:24px; background:var(--gradient,linear-gradient(135deg,#0099ff,#00d4ff)); color:#000; padding:3px 10px; border-radius:4px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em;}
.opt-pcard-name{font-size:18px; font-weight:700; margin-bottom:6px;}
.opt-pcard-desc{color:var(--muted,#7a7a88); font-size:13px; min-height:34px; margin-bottom:16px;}
.opt-pcard-price{font-family:'JetBrains Mono',monospace; font-size:36px; font-weight:800; color:var(--accent,#0099ff); margin-bottom:18px; line-height:1;}
.opt-pcard-price small{font-size:13px; color:var(--muted,#7a7a88); font-weight:400;}
.opt-pcard-feats{list-style:none; padding:0; margin:0 0 24px 0; font-size:13px; color:var(--text-2,#b8b8c5);}
.opt-pcard-feats li{padding:5px 0;}
.opt-pcard-feats li::before{content:'✓ '; color:#22c55e; font-weight:700;}
.opt-pcard-btn{display:block; width:100%; padding:11px; background:var(--gradient,linear-gradient(135deg,#0099ff,#00d4ff)); color:#000; font-weight:700; text-align:center; border-radius:8px; text-decoration:none; font-size:14px;}
.opt-pcard-btn:hover{opacity:.9;}

.opt-test-grid{display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:20px; margin-top:32px;}
.opt-test-card{background:var(--bg-card,#15151d); border:1px solid var(--border,#222230); border-radius:12px; padding:24px;}
.opt-test-quote{color:var(--text,#f0f0f5); font-size:15px; line-height:1.55; margin-bottom:20px; font-style:italic;}
.opt-test-author{display:flex; align-items:center; gap:12px;}
.opt-test-avatar{width:42px; height:42px; border-radius:50%; object-fit:cover;}
.opt-test-avatar-fallback{background:var(--gradient,linear-gradient(135deg,#0099ff,#00d4ff)); color:#000; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:16px;}
.opt-test-name{font-weight:700; font-size:14px;}
.opt-test-role{color:var(--muted,#7a7a88); font-size:12px;}

.opt-faq-list{margin-top:32px;}
.opt-faq-item{background:var(--bg-card,#15151d); border:1px solid var(--border,#222230); border-radius:10px; padding:0; margin-bottom:10px; overflow:hidden;}
.opt-faq-item summary{padding:18px 22px; cursor:pointer; font-weight:600; font-size:15px; list-style:none; position:relative;}
.opt-faq-item summary::-webkit-details-marker{display:none;}
.opt-faq-item summary::after{content:'+'; position:absolute; right:22px; color:var(--accent,#0099ff); font-size:22px; line-height:1; transition:transform .2s;}
.opt-faq-item[open] summary::after{transform:rotate(45deg);}
.opt-faq-a{padding:0 22px 20px; color:var(--text-2,#b8b8c5); font-size:14px; line-height:1.6;}
`;

module.exports = { render };
