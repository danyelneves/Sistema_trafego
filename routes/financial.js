const express = require('express');
const router = express.Router();
const db = require('../db');

// Get financial settings for workspace
router.get('/:wsId', async (req, res) => {
  try {
    const { wsId } = req.params;
    let settings = await db.get('SELECT * FROM financial_settings WHERE workspace_id = $1', [wsId]);
    if (!settings) {
      settings = { product_cost: 0, tax_rate: 0, gateway_rate: 0, agency_fee: 0 };
    }
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update financial settings
router.post('/:wsId', async (req, res) => {
  try {
    const { wsId } = req.params;
    const { product_cost = 0, tax_rate = 0, gateway_rate = 0, agency_fee = 0 } = req.body;
    
    await db.run(`
      INSERT INTO financial_settings (workspace_id, product_cost, tax_rate, gateway_rate, agency_fee, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (workspace_id) 
      DO UPDATE SET 
        product_cost = EXCLUDED.product_cost,
        tax_rate = EXCLUDED.tax_rate,
        gateway_rate = EXCLUDED.gateway_rate,
        agency_fee = EXCLUDED.agency_fee,
        updated_at = NOW()
    `, [wsId, product_cost, tax_rate, gateway_rate, agency_fee]);
    
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
