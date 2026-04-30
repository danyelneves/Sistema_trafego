const express = require('express');
const router = express.Router();
const db = require('../db');

// --- KANBAN TASKS ---
router.get('/kanban/:wsId', async (req, res) => {
  try {
    const tasks = await db.all('SELECT * FROM kanban_tasks WHERE workspace_id = $1 ORDER BY created_at ASC', [req.params.wsId]);
    res.json(tasks);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/kanban/:wsId', async (req, res) => {
  try {
    const { title, description } = req.body;
    await db.run('INSERT INTO kanban_tasks (workspace_id, title, description, status) VALUES ($1, $2, $3, $4)', [req.params.wsId, title, description, 'backlog']);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/kanban/task/:id', async (req, res) => {
  try {
    const { status } = req.body;
    await db.run('UPDATE kanban_tasks SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/kanban/task/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM kanban_tasks WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- WHATSAPP SETTINGS ---
router.get('/wa/:wsId', async (req, res) => {
  try {
    let s = await db.get('SELECT * FROM wa_settings WHERE workspace_id = $1', [req.params.wsId]);
    res.json(s || { api_url: '', api_token: '', active: false });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/wa/:wsId', async (req, res) => {
  try {
    const { api_url, api_token, active } = req.body;
    await db.run(`
      INSERT INTO wa_settings (workspace_id, api_url, api_token, active) VALUES ($1, $2, $3, $4)
      ON CONFLICT (workspace_id) DO UPDATE SET api_url = $2, api_token = $3, active = $4
    `, [req.params.wsId, api_url, api_token, active]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- SUBSCRIPTIONS (BILLING MOCK) ---
router.get('/billing/:wsId', async (req, res) => {
  try {
    let s = await db.get('SELECT * FROM subscriptions WHERE workspace_id = $1', [req.params.wsId]);
    if (!s) {
      // Mocked active 'Pro' plan for demo
      s = { plan_name: 'Pro', status: 'active', current_period_end: new Date(new Date().setMonth(new Date().getMonth()+1)).toISOString() };
    }
    res.json(s);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- CHROME EXTENSION SPY (API) ---
router.post('/spy', async (req, res) => {
  try {
    const { workspace_id = 1, ad_url, ad_media_url, ad_copy, competitor_name } = req.body;
    await db.run('INSERT INTO spy_creatives (workspace_id, ad_url, ad_media_url, ad_copy, competitor_name) VALUES ($1, $2, $3, $4, $5)', 
      [workspace_id, ad_url, ad_media_url, ad_copy, competitor_name]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/spy/:wsId', async (req, res) => {
  try {
    const items = await db.all('SELECT * FROM spy_creatives WHERE workspace_id = $1 ORDER BY created_at DESC', [req.params.wsId]);
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
