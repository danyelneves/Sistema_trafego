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
    const rows = await db.all('SELECT key, value FROM settings');
    const obj = {};
    rows.forEach(r => { obj[r.key] = r.value; });

    if (!obj['webhook.secret']) {
      const token = require('crypto').randomBytes(16).toString('hex');
      await db.run("INSERT INTO settings(key, value) VALUES ('webhook.secret', $1)", token);
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
          `INSERT INTO settings(key, value) VALUES ($1, $2)
           ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value`,
          k, String(v)
        );
      }
    });
    await tx();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
