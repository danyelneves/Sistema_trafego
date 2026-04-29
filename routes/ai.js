const express = require('express');
const router = express.Router();
const { analyzeMetrics } = require('../services/aiConsultant.js');

// ----------------------------------------------------------------
// GET /api/ai/insights
// ----------------------------------------------------------------
router.get('/insights', async (req, res) => {
  const { channel } = req.query;
  
  try {
    const data = await analyzeMetrics(req.user.workspace_id, channel || 'all');
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
