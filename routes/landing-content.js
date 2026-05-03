/**
 * routes/landing-content.js — admin de conteúdo da landing.
 *
 * Permissões:
 *   - super admin (admin no workspace 1): edita system_default + qualquer tenant
 *   - admin de tenant: só edita o próprio tenant
 *   - usuário comum: bloqueado
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const audit = require('../utils/audit');
const { DEFAULT_CONTENT, resolveDraft } = require('../utils/landing-content');

const OWNER_WORKSPACE_ID = 1;

router.use(requireAuth, requireAdmin);

function isSuperAdmin(req) {
  return req.user?.role === 'admin' && req.user?.workspace_id === OWNER_WORKSPACE_ID;
}

function canAccess(req, scope, workspaceId) {
  if (isSuperAdmin(req)) return true;
  if (scope === 'system_default') return false; // só super admin
  return Number(workspaceId) === Number(req.user.workspace_id);
}

/** GET /api/admin/landing/schema — schema padrão (referência pra UI) */
router.get('/schema', (req, res) => {
  res.json({ ok: true, schema: DEFAULT_CONTENT });
});

/** GET /api/admin/landing — lista escopos disponíveis pro user */
router.get('/', async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT lpc.id, lpc.scope, lpc.workspace_id, lpc.is_published,
             lpc.status, lpc.updated_at, lpc.published_at,
             w.name AS workspace_name
      FROM landing_page_content lpc
      LEFT JOIN workspaces w ON w.id = lpc.workspace_id
      ORDER BY lpc.scope DESC, lpc.workspace_id NULLS FIRST
    `);
    const filtered = isSuperAdmin(req) ? rows : rows.filter(r => r.workspace_id === req.user.workspace_id);
    res.json({ ok: true, items: filtered, super_admin: isSuperAdmin(req) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** GET /api/admin/landing/:scope/:workspace_id? — pega rascunho atual */
router.get('/:scope/:workspace_id?', async (req, res) => {
  try {
    const { scope } = req.params;
    const workspaceId = req.params.workspace_id ? parseInt(req.params.workspace_id, 10) : null;
    if (!canAccess(req, scope, workspaceId)) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const where = scope === 'system_default'
      ? `scope = 'system_default'`
      : `scope = 'tenant' AND workspace_id = $1`;
    const params = scope === 'system_default' ? [] : [workspaceId];

    const row = await db.get(
      `SELECT id, scope, workspace_id, content_json, published_json, seo_json,
              is_published, status, updated_at, published_at, updated_by
       FROM landing_page_content WHERE ${where}`,
      params
    );

    if (!row) {
      // Retorna estrutura vazia + DEFAULT_CONTENT pra UI mostrar como placeholder
      return res.json({
        ok: true, exists: false,
        scope, workspace_id: workspaceId,
        content: DEFAULT_CONTENT,
        defaults: DEFAULT_CONTENT,
      });
    }
    res.json({ ok: true, exists: true, defaults: DEFAULT_CONTENT, ...row });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** PUT /api/admin/landing/:scope/:workspace_id? — salva rascunho */
router.put('/:scope/:workspace_id?', async (req, res) => {
  try {
    const { scope } = req.params;
    const workspaceId = req.params.workspace_id ? parseInt(req.params.workspace_id, 10) : null;
    if (!canAccess(req, scope, workspaceId)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    const { content, seo } = req.body || {};
    if (!content || typeof content !== 'object') {
      return res.status(400).json({ error: 'content é obrigatório (objeto JSON)' });
    }

    const targetWsId = scope === 'system_default' ? null : workspaceId;
    if (scope === 'tenant' && !targetWsId) {
      return res.status(400).json({ error: 'workspace_id obrigatório pra scope tenant' });
    }

    // Check if exists, then insert or update (mais simples que ON CONFLICT em partial unique)
    const existing = scope === 'system_default'
      ? await db.get(`SELECT id FROM landing_page_content WHERE scope='system_default'`)
      : await db.get(`SELECT id FROM landing_page_content WHERE scope='tenant' AND workspace_id=$1`, [targetWsId]);

    let row;
    if (existing) {
      row = await db.get(`
        UPDATE landing_page_content SET
          content_json = $1, seo_json = $2, status='draft',
          updated_by = $3, updated_at = now()
        WHERE id = $4
        RETURNING id, status, updated_at
      `, [JSON.stringify(content), JSON.stringify(seo || {}), req.user.id, existing.id]);
    } else {
      row = await db.get(`
        INSERT INTO landing_page_content (scope, workspace_id, content_json, seo_json, status, updated_by)
        VALUES ($1, $2, $3, $4, 'draft', $5)
        RETURNING id, status, updated_at
      `, [scope, targetWsId, JSON.stringify(content), JSON.stringify(seo || {}), req.user.id]);
    }

    audit.log('landing.draft_saved', {
      ...audit.fromReq(req),
      scope, target_workspace_id: targetWsId, landing_id: row.id,
    });
    res.json({ ok: true, ...row });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** POST /api/admin/landing/:scope/:workspace_id?/publish — publica rascunho */
router.post('/:scope/:workspace_id?/publish', async (req, res) => {
  try {
    const { scope } = req.params;
    const workspaceId = req.params.workspace_id ? parseInt(req.params.workspace_id, 10) : null;
    if (!canAccess(req, scope, workspaceId)) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const where = scope === 'system_default'
      ? `scope = 'system_default'`
      : `scope = 'tenant' AND workspace_id = $1`;
    const params = scope === 'system_default' ? [] : [workspaceId];

    const sql = scope === 'system_default'
      ? `UPDATE landing_page_content SET published_json = content_json, is_published = true, status='published', published_at = now(), updated_by = $1 WHERE scope='system_default' RETURNING id, published_at, scope, workspace_id`
      : `UPDATE landing_page_content SET published_json = content_json, is_published = true, status='published', published_at = now(), updated_by = $1 WHERE scope='tenant' AND workspace_id = $2 RETURNING id, published_at, scope, workspace_id`;
    const sqlParams = scope === 'system_default' ? [req.user.id] : [req.user.id, workspaceId];
    const updated = await db.get(sql, sqlParams);

    if (!updated) return res.status(404).json({ error: 'no_draft_to_publish', message: 'Salve um rascunho primeiro' });

    audit.log('landing.published', {
      ...audit.fromReq(req),
      scope, target_workspace_id: updated.workspace_id, landing_id: updated.id,
    });
    res.json({ ok: true, ...updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** POST /api/admin/landing/:scope/:workspace_id?/unpublish — despublica */
router.post('/:scope/:workspace_id?/unpublish', async (req, res) => {
  try {
    const { scope } = req.params;
    const workspaceId = req.params.workspace_id ? parseInt(req.params.workspace_id, 10) : null;
    if (!canAccess(req, scope, workspaceId)) return res.status(403).json({ error: 'forbidden' });

    const where = scope === 'system_default' ? `scope = 'system_default'` : `scope = 'tenant' AND workspace_id = $1`;
    const params = scope === 'system_default' ? [] : [workspaceId];
    await db.run(`UPDATE landing_page_content SET is_published = false, status='draft' WHERE ${where}`, params);

    audit.log('landing.unpublished', { ...audit.fromReq(req), scope, target_workspace_id: workspaceId });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** GET /api/admin/landing/:scope/:workspace_id?/preview — render HTML do rascunho */
router.get('/:scope/:workspace_id?/preview', async (req, res) => {
  try {
    const { scope } = req.params;
    const workspaceId = req.params.workspace_id ? parseInt(req.params.workspace_id, 10) : null;
    if (!canAccess(req, scope, workspaceId)) return res.status(403).send('forbidden');

    const content = await resolveDraft({ scope, workspaceId });
    const { render } = require('../utils/landing-render');
    audit.log('landing.preview', { ...audit.fromReq(req), scope, target_workspace_id: workspaceId });
    res.set('Content-Type', 'text/html').send(render(content));
  } catch (e) { res.status(500).send(`<pre>Erro: ${e.message}</pre>`); }
});

module.exports = router;
