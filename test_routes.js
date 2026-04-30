const express = require('express');
const app = express();
require('dotenv').config();

// Mock requireAuth
const auth = require('./middleware/auth');
auth.requireAuth = (req, res, next) => { req.user = { workspace_id: 1 }; next(); };

app.use('/api/metrics', require('./routes/metrics'));
app.use('/api/ai', require('./routes/ai'));

const server = app.listen(0, async () => {
  const port = server.address().port;
  const urls = [
    '/api/metrics/kpis',
    '/api/metrics/monthly',
    '/api/metrics/by-campaign',
    '/api/metrics/demographics',
    '/api/metrics/placements',
    '/api/metrics/ads',
    '/api/ai/insights'
  ];
  for (let u of urls) {
    try {
      const res = await fetch('http://localhost:' + port + u);
      if (!res.ok) {
        console.log('FAIL:', u, res.status, await res.text());
      } else {
        console.log('OK:', u, (await res.text()).slice(0, 100));
      }
    } catch(e) {
      console.log('FAIL EXCEPTION:', u, e.message);
    }
  }
  server.close();
  process.exit(0);
});
