/**
 * routes/settings.js — configurações chave/valor (branding, tema).
 */
const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const rows = await db.all('SELECT key, value FROM workspace_settings WHERE workspace_id = $1', req.user.workspace_id);
    const obj = {};
    rows.forEach(r => { obj[r.key] = r.value; });

    if (!obj['webhook.secret']) {
      const token = require('crypto').randomBytes(16).toString('hex');
      await db.run("INSERT INTO workspace_settings(workspace_id, key, value) VALUES ($1, 'webhook.secret', $2)", req.user.workspace_id, token);
      obj['webhook.secret'] = token;
    }

    res.json(obj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/', requireAdmin, async (req, res) => {
  const body = req.body || {};
  try {
    const tx = db.transaction(async (client) => {
      for (const [k, v] of Object.entries(body)) {
        await client.run(
          `INSERT INTO workspace_settings(workspace_id, key, value) VALUES ($1, $2, $3)
           ON CONFLICT(workspace_id, key) DO UPDATE SET value = EXCLUDED.value`,
          req.user.workspace_id, k, String(v)
        );
      }
    });
    await tx();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
