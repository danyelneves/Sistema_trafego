/**
 * routes/terms.js — Termos, Privacidade e aceite (LGPD).
 *
 * Públicos:
 *   GET  /termos              → HTML renderizado dos Termos
 *   GET  /privacidade         → HTML renderizado da Política
 *   GET  /api/terms/current   → JSON com IDs/hashes correntes (pro checkout)
 *   POST /api/terms/accept    → registra aceite (pending_signup_id, IP, UA)
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const audit = require('../utils/audit');
const terms = require('../utils/terms');

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || null;
}

function renderPage(row) {
  const css = `
    body{margin:0;background:#0a0a0e;color:#e8e8ee;font:16px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
    .wrap{max-width:780px;margin:0 auto;padding:48px 24px 80px;}
    .topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;padding-bottom:16px;border-bottom:1px solid #222230;}
    .logo{font-weight:800;letter-spacing:-.5px;color:#0099ff;text-decoration:none;font-size:18px;}
    .meta{color:#7a7a88;font-size:12px;}
    h1{font-size:32px;font-weight:800;letter-spacing:-1px;margin:0 0 8px;color:#f0f0f5;}
    h2{font-size:22px;font-weight:700;margin:40px 0 12px;color:#f0f0f5;border-top:1px solid #222230;padding-top:32px;}
    h3{font-size:17px;font-weight:600;margin:24px 0 8px;color:#cfcfd8;}
    p{margin:0 0 14px;color:#bcbcc8;}
    a{color:#00d4ff;}
    strong{color:#f0f0f5;}
    ul,ol{margin:0 0 16px;padding-left:24px;color:#bcbcc8;}
    li{margin:4px 0;}
    table{width:100%;border-collapse:collapse;margin:16px 0;background:#13131a;border-radius:8px;overflow:hidden;font-size:14px;}
    th,td{padding:10px 14px;border-bottom:1px solid #222230;text-align:left;}
    th{background:#1a1a23;color:#f0f0f5;font-weight:600;}
    td{color:#bcbcc8;}
    hr{border:none;border-top:1px solid #222230;margin:32px 0;}
    code{background:#1a1a23;padding:2px 6px;border-radius:4px;font-size:13px;color:#00d4ff;}
    em{color:#7a7a88;}
    .foot{margin-top:48px;padding-top:24px;border-top:1px solid #222230;color:#7a7a88;font-size:13px;text-align:center;}
    .foot a{color:#00d4ff;text-decoration:none;}
  `;
  return `<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${row.title} · Nexus OS</title>
<meta name="robots" content="index,follow">
<style>${css}</style></head><body>
<div class="wrap">
  <div class="topbar">
    <a href="/" class="logo">NEXUS·OS</a>
    <div class="meta">v${row.version} · hash <code>${row.hash.slice(0, 12)}</code></div>
  </div>
  ${row.content_html}
  <div class="foot">
    <a href="/">Início</a> · <a href="/termos">Termos</a> · <a href="/privacidade">Privacidade</a> · <a href="/comprar">Contratar</a>
  </div>
</div></body></html>`;
}

// ============================================================
// Páginas públicas
// ============================================================

router.get('/termos', async (req, res) => {
  try {
    const row = await terms.getCurrent('terms');
    res.set('Content-Type', 'text/html; charset=utf-8').send(renderPage(row));
  } catch (e) {
    res.status(500).send(`<pre>Erro: ${e.message}</pre>`);
  }
});

router.get('/privacidade', async (req, res) => {
  try {
    const row = await terms.getCurrent('privacy');
    res.set('Content-Type', 'text/html; charset=utf-8').send(renderPage(row));
  } catch (e) {
    res.status(500).send(`<pre>Erro: ${e.message}</pre>`);
  }
});

// ============================================================
// API pro checkout
// ============================================================

/** GET /api/terms/current → IDs+hashes correntes pra UI snapshot. */
router.get('/api/terms/current', async (req, res) => {
  try {
    const [t, p] = await Promise.all([terms.getCurrent('terms'), terms.getCurrent('privacy')]);
    res.json({
      ok: true,
      terms:   { id: t.id, version: t.version, hash: t.hash, url: '/termos' },
      privacy: { id: p.id, version: p.version, hash: p.hash, url: '/privacidade' },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * POST /api/terms/accept
 * Body: { email, name, pending_signup_id?, accepted: true }
 * Registra aceite com IP/UA. Retorna acceptance_id pra ser usado no /onboarding/start.
 */
router.post('/api/terms/accept', async (req, res) => {
  try {
    const { email, pending_signup_id, accepted } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email obrigatório' });
    if (accepted !== true) return res.status(400).json({ error: 'aceite explícito obrigatório (accepted: true)' });

    const [t, p] = await Promise.all([terms.getCurrent('terms'), terms.getCurrent('privacy')]);

    const row = await db.get(
      `INSERT INTO terms_acceptances
         (email, pending_signup_id, terms_version_id, privacy_version_id, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, accepted_at`,
      [
        email.toLowerCase().trim(),
        pending_signup_id || null,
        t.id, p.id,
        getClientIp(req),
        (req.headers['user-agent'] || '').slice(0, 500),
      ]
    );

    audit.log('terms.accepted', {
      acceptance_id: row.id, email, ip: getClientIp(req),
      terms_version: t.version, privacy_version: p.version,
      pending_signup_id: pending_signup_id || null,
    });

    res.json({
      ok: true,
      acceptance_id: row.id,
      accepted_at: row.accepted_at,
      terms_version: t.version,
      privacy_version: p.version,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
