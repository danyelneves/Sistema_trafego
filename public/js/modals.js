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
    let rows = [];
    try { rows = await api.users(); } catch {}
    const tbody = $('#user-tbody');
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="muted" style="text-align:center;padding:18px">Nenhum usuário.</td></tr>`;
      return;
    }
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
        const body = { display_name: tr.querySelector('.user-name').value.trim(), role: tr.querySelector('.user-role').value };
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
      return;
    }
    tbody.innerHTML = data.alerts.map(a => `
      <tr>
        <td>${metricLabel(a.metric)}</td>
        <td>${chanLabel(a.channel)}</td>
        <td>${a.direction === 'min' ? 'mín' : 'máx'} ${a.threshold}</td>
        <td style="font-size:11px;max-width:140px;overflow:hidden;text-overflow:ellipsis">${escapeAttr(a.email)}</td>
        <td><span style="color:${a.active ? '#4ecb71' : '#ff6464'}">${a.active ? 'Ativo' : 'Inativo'}</span></td>
        <td class="row right">
          <button class="btn small" data-toggle="${a.id}" data-active="${a.active}">${a.active ? 'Pausar' : 'Ativar'}</button>
          <button class="btn small del-btn" data-del="${a.id}">Excluir</button>
        </td>
      </tr>
    `).join('');
    tbody.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', async () => {
      try { await api.toggleAlert(Number(b.dataset.toggle), b.dataset.active === '1' ? 0 : 1); refresh(); }
      catch (e) { toast('Erro: ' + e.message, { error: true }); }
    }));
    tbody.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Excluir este alerta?')) return;
      try { await api.deleteAlertConfig(Number(b.dataset.del)); refresh(); }
      catch (e) { toast('Erro: ' + e.message, { error: true }); }
    }));
  }

  $('#alerts-create').addEventListener('click', async () => {
    const body = {
      metric:    $('#alerts-new-metric').value,
      channel:   $('#alerts-new-channel').value,
      threshold: Number($('#alerts-new-threshold').value),
      direction: $('#alerts-new-direction').value,
      email:     $('#alerts-new-email').value.trim(),
    };
    if (!body.email || !body.threshold) { toast('E-mail e limiar são obrigatórios', { error: true }); return; }
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
