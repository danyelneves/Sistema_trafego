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

  return dom.serialize();
}

function escapeAttr(s) { return String(s || '').replace(/"/g, '&quot;'); }
function escapeText(s) { return String(s || '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

module.exports = { render };
