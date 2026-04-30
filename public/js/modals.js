/**
 * modals.js — modais reutilizáveis: Entrada de Dados, Campanhas, Metas, Notas.
 */
import { api }        from './api.js';
import { toast, MESES, MESES_FULL, fmtBRL, fmtInt } from './utils.js';

const $  = (s, r = document) => r.querySelector(s);

function openModal(id) { $('#' + id).classList.add('open'); }
function closeModal(id) { $('#' + id).classList.remove('open'); }

// ------------------------------------------------------------
// Modal 1 — Entrada de dados
// ------------------------------------------------------------
export function mountEntryModal({ onSaved }) {
  const modal = $('#modal-entry');

  async function hydrateCampaigns() {
    const camps = await api.campaigns();
    const g = camps.filter(c => c.channel === 'google');
    const m = camps.filter(c => c.channel === 'meta');

    const sel = (el, list) => {
      el.innerHTML = list.map(c => `<option value="${c.id}">${c.name}</option>`).join('')
        || '<option disabled>Nenhuma campanha — crie no menu Campanhas</option>';
    };
    sel($('#entry-g-campaign'), g);
    sel($('#entry-m-campaign'), m);
  }

  // fecha
  modal.addEventListener('click', e => { if (e.target === modal) closeModal('modal-entry'); });
  $('#entry-close').addEventListener('click', () => closeModal('modal-entry'));

  // tabs mês / dia
  $$('.modal-tabs .mt-btn', modal).forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.modal-tabs .mt-btn', modal).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.mode;
      $('#entry-monthly').classList.toggle('hidden', mode !== 'monthly');
      $('#entry-daily').classList.toggle('hidden',   mode !== 'daily');
    });
  });

  // salvar mensal (consolida em 1 upsert para dia 15 do mês)
  // OBS: esta é uma forma simplificada — a pessoa prefere editar valores mensais agregados sem quebrar por dia.
  // Cada campanha recebe uma linha em YYYY-MM-15 com o total do mês.
  $('#entry-save-monthly').addEventListener('click', async () => {
    const year  = Number($('#entry-year').value);
    const month = Number($('#entry-month').value);
    const day   = 15;
    const date  = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

    const rows = [];
    const pushIfData = (campId, ids) => {
      const body = {
        campaign_id: Number(campId),
        date,
        impressions: Number($(`#${ids.imp}`).value) || 0,
        clicks:      Number($(`#${ids.cli}`).value) || 0,
        conversions: Number($(`#${ids.conv}`).value) || 0,
        spend:       Number($(`#${ids.inv}`).value) || 0,
        revenue:     Number($(`#${ids.rev}`).value) || 0,
      };
      if (body.impressions || body.clicks || body.conversions || body.spend) rows.push(body);
    };
    pushIfData($('#entry-g-campaign').value, { imp:'entry-g-imp', cli:'entry-g-cli', conv:'entry-g-conv', inv:'entry-g-inv', rev:'entry-g-rev' });
    pushIfData($('#entry-m-campaign').value, { imp:'entry-m-imp', cli:'entry-m-cli', conv:'entry-m-conv', inv:'entry-m-inv', rev:'entry-m-rev' });

    if (!rows.length) { toast('Preencha ao menos um valor', { error: true }); return; }
    try {
      await api.bulkDaily(rows);
      toast('Dados do mês salvos');
      closeModal('modal-entry');
      onSaved?.();
    } catch (e) { toast('Erro: ' + e.message, { error: true }); }
  });

  // salvar diário
  $('#entry-save-daily').addEventListener('click', async () => {
    const date = $('#entry-daily-date').value;
    if (!date) { toast('Informe a data', { error: true }); return; }

    const rows = [];
    const g = {
      campaign_id: Number($('#entry-g-campaign').value),
      date,
      impressions: Number($('#entry-dg-imp').value) || 0,
      clicks:      Number($('#entry-dg-cli').value) || 0,
      conversions: Number($('#entry-dg-conv').value) || 0,
      spend:       Number($('#entry-dg-inv').value) || 0,
    };
    if (g.impressions || g.clicks || g.conversions || g.spend) rows.push(g);

    const m = {
      campaign_id: Number($('#entry-m-campaign').value),
      date,
      impressions: Number($('#entry-dm-imp').value) || 0,
      clicks:      Number($('#entry-dm-cli').value) || 0,
      conversions: Number($('#entry-dm-conv').value) || 0,
      spend:       Number($('#entry-dm-inv').value) || 0,
    };
    if (m.impressions || m.clicks || m.conversions || m.spend) rows.push(m);

    if (!rows.length) { toast('Preencha ao menos um valor', { error: true }); return; }
    try {
      await api.bulkDaily(rows);
      toast('Dados do dia salvos');
      closeModal('modal-entry');
      onSaved?.();
    } catch (e) { toast('Erro: ' + e.message, { error: true }); }
  });

  return {
    open: async () => { await hydrateCampaigns(); openModal('modal-entry'); },
  };
}

// ------------------------------------------------------------
// Modal 2 — Gerenciar Campanhas
// ------------------------------------------------------------
export function mountCampaignsModal({ onChanged }) {
  const modal = $('#modal-campaigns');
  modal.addEventListener('click', e => { if (e.target === modal) closeModal('modal-campaigns'); });
  $('#camp-close').addEventListener('click', () => closeModal('modal-campaigns'));

  async function refresh() {
    const rows = await api.campaigns();
    const tbody = $('#camp-tbody');
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="muted" style="text-align:center;padding:18px">Nenhuma campanha cadastrada.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(c => `
      <tr data-id="${c.id}">
        <td><span class="src-tag ${c.channel}">● ${c.channel === 'google' ? 'Google' : 'Meta'}</span></td>
        <td>
          <input class="camp-name" value="${escapeAttr(c.name)}">
        </td>
        <td><input class="camp-obj" value="${escapeAttr(c.objective || '')}" placeholder="Leads / Conversões…"></td>
        <td>
          <select class="camp-status">
            <option value="active"  ${c.status==='active'?'selected':''}>Ativa</option>
            <option value="paused"  ${c.status==='paused'?'selected':''}>Pausada</option>
            <option value="ended"   ${c.status==='ended' ?'selected':''}>Encerrada</option>
          </select>
        </td>
        <td class="row right">
          <button class="btn small camp-save">Salvar</button>
          <button class="btn small del-btn camp-del">Excluir</button>
        </td>
      </tr>
    `).join('');
    tbody.querySelectorAll('tr[data-id]').forEach(tr => {
      const id = Number(tr.dataset.id);
      tr.querySelector('.camp-save').addEventListener('click', async () => {
        try {
          await api.updateCampaign(id, {
            name: tr.querySelector('.camp-name').value.trim(),
            objective: tr.querySelector('.camp-obj').value.trim(),
            status: tr.querySelector('.camp-status').value,
          });
          toast('Campanha atualizada');
          onChanged?.();
        } catch (e) { toast('Erro: ' + e.message, { error: true }); }
      });
      tr.querySelector('.camp-del').addEventListener('click', async () => {
        if (!confirm('Excluir esta campanha e todos os dados históricos vinculados?')) return;
        try { await api.deleteCampaign(id); toast('Campanha excluída'); refresh(); onChanged?.(); }
        catch (e) { toast('Erro: ' + e.message, { error: true }); }
      });
    });
  }

  $('#camp-create').addEventListener('click', async () => {
    const channel = $('#camp-new-channel').value;
    const name    = $('#camp-new-name').value.trim();
    const obj     = $('#camp-new-obj').value.trim();
    if (!name) { toast('Nome é obrigatório', { error: true }); return; }
    try {
      await api.createCampaign({ channel, name, objective: obj });
      $('#camp-new-name').value = ''; $('#camp-new-obj').value = '';
      toast('Campanha criada');
      refresh(); onChanged?.();
    } catch (e) { toast('Erro: ' + e.message, { error: true }); }
  });

  return { open: async () => { await refresh(); openModal('modal-campaigns'); }, refresh };
}

// ------------------------------------------------------------
// Modal 3 — Metas
// ------------------------------------------------------------
export function mountGoalsModal({ onChanged }) {
  const modal = $('#modal-goals');
  modal.addEventListener('click', e => { if (e.target === modal) closeModal('modal-goals'); });
  $('#goal-close').addEventListener('click', () => closeModal('modal-goals'));

  async function refresh() {
    const year = Number($('#goal-year').value);
    const rows = await api.goals({ year });
    const tbody = $('#goal-tbody');
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="muted" style="text-align:center;padding:18px">Nenhuma meta cadastrada para ${year}.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(g => `
      <tr>
        <td>${MESES[g.month-1]}/${g.year}</td>
        <td><span class="src-tag ${g.channel === 'all' ? 'all' : g.channel}">${g.channel === 'all' ? 'Total' : (g.channel === 'google' ? 'Google' : 'Meta')}</span></td>
        <td>${labelMetric(g.metric)}</td>
        <td>${fmtValueByMetric(g.metric, g.target)}</td>
        <td>${g.direction === 'min' ? 'mínimo' : 'máximo'}</td>
        <td class="right">
          <button class="btn small del-btn" data-id="${g.id}">excluir</button>
        </td>
      </tr>
    `).join('');
    tbody.querySelectorAll('button[data-id]').forEach(b => b.addEventListener('click', async () => {
      try { await api.deleteGoal(Number(b.dataset.id)); toast('Meta removida'); refresh(); onChanged?.(); }
      catch (e) { toast('Erro: ' + e.message, { error: true }); }
    }));
  }

  $('#goal-year').addEventListener('change', refresh);

  $('#goal-create').addEventListener('click', async () => {
    const body = {
      year:    Number($('#goal-new-year').value),
      month:   Number($('#goal-new-month').value),
      channel: $('#goal-new-channel').value,
      metric:  $('#goal-new-metric').value,
      target:  Number($('#goal-new-target').value),
      direction: $('#goal-new-direction').value,
    };
    if (!body.target) { toast('Informe a meta', { error: true }); return; }
    try {
      await api.upsertGoal(body);
      toast('Meta salva');
      $('#goal-new-target').value = '';
      refresh(); onChanged?.();
    } catch (e) { toast('Erro: ' + e.message, { error: true }); }
  });

  return { open: async () => { await refresh(); openModal('modal-goals'); }, refresh };
}

// ------------------------------------------------------------
// Modal 4 — Notas
// ------------------------------------------------------------
export function mountNotesModal({ onChanged }) {
  const modal = $('#modal-notes');
  modal.addEventListener('click', e => { if (e.target === modal) closeModal('modal-notes'); });
  $('#note-close').addEventListener('click', () => closeModal('modal-notes'));

  async function refresh() {
    const year = Number($('#note-filter-year').value);
    const rows = await api.notes({ year });
    const tbody = $('#note-tbody');
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="muted" style="text-align:center;padding:18px">Nenhuma anotação para ${year}.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(n => `
      <tr>
        <td>${MESES[n.month-1]}${n.day ? '/'+String(n.day).padStart(2,'0') : ''}/${n.year}</td>
        <td><span class="src-tag ${n.channel}">${n.channel === 'all' ? 'Total' : (n.channel === 'google' ? 'Google' : 'Meta')}</span></td>
        <td>${escapeAttr(n.tag || '—')}</td>
        <td>${escapeAttr(n.text)}</td>
        <td class="right"><button class="btn small del-btn" data-id="${n.id}">excluir</button></td>
      </tr>
    `).join('');
    tbody.querySelectorAll('button[data-id]').forEach(b => b.addEventListener('click', async () => {
      try { await api.deleteNote(Number(b.dataset.id)); toast('Nota removida'); refresh(); onChanged?.(); }
      catch (e) { toast('Erro: ' + e.message, { error: true }); }
    }));
  }

  $('#note-filter-year').addEventListener('change', refresh);

  $('#note-create').addEventListener('click', async () => {
    const body = {
      year:    Number($('#note-new-year').value),
      month:   Number($('#note-new-month').value),
      day:     $('#note-new-day').value ? Number($('#note-new-day').value) : null,
      channel: $('#note-new-channel').value,
      tag:     $('#note-new-tag').value.trim() || null,
      text:    $('#note-new-text').value.trim(),
    };
    if (!body.text) { toast('Escreva algo', { error: true }); return; }
    try {
      await api.createNote(body);
      toast('Nota salva');
      $('#note-new-text').value = '';
      refresh(); onChanged?.();
    } catch (e) { toast('Erro: ' + e.message, { error: true }); }
  });

  return { open: async () => { await refresh(); openModal('modal-notes'); }, refresh };
}

// ------------------------------------------------------------
// Modal 5 — Gerenciar Usuários
// ------------------------------------------------------------
export function mountUsersModal({ onChanged }) {
  const modal = $('#modal-users');
  modal.addEventListener('click', e => { if (e.target === modal) closeModal('modal-users'); });
  $('#user-close').addEventListener('click', () => closeModal('modal-users'));

  async function refresh() {
    let rows = [], workspaces = [];
    try { 
      rows = await api.users(); 
      workspaces = await api.getWorkspaces();
    } catch {}
    const tbody = $('#user-tbody');
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="muted" style="text-align:center;padding:18px">Nenhum usuário.</td></tr>`;
      return;
    }
    
    const wsOptions = (selId) => `<option value="">-- Todos/Nenhum --</option>` + 
      workspaces.map(w => `<option value="${w.id}" ${w.id == selId ? 'selected' : ''}>${escapeAttr(w.name)}</option>`).join('');

    const newWsSelect = $('#user-new-workspace');
    if (newWsSelect) newWsSelect.innerHTML = wsOptions('');

    tbody.innerHTML = rows.map(u => `
      <tr data-id="${u.id}">
        <td>${escapeAttr(u.username)}</td>
        <td><input class="user-name" value="${escapeAttr(u.display_name || '')}" placeholder="Nome"></td>
        <td>
          <select class="user-role">
            <option value="admin"  ${u.role==='admin'  ? 'selected' : ''}>Admin</option>
            <option value="viewer" ${u.role==='viewer' ? 'selected' : ''}>Viewer</option>
          </select>
        </td>
        <td>
          <select class="user-workspace" title="Cliente associado">${wsOptions(u.current_workspace_id)}</select>
        </td>
        <td><input class="user-pass" type="password" placeholder="Nova senha (opcional)"></td>
        <td class="row right">
          <button class="btn small user-save">Salvar</button>
          <button class="btn small del-btn user-del">Excluir</button>
        </td>
      </tr>
    `).join('');
    tbody.querySelectorAll('tr[data-id]').forEach(tr => {
      const id = Number(tr.dataset.id);
      tr.querySelector('.user-save').addEventListener('click', async () => {
        const body = { 
          display_name: tr.querySelector('.user-name').value.trim(), 
          role: tr.querySelector('.user-role').value,
          workspace_id: tr.querySelector('.user-workspace').value || null
        };
        const pass = tr.querySelector('.user-pass').value;
        if (pass) body.password = pass;
        try { await api.updateUser(id, body); toast('Usuário atualizado'); onChanged?.(); }
        catch (e) { toast('Erro: ' + e.message, { error: true }); }
      });
      tr.querySelector('.user-del').addEventListener('click', async () => {
        if (!confirm('Excluir este usuário?')) return;
        try { await api.deleteUser(id); toast('Usuário excluído'); refresh(); onChanged?.(); }
        catch (e) { toast('Erro: ' + e.message, { error: true }); }
      });
    });
  }

  $('#user-create').addEventListener('click', async () => {
    const body = {
      username:     $('#user-new-username').value.trim(),
      password:     $('#user-new-password').value,
      display_name: $('#user-new-name').value.trim(),
      role:         $('#user-new-role').value,
      workspace_id: $('#user-new-workspace')?.value || null
    };
    if (!body.username || !body.password) { toast('Username e senha são obrigatórios', { error: true }); return; }
    try {
      await api.createUser(body);
      toast('Usuário criado');
      $('#user-new-username').value = ''; $('#user-new-password').value = ''; $('#user-new-name').value = '';
      refresh(); onChanged?.();
    } catch (e) { toast('Erro: ' + e.message, { error: true }); }
  });

  return { open: async () => { await refresh(); openModal('modal-users'); } };
}

// ------------------------------------------------------------
// Modal 6 — Importação CSV
// ------------------------------------------------------------
export function mountImportModal({ onSaved }) {
  const modal = $('#modal-import');
  modal.addEventListener('click', e => { if (e.target === modal) closeModal('modal-import'); });
  $('#import-close').addEventListener('click', () => closeModal('modal-import'));

  $('#import-run').addEventListener('click', async () => {
    const csv = $('#import-csv').value.trim();
    if (!csv) { toast('Cole o CSV acima', { error: true }); return; }
    const resultEl = $('#import-result');
    resultEl.innerHTML = '<em>Importando...</em>';
    try {
      const r = await api.importCSV(csv);
      const errHtml = r.errors?.length
        ? `<details style="margin-top:8px"><summary style="cursor:pointer;color:#ffa94d">${r.errors.length} linhas ignoradas</summary><ul style="margin:8px 0 0;padding-left:20px;font-size:12px">` +
          r.errors.map(e => `<li>Linha ${e.line}: ${escapeAttr(e.error)}</li>`).join('') + '</ul></details>'
        : '';
      resultEl.innerHTML = `<span style="color:#4ecb71">✓ ${r.imported} linha(s) importadas · ${r.skipped} ignoradas</span>${errHtml}`;
      toast(`${r.imported} registros importados`);
      if (r.imported) onSaved?.();
    } catch (e) { resultEl.innerHTML = `<span style="color:#ff6464">✗ ${escapeAttr(e.message)}</span>`; }
  });

  $('#import-clear').addEventListener('click', () => {
    $('#import-csv').value = '';
    $('#import-result').innerHTML = '';
  });

  return { open: () => openModal('modal-import') };
}

// ------------------------------------------------------------
// Modal 7 — Sincronização Google Ads / Meta Ads
// ------------------------------------------------------------
export function mountSyncModal({ onSaved }) {
  const modal = $('#modal-sync');
  modal.addEventListener('click', e => { if (e.target === modal) closeModal('modal-sync'); });
  $('#sync-close').addEventListener('click', () => closeModal('modal-sync'));

  async function refreshStatus() {
    try {
      const s = await api.syncStatus();
      $('#sync-google-status').textContent = s.google.configured ? '✓ Configurado' : '✗ Não configurado';
      $('#sync-google-status').style.color  = s.google.configured ? '#4ecb71' : '#ff6464';
      $('#sync-meta-status').textContent   = s.meta.configured   ? '✓ Configurado' : '✗ Não configurado';
      $('#sync-meta-status').style.color    = s.meta.configured   ? '#4ecb71' : '#ff6464';
    } catch {}
  }

  async function runSync(provider) {
    const from = $('#sync-from').value;
    const to   = $('#sync-to').value;
    if (!from || !to) { toast('Informe o período', { error: true }); return; }
    const resultEl = $('#sync-result');
    resultEl.innerHTML = `<em>Sincronizando ${provider}...</em>`;
    try {
      const r = provider === 'google' ? await api.syncGoogle({ from, to }) : await api.syncMeta({ from, to });
      resultEl.innerHTML = `<span style="color:#4ecb71">✓ ${r.fetched} linhas buscadas · ${r.inserted} inseridas/atualizadas</span>`;
      toast(`Sincronização ${provider} concluída`);
      onSaved?.();
    } catch (e) { resultEl.innerHTML = `<span style="color:#ff6464">✗ ${escapeAttr(e.message)}</span>`; }
  }

  $('#sync-google-run').addEventListener('click', () => runSync('google'));
  $('#sync-meta-run').addEventListener('click', () => runSync('meta'));

  // Pre-fill de datas (mês atual)
  function prefillDates() {
    const now = new Date();
    const y   = now.getFullYear();
    const m   = String(now.getMonth() + 1).padStart(2, '0');
    const last = new Date(y, now.getMonth() + 1, 0).getDate();
    $('#sync-from').value = `${y}-${m}-01`;
    $('#sync-to').value   = `${y}-${m}-${String(last).padStart(2,'0')}`;
  }

  return {
    open: async () => {
      prefillDates();
      await refreshStatus();
      openModal('modal-sync');
    },
  };
}

// ------------------------------------------------------------
// Modal 8 — Alertas por E-mail
// ------------------------------------------------------------
export function mountAlertsModal() {
  const modal = $('#modal-alerts');
  modal.addEventListener('click', e => { if (e.target === modal) closeModal('modal-alerts'); });
  $('#alerts-close').addEventListener('click', () => closeModal('modal-alerts'));

  async function refresh() {
    let data;
    try { data = await api.alertConfigs(); } catch { return; }
    const tbody = $('#alerts-tbody');
    const smtpBadge = $('#alerts-smtp-status');
    smtpBadge.textContent = data.configured ? '✓ SMTP configurado' : '✗ SMTP não configurado (defina SMTP_USER e SMTP_PASS no .env)';
    smtpBadge.style.color = data.configured ? '#4ecb71' : '#ffa94d';

    const metricLabel = m => ({cpl:'CPL',cpc:'CPC',ctr:'CTR',roas:'ROAS',spend:'Investimento',conversions:'Conversões',impressions:'Impressões',clicks:'Cliques'})[m] || m;
    const chanLabel   = c => c === 'all' ? 'Total' : (c === 'google' ? 'Google' : 'Meta');

    if (!data.alerts.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="muted" style="text-align:center;padding:18px">Nenhum alerta cadastrado.</td></tr>`;
    } else {
      tbody.innerHTML = data.alerts.map(a => `
        <tr>
          <td>${metricLabel(a.metric)}</td>
          <td>${chanLabel(a.channel)}</td>
          <td>${a.direction === 'min' ? 'mín' : 'máx'} ${a.threshold}</td>
          <td style="font-size:11px;max-width:140px;overflow:hidden;text-overflow:ellipsis">
            ${a.email ? escapeAttr(a.email) : ''}
            ${a.whatsapp ? `<br><span style="color:#25D366"><i class="ph ph-whatsapp-logo"></i> ${escapeAttr(a.whatsapp)}</span>` : ''}
            ${a.webhook_url ? '<br><span style="color:#00ADA7"><i class="ph ph-link"></i> Webhook Ativo</span>' : ''}
            ${a.window_days ? `<br><span style="color:#a8a29e">Últimos ${a.window_days} dias</span>` : ''}
          </td>
          <td><span style="color:${a.active ? '#4ecb71' : '#ff6464'}">${a.active ? 'Ativo' : 'Inativo'}</span></td>
          <td class="row right">
            <button class="btn small" data-toggle="${a.id}" data-active="${a.active}">${a.active ? 'Pausar' : 'Ativar'}</button>
            <button class="btn small del-btn" data-del="${a.id}">Excluir</button>
          </td>
        </tr>
      `).join('');
    }

    tbody.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', async () => {
      try { await api.toggleAlert(Number(b.dataset.toggle), b.dataset.active === '1' ? 0 : 1); refresh(); }
      catch (e) { toast('Erro: ' + e.message, { error:true }); }
    }));
    tbody.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      if (confirm('Excluir alerta?')) {
        try { await api.deleteAlert(Number(b.dataset.del)); refresh(); }
        catch (e) { toast('Erro: ' + e.message, { error:true }); }
      }
    }));

    // Carregar Logs
    try {
      const logs = await api.alertLog();
      const logTbody = $('#alerts-log-tbody');
      if (!logs.length) {
        logTbody.innerHTML = `<tr><td colspan="4" class="muted" style="text-align:center;padding:18px">Nenhum alerta disparado recentemente.</td></tr>`;
      } else {
        logTbody.innerHTML = logs.map(l => `
          <tr>
            <td style="font-size:12px">${new Date(l.created_at).toLocaleString('pt-BR')}</td>
            <td>${metricLabel(l.metric)} (${chanLabel(l.channel)})</td>
            <td>${l.direction === 'min' ? 'mín' : 'máx'} ${l.threshold}</td>
            <td style="color:var(--bad);font-weight:bold">${l.triggered_value}</td>
          </tr>
        `).join('');
      }
    } catch (e) { console.error('Erro ao carregar logs:', e); }
  }

  $('#alerts-create').addEventListener('click', async () => {
    const body = {
      metric:    $('#alerts-new-metric').value,
      channel:   $('#alerts-new-channel').value,
      threshold: Number($('#alerts-new-threshold').value),
      direction: $('#alerts-new-direction').value,
      email:     $('#alerts-new-email').value.trim() || undefined,
      whatsapp:  $('#alerts-new-whatsapp').value.trim() || undefined,
      webhook_url: $('#alerts-new-webhook').value.trim() || undefined,
      window_days: Number($('#alerts-new-window').value) || 0,
    };
    if (!body.email && !body.webhook_url && !body.whatsapp) { toast('Informe um E-mail, WhatsApp ou Webhook', { error: true }); return; }
    if (!body.threshold) { toast('O limiar (threshold) é obrigatório', { error: true }); return; }
    try { await api.createAlertConfig(body); toast('Alerta criado'); refresh(); }
    catch (e) { toast('Erro: ' + e.message, { error: true }); }
  });

  $('#alerts-test').addEventListener('click', async () => {
    const email = $('#alerts-test-email').value.trim();
    if (!email) { toast('Informe o e-mail de teste', { error: true }); return; }
    try { const r = await api.testAlert(email); toast(r.message || 'E-mail enviado!'); }
    catch (e) { toast('Erro: ' + e.message, { error: true }); }
  });

  return { open: async () => { await refresh(); openModal('modal-alerts'); } };
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function escapeAttr(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function labelMetric(m) { return ({cpl:'CPL',cpc:'CPC',ctr:'CTR',roas:'ROAS',spend:'Investimento',conversions:'Conversões',impressions:'Impressões',clicks:'Cliques'})[m] || m; }
function fmtValueByMetric(m, v) {
  if (['spend','cpl','cpc'].includes(m)) return fmtBRL(v, ['spend'].includes(m) ? 0 : 2);
  if (m === 'roas') return Number(v).toFixed(2) + 'x';
  if (['ctr','cvr'].includes(m)) return Number(v).toFixed(2) + '%';
  return fmtInt(v);
}
function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

// ---------------------------------------------------------------
// White-Label / Branding Modal
// ---------------------------------------------------------------
export function mountBrandingModal({ onSaved }) {
  const modal = $('#modal-branding');
  const btnOpen = $('#btn-branding');
  const btnClose = $('#branding-close');
  const btnSave = $('#branding-save');

  const inpName = $('#branding-name');
  const inpLogo = $('#branding-logo');
  const inpColor = $('#branding-color');

  if (!modal || !btnOpen) return null;

  btnOpen.style.display = 'inline-block'; // Show for admin

  btnOpen.addEventListener('click', async () => {
    try {
      const res = await api.me();
      if (res && res.user) {
        inpName.value = res.user.workspace_name || '';
        inpLogo.value = res.user.logo_url || '';
        inpColor.value = res.user.theme_color || '#00F0FF';
      }
    } catch(e) {}
    openModal('modal-branding');
  });

  btnClose.addEventListener('click', () => closeModal('modal-branding'));

  btnSave.addEventListener('click', async () => {
    const name = inpName.value.trim();
    if (!name) return toast('Nome é obrigatório', { error: true });
    btnSave.textContent = 'Salvando...';
    try {
      const res = await api.me();
      await api.updateBranding(res.user.workspace_id, {
        name,
        logo_url: inpLogo.value.trim(),
        theme_color: inpColor.value
      });
      closeModal('modal-branding');
      location.reload(); // Reload to apply new branding immediately
    } catch (e) {
      toast(e.message, { error: true });
    } finally {
      btnSave.textContent = 'Salvar Personalização';
    }
  });

  return modal;
}

// ---------------------------------------------------------------
// UTM Generator Modal
// ---------------------------------------------------------------
export function mountUTMModal() {
  const modal = $('#modal-utm');
  const btnOpen = $('#btn-utm');
  const btnClose = $('#utm-close');
  const btnCopy = $('#utm-copy');

  const inpUrl = $('#utm-url');
  const inpSource = $('#utm-source');
  const inpMedium = $('#utm-medium');
  const inpCampaign = $('#utm-campaign');
  const inpTerm = $('#utm-term');
  const inpContent = $('#utm-content');
  const inpResult = $('#utm-result');

  if (!modal || !btnOpen) return null;

  function generateLink() {
    let baseUrl = inpUrl.value.trim();
    if (!baseUrl) {
      inpResult.value = '';
      return;
    }
    try {
      const url = new URL(baseUrl.startsWith('http') ? baseUrl : 'https://' + baseUrl);
      if (inpSource.value.trim()) url.searchParams.set('utm_source', inpSource.value.trim());
      if (inpMedium.value.trim()) url.searchParams.set('utm_medium', inpMedium.value.trim());
      if (inpCampaign.value.trim()) url.searchParams.set('utm_campaign', inpCampaign.value.trim());
      if (inpTerm.value.trim()) url.searchParams.set('utm_term', inpTerm.value.trim());
      if (inpContent.value.trim()) url.searchParams.set('utm_content', inpContent.value.trim());
      inpResult.value = url.toString();
    } catch(e) {
      inpResult.value = 'URL inválida';
    }
  }

  [inpUrl, inpSource, inpMedium, inpCampaign, inpTerm, inpContent].forEach(el => {
    el.addEventListener('input', generateLink);
  });

  btnOpen.addEventListener('click', () => {
    openModal('modal-utm');
  });

  btnClose.addEventListener('click', () => closeModal('modal-utm'));

  btnCopy.addEventListener('click', () => {
    if (inpResult.value && inpResult.value !== 'URL inválida') {
      navigator.clipboard.writeText(inpResult.value);
      toast('Link Copiado!');
    }
  });

  return modal;
}

// ---------------------------------------------------------------
// Pixel Modal
// ---------------------------------------------------------------
export function mountPixelModal() {
  const modal = $('#modal-pixel');
  const btnOpen = $('#btn-pixel');
  const btnClose = $('#pixel-close');
  const btnCopyBase = $('#pixel-copy-base');
  const btnCopyConv = $('#pixel-copy-conversion');
  const txtBase = $('#pixel-code-base');
  const txtConv = $('#pixel-code-conversion');

  if (!modal || !btnOpen) return null;

  btnOpen.addEventListener('click', async () => {
    try {
      const res = await api.me();
      const workspaceId = res.user.workspace_id || 1;
      const host = window.location.origin;
      
      const snippet = `<script>
  window.maranetQueue = window.maranetQueue || [];
  function maranet(){ maranetQueue.push(arguments); }
  maranet('init', '${workspaceId}');
  maranet('track', 'pageview');
</script>
<script async src="${host}/js/maranet-pixel.js"></script>`;
      
      txtBase.value = snippet;
    } catch(e) {}
    openModal('modal-pixel');
  });

  btnClose.addEventListener('click', () => closeModal('modal-pixel'));

  btnCopyBase.addEventListener('click', () => {
    if (txtBase.value) {
      navigator.clipboard.writeText(txtBase.value);
      toast('Código Base Copiado!');
    }
  });

  btnCopyConv.addEventListener('click', () => {
    if (txtConv.value) {
      navigator.clipboard.writeText(txtConv.value);
      toast('Código de Conversão Copiado!');
    }
  });

  return modal;
}

// ---------------------------------------------------------------
// Automations (Stop-Loss) Modal
// ---------------------------------------------------------------
export function mountAutomationsModal() {
  const modal = $('#modal-automations');
  const btnOpen = $('#btn-automations');
  const btnClose = $('#automations-close');
  const btnAdd = $('#auto-add');
  const tbody = $('#automations-table tbody');

  if (!modal || !btnOpen) return null;

  btnOpen.style.display = 'inline-block'; // Admin only by default via CSS/JS

  async function loadAutomations() {
    try {
      const rows = await api.automations();
      tbody.innerHTML = '';
      if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="center muted" style="padding:15px;">Nenhuma automação configurada.</td></tr>';
        return;
      }
      rows.forEach(r => {
        const tr = document.createElement('tr');
        const metricName = {spend:'Gasto',roas:'ROAS',cpl:'CPL',cpc:'CPC'}[r.metric] || r.metric;
        const actName = {pause_campaign:'Pausar Campanha',notify_whatsapp:'Notificar'}[r.action] || r.action;
        tr.innerHTML = `
          <td>${escapeAttr(r.name)}</td>
          <td>${metricName}</td>
          <td>${r.operator} ${r.value}</td>
          <td>${actName}</td>
          <td>
            <label class="switch">
              <input type="checkbox" class="auto-toggle" data-id="${r.id}" ${r.active ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
          </td>
          <td class="right">
            <button class="btn btn-sm auto-del" data-id="${r.id}" style="color:var(--laranja); border-color:var(--laranja);">Excluir</button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      $$('.auto-toggle', tbody).forEach(el => {
        el.addEventListener('change', async (e) => {
          try {
            await api.toggleAutomation(e.target.dataset.id, e.target.checked);
            toast('Status atualizado');
          } catch(err) {
            toast(err.message, { error: true });
            e.target.checked = !e.target.checked;
          }
        });
      });

      $$('.auto-del', tbody).forEach(el => {
        el.addEventListener('click', async (e) => {
          if (!confirm('Excluir automação?')) return;
          try {
            await api.deleteAutomation(e.target.dataset.id);
            toast('Excluída com sucesso');
            loadAutomations();
          } catch(err) { toast(err.message, { error: true }); }
        });
      });
    } catch(e) {}
  }

  btnOpen.addEventListener('click', () => {
    loadAutomations();
    openModal('modal-automations');
  });

  btnClose.addEventListener('click', () => closeModal('modal-automations'));

  btnAdd.addEventListener('click', async () => {
    const name = $('#auto-name').value.trim();
    const metric = $('#auto-metric').value;
    const operator = $('#auto-operator').value;
    const value = $('#auto-value').value;
    const action = $('#auto-action').value;

    if (!name || !value) return toast('Preencha nome e valor', { error: true });
    
    btnAdd.disabled = true;
    try {
      await api.createAutomation({ name, metric, operator, value: Number(value), action });
      toast('Automação criada!');
      $('#auto-name').value = '';
      $('#auto-value').value = '';
      loadAutomations();
    } catch(e) {
      toast(e.message, { error: true });
    } finally {
      btnAdd.disabled = false;
    }
  });

  return modal;
}

// ---------------------------------------------------------------
// CRM / Leads Modal
// ---------------------------------------------------------------
export function mountLeadsModal() {
  const modal = $('#modal-leads');
  const btnOpen = $('#btn-leads');
  const btnClose = $('#leads-close');
  const tbody = $('#leads-table tbody');

  if (!modal || !btnOpen) return null;

  async function loadLeads() {
    try {
      const rows = await api.getLeads();
      tbody.innerHTML = '';
      if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="center muted" style="padding:15px;">Nenhum lead capturado ainda.</td></tr>';
        return;
      }
      rows.forEach(r => {
        const tr = document.createElement('tr');
        const dt = new Date(r.created_at).toLocaleString('pt-BR');
        const sourceMedium = `${r.utm_source || '-'}/${r.utm_medium || '-'}`;
        const evtColor = r.event_type === 'purchase' ? 'var(--teal)' : (r.event_type === 'lead' ? 'var(--blue)' : 'var(--muted)');
        
        tr.innerHTML = `
          <td style="font-size:12px;">${dt}</td>
          <td><span style="color:${evtColor}; font-weight:bold;">${r.event_type.toUpperCase()}</span></td>
          <td>${escapeAttr(sourceMedium)}</td>
          <td>${escapeAttr(r.utm_campaign || '-')}</td>
          <td>${escapeAttr(r.utm_term || r.utm_content || '-')}</td>
          <td style="max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${r.url}">
            <a href="${r.url}" target="_blank" style="color:var(--teal);">${r.url}</a>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } catch(e) {
      console.error(e);
      toast('Erro ao carregar CRM', { error: true });
    }
  }

  btnOpen.addEventListener('click', () => {
    loadLeads();
    openModal('modal-leads');
  });

  btnClose.addEventListener('click', () => closeModal('modal-leads'));

  return modal;
}

// ---------------------------------------------------------------
// DRE Financeiro Modal
// ---------------------------------------------------------------
export function mountDreModal(onSave) {
  const modal = $('#modal-dre');
  const btnOpen = $('#btn-dre');
  const btnClose = $('#dre-close');
  const btnSave = $('#dre-save');

  if (!modal || !btnOpen) return null;

  btnOpen.addEventListener('click', async () => {
    const wsId = $('#workspace-select')?.value;
    if (!wsId) return toast('Selecione um workspace', { error: true });
    
    try {
      const data = await api.getFinancial(wsId);
      $('#dre-product-cost').value = data.product_cost || 0;
      $('#dre-tax-rate').value = data.tax_rate || 0;
      $('#dre-gateway-rate').value = data.gateway_rate || 0;
      $('#dre-agency-fee').value = data.agency_fee || 0;
      openModal('modal-dre');
    } catch(e) {
      toast('Erro ao carregar DRE', { error: true });
    }
  });

  btnClose.addEventListener('click', () => closeModal('modal-dre'));

  btnSave.addEventListener('click', async () => {
    const wsId = $('#workspace-select')?.value;
    const body = {
      product_cost: parseFloat($('#dre-product-cost').value) || 0,
      tax_rate: parseFloat($('#dre-tax-rate').value) || 0,
      gateway_rate: parseFloat($('#dre-gateway-rate').value) || 0,
      agency_fee: parseFloat($('#dre-agency-fee').value) || 0,
    };
    try {
      await api.saveFinancial(wsId, body);
      toast('DRE Salvo com sucesso!');
      closeModal('modal-dre');
      if (onSave) onSave(); // trigger refresh
    } catch(e) {
      toast('Erro ao salvar DRE', { error: true });
    }
  });

  return modal;
}

// ---------------------------------------------------------------
// Raio-X Creatives Modal
// ---------------------------------------------------------------
export function mountCreativesModal() {
  const modal = $('#modal-creatives');
  const btnOpen = $('#btn-creatives');
  const btnClose = $('#creatives-close');

  if (!modal || !btnOpen) return null;

  btnOpen.addEventListener('click', () => {
    openModal('modal-creatives');
  });

  btnClose.addEventListener('click', () => closeModal('modal-creatives'));

  return modal;
}
