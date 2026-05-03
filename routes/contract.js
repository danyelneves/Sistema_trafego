/**
 * routes/contract.js — download e verificação pública de contratos.
 *
 * GET  /api/contract/:signup_id/pdf       → baixa PDF (auth: email do signer ou admin)
 * GET  /api/contract/verify/:hash         → verifica integridade (público, só metadados)
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const audit = require('../utils/audit');
const contracts = require('../utils/contract');

/**
 * GET /api/contract/:signup_id/pdf
 * Acesso:
 *  - se logado: precisa ser admin do workspace dono OU super-admin
 *  - se não logado: aceita ?token=<sha256(signup_id+email)> enviado por email
 */
router.get('/api/contract/:signup_id/pdf', async (req, res) => {
  try {
    const signup_id = parseInt(req.params.signup_id, 10);
    if (!signup_id) return res.status(400).json({ error: 'invalid signup_id' });

    const sig = await db.get(
      `SELECT * FROM contract_signatures WHERE pending_signup_id = $1`, [signup_id]
    );
    if (!sig) return res.status(404).json({ error: 'contract_not_found' });

    // Auth: super-admin (ws=1), admin do workspace dono, OU token de download
    let allowed = false;
    if (req.user) {
      if (req.user.role === 'admin' && req.user.workspace_id === 1) allowed = true;
      else if (req.user.workspace_id === sig.workspace_id && req.user.role === 'admin') allowed = true;
    }
    if (!allowed && req.query.token) {
      const crypto = require('crypto');
      const expected = crypto.createHash('sha256')
        .update(`${signup_id}:${sig.signer_email}:${process.env.JWT_SECRET || 'dev'}`)
        .digest('hex').slice(0, 32);
      if (req.query.token === expected) allowed = true;
    }
    if (!allowed) return res.status(403).json({ error: 'forbidden' });

    const pdf = await contracts.renderPdf(sig);
    audit.log('contract.pdf_downloaded', {
      signup_id, contract_hash: sig.contract_hash,
      ip: req.ip, by: req.user?.username || 'token',
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="contrato-nexus-${signup_id}.pdf"`,
      'Cache-Control': 'private, max-age=300',
    });
    res.send(pdf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/contract/verify/:hash
 * Endpoint público de verificação. Retorna metadados (sem HTML completo).
 * Permite que qualquer um confira: "esse hash existe? quem assinou e quando?"
 */
router.get('/api/contract/verify/:hash', async (req, res) => {
  try {
    const hash = String(req.params.hash || '').toLowerCase().replace(/[^a-f0-9]/g, '');
    if (hash.length !== 64) return res.status(400).json({ ok: false, error: 'hash inválido' });

    const sig = await db.get(`
      SELECT id, contract_hash, signer_name, signer_email, signer_ip,
             plan_name, plan_price_brl, signed_at,
             pending_signup_id, workspace_id
      FROM contract_signatures WHERE contract_hash = $1
    `, [hash]);

    if (!sig) {
      return res.json({ ok: false, valid: false, message: 'Hash não encontrado.' });
    }

    // Mascara dados sensíveis na resposta pública
    const maskEmail = e => e ? e.replace(/^(.{2}).+(@.+)$/, '$1***$2') : '';
    const maskIp = ip => ip ? ip.replace(/(\d+\.\d+)\.\d+\.\d+/, '$1.***.***') : '';

    res.json({
      ok: true, valid: true,
      contract: {
        hash: sig.contract_hash,
        signer_name: sig.signer_name,
        signer_email: maskEmail(sig.signer_email),
        signer_ip: maskIp(sig.signer_ip),
        plan: sig.plan_name,
        price_brl: Number(sig.plan_price_brl),
        signed_at: sig.signed_at,
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
