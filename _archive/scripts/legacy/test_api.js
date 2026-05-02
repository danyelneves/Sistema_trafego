const express = require('express');
const app = express();

// Mock requireAuth
jest = { mock: () => {} }; // fake jest if any
const auth = require('./middleware/auth');
auth.requireAuth = (req, res, next) => { req.user = { workspace_id: 1 }; next(); };

const metrics = require('./routes/metrics');
const notes = require('./routes/notes');
const goals = require('./routes/goals');

app.use('/api/metrics', metrics);
app.use('/api/notes', notes);
app.use('/api/goals', goals);

const server = app.listen(0, async () => {
  const port = server.address().port;
  const urls = [
    '/api/metrics/kpis',
    '/api/metrics/daily',
    '/api/metrics/by-campaign',
    '/api/metrics/demographics',
    '/api/metrics/placements',
    '/api/metrics/ads',
    '/api/metrics/ai-insights',
    '/api/notes',
    '/api/goals'
  ];
  for (let u of urls) {
    try {
      const res = await fetch('http://localhost:' + port + u);
      if (!res.ok) {
        console.log('FAIL:', u, res.status, await res.text());
      } else {
        console.log('OK:', u, await res.text());
      }
    } catch(e) {
      console.log('FAIL EXCEPTION:', u, e.message);
    }
  }
  server.close();
  process.exit(0);
});
