/**
 * server.js — ponto de entrada do Nexus OS
 *
 * Em produção (Vercel): exporta o app Express via module.exports.
 * Em desenvolvimento local: app.listen() quando executado diretamente.
 */
require('dotenv').config();

const express      = require('express');
const cookieParser = require('cookie-parser');
const path         = require('path');

const { verifyToken }        = require('./middleware/auth');
const logger                 = require('./middleware/logger');
const { requestLogger, log } = logger;
const sentry                 = require('./utils/sentry');

// Inicializa Sentry o mais cedo possível (antes de qualquer require pesado)
sentry.init();

const app  = express();
const PORT = Number(process.env.PORT) || 3000;

// ------------------------------------------------------------
// Aviso de segurança: JWT_SECRET padrão em produção
// Distingue produção REAL (VERCEL_ENV=production) de preview (NODE_ENV=production
// mas VERCEL_ENV=preview). Só dispara em produção real.
// ------------------------------------------------------------
const DEFAULT_SECRET = 'dev-secret-change-me';
const IS_REAL_PROD =
  process.env.VERCEL_ENV === 'production' ||
  (!process.env.VERCEL_ENV && !process.env.AWS_LAMBDA_FUNCTION_NAME && process.env.NODE_ENV === 'production');

if (process.env.JWT_SECRET === DEFAULT_SECRET || !process.env.JWT_SECRET) {
  const msg = IS_REAL_PROD
    ? '⛔  ERRO CRÍTICO: JWT_SECRET está com o valor padrão em produção! Altere nas env vars da Vercel imediatamente.'
    : '⚠   JWT_SECRET não definido — usando valor padrão (preview/dev).';
  console.warn('\x1b[33m' + msg + '\x1b[0m');
  if (IS_REAL_PROD) throw new Error(msg);
}

app.disable('x-powered-by');
app.set('trust proxy', 1); // Garante que req.protocol seja 'https' no Vercel
app.use(cookieParser());
app.use(requestLogger);

// Limit global de 1mb para mitigar DoS
// Captura rawBody nos webhooks da Kiwify para validação HMAC SHA-1
app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => {
    if (req.originalUrl && req.originalUrl.startsWith('/api/webhooks/kiwify')) {
      req.rawBody = buf.toString('utf8');
    }
  },
}));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

// Headers globais de segurança (helmet-like sem dependência externa)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  // HSTS: força HTTPS por 6 meses (só em produção real)
  if (process.env.VERCEL_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  // Isolamento cross-origin (mitiga Spectre + COOP)
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  // X-DNS-Prefetch-Control: economiza, não vaza pra DNS providers
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  next();
});

// Compression: gzip/brotli em respostas grandes (a Vercel já faz, mas reforça)
// (a Vercel auto-comprime na edge, então não precisamos da lib compression)

// Rota de importação com limite maior
app.use('/api/import', express.json({ limit: '50mb' }), express.urlencoded({ limit: '50mb', extended: true }), require('./routes/import'));

// ------------------------------------------------------------
// API Routes
// ------------------------------------------------------------
const { requireFeature } = require('./middleware/feature-gate');
const { requireAuth } = require('./middleware/auth');

// === CORE (sempre ativo, nunca gateted) ============================
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/audit',      require('./routes/audit'));
app.use('/api/workspaces', require('./routes/workspaces'));
app.use('/api/campaigns',  require('./routes/campaigns'));
app.use('/api/metrics',    require('./routes/metrics'));
app.use('/api/goals',      require('./routes/goals'));
app.use('/api/notes',      require('./routes/notes'));
app.use('/api/settings',   require('./routes/settings'));
app.use('/api/users',      require('./routes/users'));
app.use('/api/drill',      require('./routes/drill'));
app.use('/api/sync',       require('./routes/sync').router);
app.use('/api/cron',       require('./routes/cron'));            // protegido por CRON_SECRET
app.use('/api/instagram',  require('./routes/instagram'));
app.use('/api/webhook',    require('./routes/webhook'));         // webhook MP — NUNCA gateted
app.use('/api/webhooks',   require('./routes/webhooks'));        // webhook Kiwify — NUNCA gateted
app.use('/api/pixel',      require('./routes/pixel'));
app.use('/api/automations',require('./routes/automations'));
app.use('/api/reports',    require('./routes/reports'));
app.use('/api/ai',         require('./routes/ai'));
app.use('/api/financial',  require('./routes/financial'));
app.use('/api/billing',    require('./routes/billing'));
app.use('/api/alerts',     require('./routes/alerts'));
app.use('/api/pay',        require('./routes/pay'));
app.use('/api/checkout',   require('./routes/checkout'));        // CORE: cliente sempre paga
app.use('/api/heal',       require('./routes/heal'));            // conceptual (não pluga em UI)
app.use('/api/voice',      require('./routes/voice'));           // call center auxiliar

// === FEATURES gated por workspace_features =========================
// requireFeature já internamente: bypass se Bearer CRON_SECRET, senão
// chama requireAuth e depois valida feature.
app.use('/api/sentinel',     requireFeature('sentinel'),     require('./routes/sentinel'));
app.use('/api/launcher',     requireFeature('launcher'),     require('./routes/launcher'));
app.use('/api/hive',         requireFeature('hive'),         require('./routes/hive'));
app.use('/api/skynet',       requireFeature('skynet'),       require('./routes/skynet'));
app.use('/api/market',       requireFeature('market'),       require('./routes/market'));
app.use('/api/doppelganger', requireFeature('doppelganger'), require('./routes/doppelganger'));
app.use('/api/vending',      requireFeature('vending'),      require('./routes/vending'));
app.use('/api/lazarus',      requireFeature('lazarus'),      require('./routes/lazarus'));
app.use('/api/forge',        requireFeature('forge'),        require('./routes/forge'));
app.use('/api/studio',       requireFeature('studio'),       require('./routes/studio'));
app.use('/api/vision',       requireFeature('vision'),       require('./routes/vision'));
app.use('/api/titan',        requireFeature('titan'),        require('./routes/titan'));
app.use('/api/poltergeist',  requireFeature('poltergeist'),  require('./routes/poltergeist'));
app.use('/api/franchise',    requireFeature('franchise'),    require('./routes/franchise'));
app.use('/api/empire',       requireFeature('empire'),       require('./routes/empire'));

// ------------------------------------------------------------
// HOSPEDAGEM DINÂMICA DE LANDING PAGES (NEXUS FORGE)
// Rota acessível pelo público: dominio.com/f/slug-da-pagina
// ------------------------------------------------------------
const db = require('./db');
app.get('/f/:slug', async (req, res, next) => {
  try {
    const funnel = await db.get('SELECT * FROM funnels WHERE slug = $1', [req.params.slug]);
    if (!funnel) {
      return res.status(404).send(renderHtmlError(404, 'Página não encontrada', 'O link que você acessou não existe ou foi desativado.'));
    }

    // Incrementa visitas (best-effort, não bloqueia a resposta)
    db.run('UPDATE funnels SET visits = visits + 1 WHERE id = $1', [funnel.id]).catch(err =>
      log.error('falha ao incrementar visitas', err, { funnel_id: funnel.id })
    );

    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' data: https:");
    res.send(funnel.html_content);
  } catch (err) {
    next(err);
  }
});

function renderHtmlError(status, title, message) {
  return `<!doctype html>
<html lang="pt-br">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${status} - ${title}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#0a0a0a;color:#e8e8e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
    .box{max-width:520px;text-align:center}
    .code{font-size:96px;font-weight:900;color:#39ff14;line-height:1;margin-bottom:12px;font-family:'JetBrains Mono',monospace}
    h1{font-size:28px;margin-bottom:12px;font-weight:700}
    p{color:#999;line-height:1.6;margin-bottom:32px}
    a{display:inline-block;padding:12px 24px;background:#39ff14;color:#000;text-decoration:none;font-weight:700;border-radius:4px;transition:transform .15s}
    a:hover{transform:translateY(-2px)}
    .footer{margin-top:48px;font-size:12px;color:#555}
  </style>
</head>
<body>
  <div class="box">
    <div class="code">${status}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="https://nexusagencia.app">← Voltar ao início</a>
    <div class="footer">NEXUS · Engenharia Operacional</div>
  </div>
</body>
</html>`;
}

// Health checks granulares (liveness, readiness, db, redis, mp)
app.use('/api/health', require('./routes/health'));

// Dashboard de serviços externos agregado (Vercel, Sentry, UR, MP, etc)
app.use('/api/services', require('./routes/services'));

// Command Center: agregadores que alimentam o painel inicial /
app.use('/api/dashboard', require('./routes/dashboard'));

// ------------------------------------------------------------
// Frontend estático (protegido)
// ------------------------------------------------------------
const PUBLIC = path.join(__dirname, 'public');

function guardHTML(req, res) {
  const user = req.cookies?.auth && verifyToken(req.cookies.auth);
  if (!user) return res.redirect('/login');
  res.sendFile(path.join(PUBLIC, 'index.html'));
}

// Landing pública (Nexus Agência)
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC, 'landing.html')));

// Command Center (sistema interno, exige auth)
app.get('/app', guardHTML);
app.get('/app/index.html', guardHTML);
// Bloqueia acesso direto ao index.html (Command Center) — força passar pelo /app
app.get('/index.html', (req, res) => res.redirect('/app'));

// Painel de tráfego pago (módulo dedicado, antigo painel principal)
app.get('/traffic', (req, res) => {
  const user = req.cookies?.auth && verifyToken(req.cookies.auth);
  if (!user) return res.redirect('/login');
  res.sendFile(path.join(PUBLIC, 'traffic.html'));
});

// Painel de serviços externos: requer auth (igual painel principal)
app.get('/services', (req, res) => {
  const user = req.cookies?.auth && verifyToken(req.cookies.auth);
  if (!user) return res.redirect('/login');
  res.sendFile(path.join(PUBLIC, 'services.html'));
});

// Páginas de cada módulo (todas exigem auth)
const MODULE_PAGES = [
  'sentinel', 'launcher', 'lazarus', 'skynet', 'doppelganger',
  'forge', 'studio', 'vending', 'market', 'franchise',
  'empire', 'poltergeist', 'titan', 'hive', 'billing',
  'audit',
];
MODULE_PAGES.forEach(page => {
  app.get(`/${page}`, (req, res) => {
    const user = req.cookies?.auth && verifyToken(req.cookies.auth);
    if (!user) return res.redirect('/login');
    res.sendFile(path.join(PUBLIC, `${page}.html`));
  });
});

// /billing/master continua funcionando como atalho pra /billing
app.get('/billing/master', (req, res) => res.redirect('/billing'));

app.use(express.static(PUBLIC, { extensions: ['html'] }));

app.get('/report/:uuid', (req, res) => {
  res.sendFile(path.join(PUBLIC, 'report.html'));
});

// Fallback 404 para /api
app.use('/api/*', (req, res) => res.status(404).json({ error: 'rota não encontrada', path: req.path }));

// Error handler global (captura no Sentry e formata resposta amigável)
app.use(sentry.errorHandler);

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
    console.log('║  Nexus OS                                  ║');
    console.log('║  Sistema operacional de IA para vendas     ║');
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
