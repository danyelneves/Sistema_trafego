const express = require('express');
const db = require('../db');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { workspace_id, event_type, url, utms, data } = req.body;
    
    if (!workspace_id || !event_type) {
      return res.status(400).json({ error: 'workspace_id e event_type são obrigatórios' });
    }

    const source = utms?.utm_source || null;
    const medium = utms?.utm_medium || null;
    const campaign = utms?.utm_campaign || null;
    const term = utms?.utm_term || null;
    const content = utms?.utm_content || null;
    const click_id = utms?.gclid || utms?.fbclid || null;
    const revenue = data?.value || data?.revenue || 0;
    
    // Fallback if express proxy trust isn't set, get real IP
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const ua = req.headers['user-agent'] || null;

    const sql = `
      INSERT INTO pixel_events (
        workspace_id, event_type, url, 
        utm_source, utm_medium, utm_campaign, utm_term, utm_content, 
        click_id, revenue, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `;

    await db.run(sql, 
      workspace_id, event_type, url, 
      source, medium, campaign, term, content, 
      click_id, revenue, ip, ua
    );

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Pixel API Error:', e.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// NEXUS: Multi-Touch Attribution Endpoint
router.post('/track', async (req, res) => {
  try {
    const { workspace_id, visitor_id, event_type, url, referrer, utms } = req.body;
    
    if (!workspace_id || !visitor_id) {
      return res.status(400).json({ error: 'workspace_id and visitor_id required' });
    }

    const source = utms?.source || null;
    const medium = utms?.medium || null;
    const campaign = utms?.campaign || null;
    const term = utms?.term || null;
    const content = utms?.content || null;
    
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const ua = req.headers['user-agent'] || null;

    const sql = `
      INSERT INTO pixel_journeys (
        workspace_id, visitor_id, event_type, landing_page, referrer,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content, 
        ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `;

    await db.run(sql, 
      workspace_id, visitor_id, event_type, url, referrer,
      source, medium, campaign, term, content, ip, ua
    );

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Nexus Pixel Track Error:', e.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/pixel/leads (Requires Auth - returns leads for the CRM)
const { requireAuth } = require('../middleware/auth');
router.get('/leads', requireAuth, async (req, res) => {
  try {
    const sql = `
      SELECT id, event_type, url, utm_source, utm_medium, utm_campaign, utm_term, utm_content, created_at
      FROM pixel_events
      WHERE workspace_id = $1 AND event_type IN ('lead', 'purchase', 'pageview')
      ORDER BY created_at DESC
      LIMIT 100
    `;
    const rows = await db.all(sql, req.user.workspace_id);
    res.json(rows || []);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
