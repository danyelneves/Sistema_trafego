const express = require('express');
const app = express();
const auth = require('./middleware/auth');
auth.requireAuth = (req, res, next) => { req.user = { workspace_id: 1 }; next(); };
app.use('/api/goals', require('./routes/goals'));
app.use('/api/notes', require('./routes/notes'));

const server = app.listen(0, async () => {
  const port = server.address().port;
  for (let u of ['/api/goals', '/api/notes']) {
    try {
      const res = await fetch('http://localhost:' + port + u);
      if (!res.ok) console.log('FAIL:', u, res.status, await res.text());
      else console.log('OK:', u);
    } catch(e) {}
  }
  server.close();
  process.exit(0);
});
