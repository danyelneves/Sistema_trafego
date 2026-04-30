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

module.exports = router;
