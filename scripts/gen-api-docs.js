#!/usr/bin/env node
/**
 * scripts/gen-api-docs.js
 *
 * Lê todos os routes/*.js, extrai endpoints (método + path + comentário JSDoc
 * imediatamente acima) e gera docs/auto/API.md.
 *
 * Roda via: npm run docs:api
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ROUTES_DIR = path.join(ROOT, 'routes');
const SERVER_FILE = path.join(ROOT, 'server.js');
const OUT_FILE = path.join(ROOT, 'docs', 'auto', 'API.md');

// 1) Mapa de mounts: arquivo → prefixo URL (ex: routes/auth.js → /api/auth)
function loadMounts() {
  const src = fs.readFileSync(SERVER_FILE, 'utf8');
  const mounts = {};
  // Casa: app.use('/api/foo', require('./routes/foo'));
  const re = /app\.use\(\s*['"]([^'"]+)['"]\s*,[^)]*require\(\s*['"]\.\/routes\/([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(src))) {
    const [, prefix, file] = m;
    const fileName = file.replace(/\.js$/, '') + '.js';
    mounts[fileName] = prefix;
  }
  return mounts;
}

// 2) Extrai endpoints de 1 arquivo: retorna [{method, path, doc}]
function parseRoute(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const lines = src.split('\n');
  const out = [];

  // Detecta middlewares globais aplicados via router.use(...)
  const globalMws = [];
  const useRe = /router\.use\(\s*([^)]+)\)/g;
  let um;
  while ((um = useRe.exec(src))) {
    const args = um[1];
    if (/requireAuth/.test(args)) globalMws.push('auth');
    if (/requireAdmin/.test(args)) globalMws.push('admin');
  }

  const handlerRe = /router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]\s*,([\s\S]*?)\)\s*;?$/gm;
  // Mais tolerante: pega só o início, vê o que tem antes do callback
  const re = /router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
  let mm;
  while ((mm = re.exec(src))) {
    const [, method, routePath] = mm;
    // Captura o trecho até o primeiro `,` que abre a função handler
    const startIdx = mm.index;
    // Procurar o snippet de middlewares entre o path e o "async (req," ou "(req,"
    const restAfter = src.slice(mm.index, mm.index + 600);
    const middlewares = [];
    if (/requireAuth/.test(restAfter)) middlewares.push('auth');
    if (/requireAdmin/.test(restAfter)) middlewares.push('admin');
    if (/checkAuthRateLimit|checkKiwifyRateLimit|checkRateLimit/.test(restAfter)) middlewares.push('rateLimit');

    // Linha onde o match começou
    const lineNum = src.slice(0, startIdx).split('\n').length;

    // Comentário/JSDoc imediatamente acima
    let doc = '';
    let i = lineNum - 2; // 0-indexed, uma linha antes
    const block = [];
    // recolhe linhas comentadas consecutivas voltando pra cima
    while (i >= 0) {
      const ln = lines[i].trim();
      if (ln.startsWith('//') || ln.startsWith('*') || ln.startsWith('/*') || ln === '*/' || ln === '/**') {
        block.unshift(ln.replace(/^\/\/\s?|^\*\/?\s?|^\/\*+\s?/g, '').trim());
        i--;
      } else if (ln === '') {
        i--; // permite linha em branco entre handler e doc
        if (block.length > 0) break;
      } else break;
    }
    doc = block.filter(s => s && !s.startsWith('-----')).join(' ').trim();
    // Filtra docs que são só "<METHOD> /path" (redundantes com a tabela)
    const redundantRe = new RegExp(`^${method.toUpperCase()}\\s+/[\\w/:-]*\\s*$`, 'i');
    if (redundantRe.test(doc)) doc = '';
    // Pega só primeira frase se for muito longa
    if (doc.length > 220) {
      const dot = doc.indexOf('. ');
      if (dot > 30 && dot < 220) doc = doc.slice(0, dot + 1);
      else doc = doc.slice(0, 217) + '...';
    }

    // Combina globalMws (do router.use) com middlewares específicos
    const allMws = Array.from(new Set([...globalMws, ...middlewares]));

    out.push({ method: method.toUpperCase(), path: routePath, doc, middlewares: allMws, lineNum });
  }
  return out;
}

function relPath(p) {
  return path.relative(ROOT, p).replace(/\\/g, '/');
}

function escMd(s) {
  return s.replace(/\|/g, '\\|');
}

function main() {
  const mounts = loadMounts();
  const files = fs.readdirSync(ROUTES_DIR).filter(f => f.endsWith('.js')).sort();

  const sections = [];
  let totalEndpoints = 0;
  const orphanFiles = [];

  for (const file of files) {
    const fp = path.join(ROUTES_DIR, file);
    const prefix = mounts[file];
    if (!prefix) {
      orphanFiles.push(file);
      continue;
    }
    const endpoints = parseRoute(fp);
    if (!endpoints.length) continue;

    totalEndpoints += endpoints.length;

    const rows = endpoints.map(e => {
      const fullPath = (prefix + e.path).replace(/\/$/, '') || prefix;
      const mws = e.middlewares.length ? `\`${e.middlewares.join(',')}\`` : '—';
      const doc = e.doc ? escMd(e.doc.slice(0, 220)) : '';
      const link = `[${file}:${e.lineNum}](../../${relPath(fp)}#L${e.lineNum})`;
      return `| \`${e.method}\` | \`${fullPath}\` | ${mws} | ${doc} | ${link} |`;
    });

    const moduleName = file.replace(/\.js$/, '');
    sections.push(
      `## \`${prefix}\` — ${moduleName}\n\n` +
      `Source: \`${relPath(fp)}\` · ${endpoints.length} endpoint(s)\n\n` +
      `| Method | Path | Middlewares | Descrição | Source |\n` +
      `|---|---|---|---|---|\n` +
      rows.join('\n') + '\n'
    );
  }

  const header = `# API Reference — Nexus OS

> **Gerado automaticamente** por \`scripts/gen-api-docs.js\` em ${new Date().toISOString().slice(0,16).replace('T',' ')}.
> Não edite à mão. Pra atualizar: \`npm run docs:api\`.

**Total:** ${totalEndpoints} endpoints em ${sections.length} módulos.

**Convenções de middleware:**
- \`auth\` — exige cookie JWT \`auth\` válido (\`requireAuth\`)
- \`admin\` — exige \`req.user.role === 'admin'\` (\`requireAdmin\`)
- \`rateLimit\` — passa por rate limiter Upstash

`;

  const orphanNote = orphanFiles.length
    ? `\n## ⚠️ Routers não montados\n\nArquivos em \`routes/\` sem \`app.use(...)\` correspondente em \`server.js\`:\n${orphanFiles.map(f => `- \`routes/${f}\``).join('\n')}\n`
    : '';

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, header + sections.join('\n') + orphanNote);
  console.log(`✓ ${OUT_FILE}`);
  console.log(`  ${totalEndpoints} endpoints, ${sections.length} módulos${orphanFiles.length ? `, ${orphanFiles.length} orfãos` : ''}`);
}

main();
