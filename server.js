/**
 * server.js — ponto de entrada do Maranet · Central de Tráfego
 *
 * Em produção (Vercel): exporta o app Express via module.exports.
 * Em desenvolvimento local: app.listen() quando executado diretamente.
 */
require('dotenv').config();

const express      = require('express');
const cookieParser = require('cookie-parser');
const path         = require('path');

const { verifyToken }        = require('./middleware/auth');
const { requestLogger, log } = require('./middleware/logger');

const app  = express();
const PORT = Number(process.env.PORT) || 3000;

// ------------------------------------------------------------
// Aviso de segurança: JWT_SECRET padrão em produção
// ------------------------------------------------------------
const DEFAULT_SECRET = 'dev-secret-change-me';
if (process.env.JWT_SECRET === DEFAULT_SECRET || !process.env.JWT_SECRET) {
  const isProduction = process.env.NODE_ENV === 'production';
  const msg = isProduction
    ? '⛔  ERRO CRÍTICO: JWT_SECRET está com o valor padrão em produção! Altere nas env vars da Vercel imediatamente.'
    : '⚠   JWT_SECRET não definido — usando valor padrão (apenas dev).';
  console.warn('\x1b[33m' + msg + '\x1b[0m');
  if (isProduction) process.exit(1);
}

app.disable('x-powered-by');
app.use(express.json({ limit: '4mb' }));
app.use(cookieParser());
app.use(requestLogger);

// ------------------------------------------------------------
// API Routes
// ------------------------------------------------------------
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/metrics',   require('./routes/metrics'));
app.use('/api/goals',     require('./routes/goals'));
app.use('/api/notes',     require('./routes/notes'));
app.use('/api/settings',  require('./routes/settings'));
app.use('/api/users',     require('./routes/users'));
app.use('/api/alerts',    require('./routes/alerts'));
app.use('/api/import',    require('./routes/import'));
app.use('/api/drill',     require('./routes/drill'));
app.use('/api/sync',      require('./routes/sync'));
app.use('/api/cron',      require('./routes/cron'));

app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now(), node: process.version }));

// ------------------------------------------------------------
// Frontend estático (protegido)
// ------------------------------------------------------------
const PUBLIC = path.join(__dirname, 'public');

function guardHTML(req, res) {
  const user = req.cookies?.auth && verifyToken(req.cookies.auth);
  if (!user) return res.redirect('/login');
  res.sendFile(path.join(PUBLIC, 'index.html'));
}

app.get('/',           guardHTML);
app.get('/index.html', guardHTML);

app.use(express.static(PUBLIC, { extensions: ['html'] }));

// Fallback 404 para /api
app.use('/api/*', (req, res) => res.status(404).json({ error: 'rota não encontrada' }));

// ------------------------------------------------------------
// Modo local: escuta na porta quando executado via `node server.js`
// Vercel: exporta o app como handler serverless
// ------------------------------------------------------------
if (require.main === module) {
  app.listen(PORT, async () => {
    const db = require('./db');
    let userCount = 0;
    try {
      const row = await db.get('SELECT COUNT(*) AS c FROM users');
      userCount = Number(row?.c || 0);
    } catch (e) {
      console.error('⚠  Erro ao consultar banco:', e.message);
    }

    log('info', `Servidor iniciado na porta ${PORT}`);
    console.log('');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║  Maranet · Central de Tráfego              ║');
    console.log('║  Maranet Telecom                           ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log(`→ servidor: http://localhost:${PORT}`);
    console.log(`→ node:     ${process.version}`);
    console.log(`→ env:      ${process.env.NODE_ENV || 'development'}`);
    console.log(`→ banco:    PostgreSQL (Supabase)`);
    if (!userCount) {
      console.log('→ banco vazio. Rode:   npm run seed');
    } else {
      console.log(`→ ${userCount} usuário(s) cadastrado(s)`);
    }
    console.log('');
  });
}

module.exports = app;
