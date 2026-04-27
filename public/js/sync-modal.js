/**
 * sync-modal.js — Modal completo de importação Google Ads + Meta Ads.
 * 
 * Abas:
 *  1. Configuração — credenciais e status de conexão
 *  2. Importar     — seleção de período + log SSE em tempo real
 *  3. Histórico    — últimas importações
 */

// ─── helpers ──────────────────────────────────────────────────────────────────
const api = {
  get:  (url)        => fetch(url,            { credentials:'include' }).then(r => r.json()),
  post: (url, body)  => fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify(body) }).then(r => r.json()),
};

export function mountSyncModal({ onSaved } = {}) {
  // ── cria overlay ──
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-sync';
  overlay.innerHTML = `
    <div class="modal modal-xl" style="max-height:85vh;display:flex;flex-direction:column">
      <div class="modal-header" style="flex-shrink:0">
        <h3>📥 Importação de Dados</h3>
        <button class="modal-close" id="sync-close">✕</button>
      </div>

      <!-- ABAS -->
      <div class="sync-tabs" style="flex-shrink:0">
        <button class="sync-tab active" data-tab="config">⚙ Configuração</button>
        <button class="sync-tab" data-tab="import">▶ Importar</button>
        <button class="sync-tab" data-tab="history">📋 Histórico</button>
      </div>

      <div class="modal-body" style="overflow-y:auto;flex:1">

        <!-- ═══════════ ABA CONFIG ═══════════ -->
        <div class="sync-panel active" id="sync-panel-config">

          <!-- Status geral -->
          <div id="sync-status-bar" class="sync-status-bar">Carregando…</div>

          <!-- Google Ads -->
          <div class="sync-section">
            <div class="sync-section-header">
              <div class="sync-platform-icon google">G</div>
              <div>
                <div class="sync-platform-title">Google Ads</div>
                <div class="sync-platform-sub" id="google-status-text">Verificando…</div>
              </div>
              <span class="sync-badge" id="google-badge">…</span>
            </div>

            <div class="sync-fields" id="google-fields">
              <div class="sync-field-group">
                <label>Developer Token</label>
                <input type="password" id="g-developerToken" placeholder="xxxxxxxxxxxxxxxxxxxx" autocomplete="off">
              </div>
              <div class="sync-field-group">
                <label>Client ID</label>
                <input type="text" id="g-clientId" placeholder="xxx.apps.googleusercontent.com" autocomplete="off">
              </div>
              <div class="sync-field-group">
                <label>Client Secret</label>
                <input type="password" id="g-clientSecret" placeholder="GOCSPX-…" autocomplete="off">
              </div>
              <div class="sync-field-group">
                <label>Customer ID <span style="color:var(--muted);font-size:11px">(conta com campanhas)</span></label>
                <input type="text" id="g-customerId" placeholder="971-906-6631" autocomplete="off">
              </div>
              <div class="sync-field-group">
                <label>Manager ID <span style="color:var(--muted);font-size:11px">(MCC — conta gerenciadora)</span></label>
                <input type="text" id="g-loginCustomerId" placeholder="888-573-1525" autocomplete="off">
              </div>
              <div class="sync-field-group">
                <label>Refresh Token</label>
                <div style="display:flex;gap:8px;align-items:center">
                  <input type="password" id="g-refreshToken" placeholder="1//0… (ou use o botão OAuth2)" autocomplete="off" style="flex:1">
                  <button class="btn small" id="btn-google-oauth" title="Autorizar via Google OAuth2">🔑 OAuth2</button>
                </div>
              </div>
            </div>

            <div class="sync-actions">
              <button class="btn" id="btn-save-google">💾 Salvar</button>
              <button class="btn outline" id="btn-test-google">🔌 Testar Conexão</button>
            </div>
            <div class="sync-feedback" id="google-feedback"></div>
          </div>

          <!-- Meta Ads -->
          <div class="sync-section" style="margin-top:24px">
            <div class="sync-section-header">
              <div class="sync-platform-icon meta">f</div>
              <div>
                <div class="sync-platform-title">Meta Ads</div>
                <div class="sync-platform-sub" id="meta-status-text">Verificando…</div>
              </div>
              <span class="sync-badge" id="meta-badge">…</span>
            </div>

            <div class="sync-fields" id="meta-fields">
              <div class="sync-field-group">
                <label>System User Token (não expira)</label>
                <textarea id="m-accessToken" rows="3" placeholder="EAAxxxxxxx…" style="resize:vertical"></textarea>
              </div>
              <div class="sync-field-group">
                <label>Ad Account ID</label>
                <input type="text" id="m-adAccountId" placeholder="act_123456789" autocomplete="off">
              </div>
            </div>

            <div class="sync-help">
              <details>
                <summary>Como obter o System User Token?</summary>
                <ol>
                  <li>Acesse <a href="https://business.facebook.com" target="_blank" rel="noopener">business.facebook.com</a></li>
                  <li>Configurações → Usuários → Usuários do Sistema</li>
                  <li>Selecione o usuário → "Gerar token"</li>
                  <li>Permissões necessárias: <code>ads_read</code>, <code>read_insights</code></li>
                </ol>
              </details>
            </div>

            <div class="sync-actions">
              <button class="btn" id="btn-save-meta">💾 Salvar</button>
              <button class="btn outline" id="btn-test-meta">🔌 Testar Conexão</button>
            </div>
            <div class="sync-feedback" id="meta-feedback"></div>
          </div>
        </div>

        <!-- ═══════════ ABA IMPORT ═══════════ -->
        <div class="sync-panel" id="sync-panel-import">

          <div class="import-form">
            <div class="import-period">
              <div class="sync-field-group">
                <label>Data inicial</label>
                <input type="date" id="imp-from">
              </div>
              <div class="sync-field-group">
                <label>Data final</label>
                <input type="date" id="imp-to">
              </div>
            </div>

            <div class="import-platforms">
              <label class="platform-check">
                <input type="checkbox" id="imp-google" checked>
                <span class="pcheck-box google">G</span>
                Google Ads
              </label>
              <label class="platform-check">
                <input type="checkbox" id="imp-meta" checked>
                <span class="pcheck-box meta">f</span>
                Meta Ads
              </label>
            </div>

            <button class="btn primary large" id="btn-run-import" style="width:100%;margin-top:16px">
              ▶ Importar Dados
            </button>
          </div>

          <!-- Barra de progresso -->
          <div class="import-progress-wrap hidden" id="import-progress-wrap">
            <div class="import-progress-bar">
              <div class="import-progress-fill" id="import-progress-fill"></div>
            </div>
            <div class="import-progress-label" id="import-progress-label">Iniciando…</div>
          </div>

          <!-- Log em tempo real -->
          <div class="import-log-wrap">
            <div class="import-log-header">Log de importação</div>
            <div class="import-log" id="import-log"></div>
          </div>
        </div>

        <!-- ═══════════ ABA HISTÓRICO ═══════════ -->
        <div class="sync-panel" id="sync-panel-history">
          <div id="sync-history-content">
            <p class="muted" style="text-align:center;padding:32px">Carregando histórico…</p>
          </div>
        </div>

      </div><!-- /modal-body -->
    </div>
  `;

  document.body.appendChild(overlay);

  // ── refs ──
  const q = (s) => overlay.querySelector(s);

  // Abas
  overlay.querySelectorAll('.sync-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      overlay.querySelectorAll('.sync-tab,.sync-panel').forEach(el => el.classList.remove('active'));
      tab.classList.add('active');
      q(`#sync-panel-${tab.dataset.tab}`).classList.add('active');
      if (tab.dataset.tab === 'history') loadHistory();
    });
  });

  // Fechar
  q('#sync-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.classList.contains('open')) close(); });

  // ── Funções ──────────────────────────────────────────────────────────

  function close() {
    overlay.classList.remove('open');
  }

  function feedback(id, msg, type = 'info') {
    const el = q(`#${id}`);
    if (!el) return;
    const colors = { info: 'var(--teal)', success: 'var(--good)', error: 'var(--bad)' };
    el.textContent = msg;
    el.style.color = colors[type] || 'var(--muted)';
  }

  function setBadge(id, ok) {
    const el = q(`#${id}`);
    if (!el) return;
    el.textContent = ok ? '✓ Conectado' : '✗ Não configurado';
    el.className = `sync-badge ${ok ? 'ok' : 'bad'}`;
  }

  async function loadStatus() {
    try {
      const s = await api.get('/api/sync/status');
      setBadge('google-badge', s.google?.configured);
      setBadge('meta-badge',   s.meta?.configured);

      q('#google-status-text').textContent = s.google?.configured
        ? 'Credenciais configuradas ✓'
        : `Faltando: ${(s.google?.missing || []).join(', ')}`;

      q('#meta-status-text').textContent = s.meta?.configured
        ? 'Credenciais configuradas ✓'
        : `Faltando: ${(s.meta?.missing || []).join(', ')}`;

      const allOk = s.google?.configured && s.meta?.configured;
      const bar = q('#sync-status-bar');
      if (allOk) {
        bar.textContent = '✓ Ambas as plataformas configuradas — pronto para importar.';
        bar.className = 'sync-status-bar ok';
      } else {
        const names = [!s.google?.configured && 'Google Ads', !s.meta?.configured && 'Meta Ads'].filter(Boolean);
        bar.textContent = `⚠ Pendente: ${names.join(' e ')}`;
        bar.className = 'sync-status-bar warn';
      }
    } catch (e) {
      q('#sync-status-bar').textContent = '✗ Erro ao verificar status: ' + e.message;
    }
  }

  // Salvar Google
  q('#btn-save-google').addEventListener('click', async () => {
    const fields = {
      developerToken:  q('#g-developerToken').value,
      clientId:        q('#g-clientId').value,
      clientSecret:    q('#g-clientSecret').value,
      customerId:      q('#g-customerId').value,
      loginCustomerId: q('#g-loginCustomerId').value,
      refreshToken:    q('#g-refreshToken').value,
    };
    const r = await api.post('/api/sync/credentials', { platform: 'google', fields });
    if (r.ok) { feedback('google-feedback', `✓ ${r.saved} campos salvos!`, 'success'); await loadStatus(); }
    else       feedback('google-feedback', '✗ ' + (r.error || 'Erro'), 'error');
  });

  // Salvar Meta
  q('#btn-save-meta').addEventListener('click', async () => {
    const fields = {
      accessToken:  q('#m-accessToken').value,
      adAccountId:  q('#m-adAccountId').value,
    };
    const r = await api.post('/api/sync/credentials', { platform: 'meta', fields });
    if (r.ok) { feedback('meta-feedback', `✓ ${r.saved} campos salvos!`, 'success'); await loadStatus(); }
    else       feedback('meta-feedback', '✗ ' + (r.error || 'Erro'), 'error');
  });

  // Testar Google
  q('#btn-test-google').addEventListener('click', async () => {
    feedback('google-feedback', '🔌 Testando conexão…', 'info');
    try {
      const r = await api.post('/api/sync/test/google');
      if (r.ok) feedback('google-feedback', `✓ Conexão OK — ${r.campaigns} campanhas encontradas`, 'success');
      else      feedback('google-feedback', '✗ ' + (r.error || 'Falha'), 'error');
    } catch (e) { feedback('google-feedback', '✗ ' + e.message, 'error'); }
    await loadStatus();
  });

  // Testar Meta
  q('#btn-test-meta').addEventListener('click', async () => {
    feedback('meta-feedback', '🔌 Testando conexão…', 'info');
    try {
      const r = await api.post('/api/sync/test/meta');
      if (r.ok) {
        const acc = r.account ? ` · ${r.account.name}` : '';
        feedback('meta-feedback', `✓ Autenticado como ${r.user?.name}${acc}`, 'success');
      } else {
        feedback('meta-feedback', '✗ ' + (r.error || 'Falha'), 'error');
      }
    } catch (e) { feedback('meta-feedback', '✗ ' + e.message, 'error'); }
    await loadStatus();
  });

  // OAuth2 Google
  q('#btn-google-oauth').addEventListener('click', async () => {
    const r = await api.get('/api/sync/oauth/google');
    if (r.url) {
      const win = window.open(r.url, 'google_oauth', 'width=500,height=650');
      window.addEventListener('message', async (e) => {
        if (e.data?.type === 'google_oauth_ok') {
          win?.close();
          feedback('google-feedback', '✓ Refresh Token obtido e salvo!', 'success');
          await loadStatus();
        }
      }, { once: true });
    } else {
      feedback('google-feedback', '✗ ' + (r.error || 'Preencha Client ID e Client Secret primeiro'), 'error');
    }
  });

  // ── Aba Importar ──────────────────────────────────────────────────────

  // Padrão: mês atual
  const now   = new Date();
  const yr    = now.getFullYear();
  const mo    = String(now.getMonth() + 1).padStart(2, '0');
  const lastD = new Date(yr, now.getMonth() + 1, 0).getDate();
  q('#imp-from').value = `${yr}-${mo}-01`;
  q('#imp-to').value   = `${yr}-${mo}-${lastD}`;

  function appendLog(msg, type = 'info') {
    const log = q('#import-log');
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    line.textContent = `[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  function setProgress(pct, label) {
    q('#import-progress-wrap').classList.remove('hidden');
    q('#import-progress-fill').style.width = `${pct}%`;
    q('#import-progress-label').textContent = label;
  }

  q('#btn-run-import').addEventListener('click', async () => {
    const from       = q('#imp-from').value;
    const to         = q('#imp-to').value;
    const doGoogle   = q('#imp-google').checked;
    const doMeta     = q('#imp-meta').checked;

    if (!from || !to)            return appendLog('✗ Selecione datas de início e fim.', 'error');
    if (!doGoogle && !doMeta)    return appendLog('✗ Selecione ao menos uma plataforma.', 'error');
    if (from > to)               return appendLog('✗ Data inicial deve ser antes da final.', 'error');

    q('#import-log').innerHTML = '';
    q('#btn-run-import').disabled = true;
    setProgress(0, 'Iniciando…');

    const platforms = [doGoogle && 'google', doMeta && 'meta'].filter(Boolean);
    let done = 0;

    for (const platform of platforms) {
      appendLog(`▶ Iniciando importação ${platform === 'google' ? 'Google Ads' : 'Meta Ads'}…`, 'info');
      setProgress((done / platforms.length) * 100, `Importando ${platform}…`);

      try {
        await new Promise((resolve, reject) => {
          const es = new EventSource(`/api/sync/${platform}?stream=1`, { withCredentials: true });

          // O SSE é POST (EventSource só suporta GET).
          // Usamos fetch com body e lemos a resposta como stream.
          es.close(); // fecha imediatamente, usamos fetch abaixo

          fetch(`/api/sync/${platform}?stream=1`, {
            method:      'POST',
            credentials: 'include',
            headers:     { 'Content-Type': 'application/json' },
            body:        JSON.stringify({ from, to }),
          }).then(async response => {
            const reader  = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { done: d, value } = await reader.read();
              if (d) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop();
              for (const line of lines) {
                if (!line.startsWith('data:')) continue;
                try {
                  const ev = JSON.parse(line.slice(5).trim());
                  if (ev.type === 'info')    appendLog(ev.message, 'info');
                  if (ev.type === 'success') appendLog(ev.message, 'success');
                  if (ev.type === 'error')   appendLog(ev.message, 'error');
                  if (ev.type === 'done')    resolve(ev);
                } catch {}
              }
            }
            resolve();
          }).catch(reject);
        });

        done++;
        setProgress((done / platforms.length) * 100, `${platform} concluído`);
      } catch (e) {
        appendLog(`✗ Erro ${platform}: ${e.message}`, 'error');
        done++;
      }
    }

    setProgress(100, '✓ Importação concluída!');
    q('#btn-run-import').disabled = false;
    onSaved?.();
  });

  // ── Histórico ─────────────────────────────────────────────────────────

  async function loadHistory() {
    const el = q('#sync-history-content');
    el.innerHTML = '<p class="muted" style="text-align:center;padding:32px">Carregando…</p>';
    try {
      const history = await api.get('/api/sync/history');
      if (!history.length) {
        el.innerHTML = '<p class="muted" style="text-align:center;padding:32px">Nenhuma importação registrada ainda.</p>';
        return;
      }
      el.innerHTML = `
        <table>
          <thead><tr><th>Data/Hora</th><th>Plataforma</th><th>Período</th><th>Buscadas</th><th>Importadas</th><th>Status</th></tr></thead>
          <tbody>
            ${history.map(h => `
              <tr>
                <td class="num" style="font-size:11px">${new Date(h.at).toLocaleString('pt-BR')}</td>
                <td><span class="src-tag ${h.platform}">● ${h.platform === 'google' ? 'Google' : 'Meta'}</span></td>
                <td class="num" style="font-size:11px">${h.from} → ${h.to}</td>
                <td class="num">${h.fetched ?? '—'}</td>
                <td class="num">${h.inserted ?? '—'}</td>
                <td><span class="status-pill ${h.status === 'ok' ? 'active' : 'ended'}">${h.status === 'ok' ? 'OK' : 'Erro'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${history.find(h => h.error) ? `<div class="sync-feedback" style="color:var(--bad);margin-top:8px">Último erro: ${history.find(h=>h.error)?.error}</div>` : ''}
      `;
    } catch (e) {
      el.innerHTML = `<p class="muted" style="color:var(--bad);text-align:center;padding:32px">Erro: ${e.message}</p>`;
    }
  }

  // ── API pública ───────────────────────────────────────────────────────
  async function open() {
    overlay.classList.add('open');
    // Reseta para aba Config
    overlay.querySelectorAll('.sync-tab,.sync-panel').forEach(el => el.classList.remove('active'));
    q('.sync-tab[data-tab="config"]').classList.add('active');
    q('#sync-panel-config').classList.add('active');
    await loadStatus();
  }

  return { open, close };
}
