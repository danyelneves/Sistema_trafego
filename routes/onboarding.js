/**
 * routes/onboarding.js — fluxo público de auto-cadastro.
 *
 * Modo controlado por settings.onboarding.mode:
 *   - 'manual' (default) → /api/onboarding/start retorna 503, /comprar
 *     redireciona pra WhatsApp
 *   - 'auto'             → cria pending_signup, gera preferência MP,
 *                          retorna init_point pra cliente pagar
 *
 * Webhook MP (routes/webhook.js) consome o payment_id e dispara
 * convertSignup() que cria workspace+user+atribui plano+envia email.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const audit = require('../utils/audit');

// ============================================================
// GET /api/onboarding/config
// Público — landing chama pra saber se auto-signup tá ligado.
// ============================================================
router.get('/config', async (req, res) => {
  try {
    const mode = await db.get(`SELECT value FROM settings WHERE key = 'onboarding.mode'`);
    const plans = await db.all(`
      SELECT id, key, name, description, price_brl,
             (SELECT json_agg(f.name ORDER BY f.display_order)
              FROM plan_features pf JOIN features f ON f.key = pf.feature_key
              WHERE pf.plan_id = p.id AND f.is_core = false) AS features
      FROM plans p
      WHERE p.active = true AND p.key != 'owner'
      ORDER BY p.price_brl ASC
    `);
    res.json({
      ok: true,
      mode: mode?.value || 'manual',
      plans,
      whatsapp: process.env.SUPPORT_WHATSAPP || '5511999990000',
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// POST /api/onboarding/start
// Cria pending_signup + preferência MP. Retorna URL de checkout.
// Bloqueia se modo = manual.
// ============================================================
router.post('/start', async (req, res) => {
  try {
    const mode = await db.get(`SELECT value FROM settings WHERE key = 'onboarding.mode'`);
    if ((mode?.value || 'manual') !== 'auto') {
      return res.status(503).json({
        error: 'auto_onboarding_disabled',
        message: 'Auto-onboarding desativado. Solicite via WhatsApp.',
      });
    }

    const { email, name, phone, plan_key, workspace_name } = req.body || {};
    if (!email || !name || !plan_key) {
      return res.status(400).json({ error: 'email, name e plan_key obrigatórios' });
    }

    // Verifica plano existe e tá ativo
    const plan = await db.get(
      `SELECT id, name, price_brl FROM plans WHERE key = $1 AND active = true`, [plan_key]
    );
    if (!plan) return res.status(404).json({ error: 'plan_not_found_or_inactive' });

    // Bloqueia signup com email duplicado já convertido
    const existing = await db.get('SELECT id FROM users WHERE username = $1', email);
    if (existing) {
      return res.status(409).json({
        error: 'email_already_registered',
        message: 'Esse e-mail já tem conta. Faça login ou recupere a senha.',
      });
    }

    // Cria pending_signup
    const wsName = (workspace_name || name).trim().slice(0, 80);
    const pending = await db.get(
      `INSERT INTO pending_signups (email, name, phone, workspace_name, plan_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [email.toLowerCase().trim(), name.trim(), phone || null, wsName, plan.id]
    );

    // Cria preferência MP
    const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN
      || (await db.get(`SELECT value FROM workspace_settings WHERE workspace_id = 1 AND key = 'mercadopago.accessToken'`))?.value;
    if (!mpToken) {
      return res.status(503).json({ error: 'mercadopago_not_configured' });
    }

    const mp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${mpToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{
          title: `Nexus OS — ${plan.name}`,
          quantity: 1,
          unit_price: Number(plan.price_brl),
          currency_id: 'BRL',
        }],
        payer: { email: email.toLowerCase().trim(), name: name.trim() },
        external_reference: `signup:${pending.id}`,
        metadata: { signup_id: pending.id, plan_id: plan.id, type: 'plan_signup' },
        notification_url: `${process.env.PUBLIC_BASE_URL || 'https://nexusagencia.app'}/api/webhook/mercadopago/1`,
        back_urls: {
          success: `${process.env.PUBLIC_BASE_URL || 'https://nexusagencia.app'}/onboarding/sucesso?signup=${pending.id}`,
          failure: `${process.env.PUBLIC_BASE_URL || 'https://nexusagencia.app'}/comprar?erro=1`,
          pending: `${process.env.PUBLIC_BASE_URL || 'https://nexusagencia.app'}/onboarding/aguardando?signup=${pending.id}`,
        },
        auto_return: 'approved',
      }),
    });
    const mpData = await mp.json();
    if (!mp.ok) {
      audit.log('onboarding.mp_pref_failed', { signup_id: pending.id, error: mpData });
      return res.status(502).json({ error: 'payment_provider_error', detail: mpData?.message });
    }

    await db.run(
      `UPDATE pending_signups SET mp_preference_id = $1, metadata = jsonb_set(metadata, '{init_point}', to_jsonb($2::text)) WHERE id = $3`,
      [mpData.id, mpData.init_point, pending.id]
    );

    audit.log('onboarding.started', { signup_id: pending.id, email, plan_key });
    res.json({
      ok: true,
      signup_id: pending.id,
      init_point: mpData.init_point,
      plan: { name: plan.name, price_brl: plan.price_brl },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// GET /api/onboarding/status/:signup_id
// Polling pra UI saber se pagamento já confirmou.
// ============================================================
router.get('/status/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = await db.get(
      `SELECT id, email, status, workspace_id, paid_at, converted_at
       FROM pending_signups WHERE id = $1`, [id]
    );
    if (!row) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true, ...row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// convertSignup(signup_id, payment_id) — chamado pelo webhook MP
// Cria workspace + user + atribui plano + envia email.
// Idempotente: se já convertido, não reexecuta.
// ============================================================
async function convertSignup(signup_id, payment_id) {
  const log = require('../middleware/logger');
  const bcrypt = require('bcryptjs');
  const { invalidate } = require('../utils/features');
  const mailer = require('../services/mailer');

  const signup = await db.get('SELECT * FROM pending_signups WHERE id = $1', [signup_id]);
  if (!signup) throw new Error('signup_not_found');
  if (signup.status === 'converted') return { ok: true, already: true, signup };

  // Marca paid se ainda não tava
  await db.run(`UPDATE pending_signups SET status='paid', paid_at = COALESCE(paid_at, now()), payment_id = $1 WHERE id = $2`,
    [payment_id, signup_id]);

  // Senha temporária random
  const tempPwd = require('crypto').randomBytes(6).toString('base64').replace(/[+/=]/g, '').slice(0, 8);
  const hash = await bcrypt.hash(tempPwd, 10);

  let workspace_id, user_id;
  try {
    // Cria workspace
    const ws = await db.get(`INSERT INTO workspaces (name) VALUES ($1) RETURNING id`, [signup.workspace_name]);
    workspace_id = ws.id;

    // Cria user (admin do próprio workspace)
    const u = await db.get(
      `INSERT INTO users (username, password_hash, display_name, role, workspace_id)
       VALUES ($1, $2, $3, 'admin', $4) RETURNING id`,
      [signup.email, hash, signup.name, workspace_id]
    );
    user_id = u.id;

    // Atribui plano
    await db.run(
      `INSERT INTO workspace_plan (workspace_id, plan_id, assigned_at)
       VALUES ($1, $2, now())
       ON CONFLICT (workspace_id) DO UPDATE SET plan_id = EXCLUDED.plan_id, assigned_at = now()`,
      [workspace_id, signup.plan_id]
    );
    invalidate(workspace_id);

    // Marca convertido
    await db.run(`
      UPDATE pending_signups SET
        status = 'converted', converted_at = now(),
        workspace_id = $1, user_id = $2
      WHERE id = $3
    `, [workspace_id, user_id, signup_id]);

    audit.log('onboarding.converted', {
      signup_id, workspace_id, user_id,
      email: signup.email, payment_id,
    });

    // Manda credenciais por email (best effort)
    try {
      await mailer.sendOnboardingCredentials({
        to: signup.email,
        name: signup.name,
        username: signup.email,
        password: tempPwd,
        workspace_name: signup.workspace_name,
      });
    } catch (mailErr) {
      log.error('onboarding: email falhou', mailErr, { signup_id });
      audit.log('onboarding.email_failed', { signup_id, error: mailErr.message });
    }

    return { ok: true, workspace_id, user_id, signup };
  } catch (err) {
    log.error('onboarding.convert: erro', err, { signup_id });
    await db.run(`UPDATE pending_signups SET status='failed', metadata = jsonb_set(metadata, '{error}', to_jsonb($1::text)) WHERE id = $2`,
      [err.message.slice(0, 200), signup_id]);
    throw err;
  }
}

router.convertSignup = convertSignup;
module.exports = router;
