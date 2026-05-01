const express = require('express');
const router = express.Router();
const { dispatchOrder } = require('../services/poltergeist');

// ----------------------------------------------------------------
// POST /api/poltergeist/dispatch
// Protocolo Poltergeist: Controle de Hardware (Impressora) e Logística (Uber)
// ----------------------------------------------------------------
router.post('/dispatch', async (req, res) => {
    try {
        const { order_id, total_amount, address, items } = req.body;
        const result = await dispatchOrder({ order_id, total_amount, address, items });
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
