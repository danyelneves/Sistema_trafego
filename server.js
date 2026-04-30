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
app.set('trust proxy', 1); // Garante que req.protocol seja 'https' no Vercel
app.set('trust proxy', 1); // Garante que req.protocol seja 'https' no Vercel
app.use(cookieParser());
app.use(requestLogger);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ------------------------------------------------------------
// API Routes
// ------------------------------------------------------------
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/workspaces', require('./routes/workspaces'));
app.use('/api/campaigns',  require('./routes/campaigns'));
app.use('/api/metrics',    require('./routes/metrics'));
app.use('/api/goals',      require('./routes/goals'));
app.use('/api/notes',      require('./routes/notes'));
app.use('/api/settings',   require('./routes/settings'));
app.use('/api/users',      require('./routes/users'));
app.use('/api/import',     require('./routes/import'));
app.use('/api/drill',      require('./routes/drill'));
app.use('/api/sync',       require('./routes/sync').router);
app.use('/api/cron',       require('./routes/cron'));
app.use('/api/instagram',  require('./routes/instagram'));

app.use('/api/webhook',    require('./routes/webhook'));
app.use('/api/pixel',      require('./routes/pixel'));
app.use('/api/automations',require('./routes/automations'));
app.use('/api/reports',    require('./routes/reports'));
app.use('/api/ai',         require('./routes/ai'));
app.use('/api/financial',  require('./routes/financial'));
app.use('/api/webhooks',   require('./routes/webhooks'));
app.use('/api/empire',     require('./routes/empire'));
app.use('/api/launcher',   require('./routes/launcher'));
app.use('/api/vending',    require('./routes/vending')); // Vending Machine
app.use('/api/market',     require('./routes/market')); // Bolsa de Valores de Leads
app.use('/api/lazarus',    require('./routes/lazarus')); // Protocolo Lázaro
app.use('/api/pay',        require('./routes/pay')); // Fintech Gateway
app.use('/api/checkout',   require('./routes/checkout')); // Kiwify Killer
app.use('/api/hive',       require('./routes/hive')); // Mente de Colmeia
app.use('/api/vision',     require('./routes/vision')); // Engenharia Reversa Visual
app.use('/api/sentinel',   require('./routes/sentinel')); // Trader de Tráfego 24/7
app.use('/api/forge',      require('./routes/forge')); // O Forjador de Landing Pages Mutantes
app.use('/api/voice',      require('./routes/voice')); // Robô de Call Center AI
app.use('/api/franchise',  require('./routes/franchise')); // Motor White-Label
app.use('/api/skynet',     require('./routes/skynet')); // Operação Skynet (Auto-Aquisição)
app.use('/api/studio',     require('./routes/studio')); // NEXUS Studio (Clonagem de Voz/Vídeo)
app.use('/api/heal',       require('./routes/heal')); // Agentic DevOps (Auto-Cura)
app.use('/api/titan',      require('./routes/titan')); // CEO Autônomo e Serial
app.use('/api/doppelganger', require('./routes/doppelganger')); // Clone Digital Neural
app.use('/api/poltergeist', require('./routes/poltergeist')); // IoT e Logística Física

// ------------------------------------------------------------
// HOSPEDAGEM DINÂMICA DE LANDING PAGES (NEXUS FORGE)
// Rota acessível pelo público: dominio.com/f/slug-da-pagina
// ------------------------------------------------------------
const db = require('./db');
app.get('/f/:slug', async (req, res) => {
  try {
    const funnel = await db.get('SELECT * FROM funnels WHERE slug = $1', [req.params.slug]);
    if (!funnel) return res.status(404).send('<h1>Página não encontrada ou desativada.</h1>');
    
    // Incrementa visitas
    await db.run('UPDATE funnels SET visits = visits + 1 WHERE id = $1', [funnel.id]);
    
    res.send(funnel.html_content);
  } catch (err) {
    res.status(500).send('Erro interno do servidor.');
  }
});

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

app.get('/report/:uuid', (req, res) => {
  res.sendFile(path.join(PUBLIC, 'report.html'));
});

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
