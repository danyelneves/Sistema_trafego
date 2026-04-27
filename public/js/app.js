/**
 * app.js — orquestrador principal do dashboard.
 */
import { api }          from './api.js';
import * as charts      from './charts.js';
import { renderCampaignTable, renderDetailTable } from './tables.js';
import { renderKPIs, renderHealthPanel }          from './kpis.js';
import {
  mountEntryModal, mountCampaignsModal, mountGoalsModal, mountNotesModal,
  mountUsersModal, mountImportModal, mountAlertsModal,
}                       from './modals.js';
import { mountSyncModal }  from './sync-modal.js';
import { mountDrillModal }  from './drill.js';
import { exportPDF, exportCSV, exportBackupJSON } from './export.js';
import { MESES, MESES_FULL, toast } from './utils.js';

// ---------------------------------------------------------------
// Estado global
// ---------------------------------------------------------------
const state = {
  year:     new Date().getFullYear(),
  month:    null,
  semester: null,
  channel:  'all',
  lastTable:    [],
  lastMonthly:  [],
  lastByCamp:   [],
  lastGoals:    [],
};

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

// ---------------------------------------------------------------
// Boot
// ---------------------------------------------------------------
(async function init() {
  let currentUser = null;
  try { const { user } = await api.me(); currentUser = user; renderUser(user); }
  catch { location.href = '/login'; return; }

  // Monta todos os modais
  const entryModal = mountEntryModal   ({ onSaved:   refresh });
  const campsModal = mountCampaignsModal({ onChanged: refresh });
  const goalsModal = mountGoalsModal   ({ onChanged: refresh });
  const notesModal = mountNotesModal   ({ onChanged: refresh });
  const drillModal = mountDrillModal   ();

  // Armazena drill modal globalmente para o callback de refresh
  window.__drillModal = drillModal;

  // Modais admin-only
  let usersModal, importModal, syncModal, alertsModal;
  if (currentUser?.role === 'admin') {
    usersModal  = mountUsersModal ({ onChanged: () => {} });
    importModal = mountImportModal({ onSaved: refresh });
    syncModal   = mountSyncModal  ({ onSaved: refresh });
    alertsModal = mountAlertsModal();
  }

  // ---- Botões do header ----
  $('#btn-entry')     .addEventListener('click', () => entryModal.open());
  $('#btn-campaigns') .addEventListener('click', () => campsModal.open());
  $('#btn-goals')     .addEventListener('click', () => goalsModal.open());
  $('#btn-notes')     .addEventListener('click', () => notesModal.open());
  $('#btn-logout')    .addEventListener('click', async () => { await api.logout(); location.href = '/login'; });

  // Botões admin
  const btnUsers  = $('#btn-users');
  const btnImport = $('#btn-import');
  const btnSync   = $('#btn-sync');
  const btnAlerts = $('#btn-alerts');

  if (currentUser?.role !== 'admin') {
    [btnUsers, btnImport, btnSync, btnAlerts].forEach(b => b && (b.style.display = 'none'));
  } else {
    btnUsers?.addEventListener ('click', () => usersModal.open());
    btnImport?.addEventListener('click', () => importModal.open());
    btnSync?.addEventListener  ('click', () => syncModal.open());
    btnAlerts?.addEventListener('click', () => alertsModal.open());
  }

  // ---- Exportações ----
  $('#btn-export-pdf') .addEventListener('click', exportPDF);
  $('#btn-export-csv') .addEventListener('click', () => exportCSV(state.lastTable, `maranet-${periodLabel(true)}.csv`));
  $('#btn-export-json').addEventListener('click', async () => {
    try { const r = await exportBackupJSON(api); toast(`Backup gerado (${r.counts.daily} linhas)`); }
    catch (e) { toast('Erro: ' + e.message, { error: true }); }
  });

  // ---- Apresentação ----
  $('#btn-present').addEventListener('click', () => document.body.classList.toggle('present'));

  // ---- Filtros de período ----
  $$('#period-group .btn').forEach(b => b.addEventListener('click', () => {
    $$('#period-group .btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    const mode = b.dataset.mode;
    if      (mode === 'year')  { state.month = null; state.semester = null; $('#month-select').value = ''; }
    else if (mode === 's1')    { state.month = null; state.semester = 1;    $('#month-select').value = ''; }
    else if (mode === 's2')    { state.month = null; state.semester = 2;    $('#month-select').value = ''; }
    else if (mode === 'month') {
      if (!state.month) { state.month = new Date().getMonth() + 1; $('#month-select').value = state.month; }
      state.semester = null;
    }
    refresh();
  }));

  $('#month-select').addEventListener('change', e => {
    const v = e.target.value;
    state.month    = v ? Number(v) : null;
    state.semester = null;
    $$('#period-group .btn').forEach(x =>
      x.classList.toggle('active', state.month ? x.dataset.mode === 'month' : x.dataset.mode === 'year')
    );
    refresh();
  });

  $('#year-select').addEventListener('change', e => { state.year = Number(e.target.value); refresh(); });

  // ---- Tabs de canal ----
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    $$('.tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    state.channel = t.dataset.source;
    refresh();
  }));

  await refresh();
})();

// ---------------------------------------------------------------
// Skeleton loading
// ---------------------------------------------------------------
function showSkeleton() {
  const grid = $('#kpi-grid');
  if (!grid) return;
  grid.innerHTML = Array(6).fill(0).map(() => `
    <div class="kpi-card skeleton-card">
      <div class="skel skel-sm"></div>
      <div class="skel skel-xs" style="margin-top:6px"></div>
      <div class="skel skel-lg" style="margin-top:10px"></div>
      <div class="skel skel-sm" style="margin-top:8px"></div>
    </div>
  `).join('');
}

// ---------------------------------------------------------------
// Refresh
// ---------------------------------------------------------------
async function refresh() {
  showSkeleton();

  const qKpi = { year: state.year, channel: state.channel };
  if (state.month)    qKpi.month    = state.month;
  if (state.semester) qKpi.semester = state.semester;

  const qMonthly = { year: state.year };
  if (state.channel !== 'all') qMonthly.channel = state.channel;

  const qByCamp = { year: state.year };
  if (state.month)             qByCamp.month   = state.month;
  if (state.channel !== 'all') qByCamp.channel = state.channel;

  try {
    const [kpis, monthly, byCamp, notes, goals] = await Promise.all([
      api.kpis(qKpi),
      api.monthly(qMonthly),
      api.byCampaign(qByCamp),
      api.notes({ year: state.year }),
      api.goals({ year: state.year, ...(state.month ? { month: state.month } : {}) }),
    ]);

    state.lastMonthly = monthly.rows || [];
    state.lastByCamp  = byCamp.rows  || [];
    state.lastGoals   = goals;

    renderHeaderPeriod();

    // KPIs com sparklines
    const goalsNorm = goalsRelevantToPeriod(goals);
    renderKPIs($('#kpi-grid'), kpis, state.channel, goalsNorm, state.lastMonthly);

    // Painel de saúde
    renderHealthPanel($('#health-panel'), state.lastByCamp, goalsNorm);

    // Gráficos
    charts.renderAll({
      monthlyRows: state.lastMonthly,
      channel:     state.channel,
      goals:       goalsNorm,
      notes,
    });

    // Tabela detalhada
    renderDetailTable($('#detail-tbody'), state.lastMonthly, notes, state.channel, state.year);
    state.lastTable = buildCsvRows(state.lastMonthly, notes);

    // Tabela de campanhas (novo: passa o *container* inteiro)
    renderCampaignTable(
      $('#campaign-table-container'),
      state.lastByCamp,
      (camp) => window.__drillModal?.open(camp, state.year, state.month)
    );

    $('#last-update').textContent = 'Atualizado: ' + new Date().toLocaleString('pt-BR');

  } catch (e) { toast('Erro ao carregar: ' + e.message, { error: true }); }
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
function renderUser(user) {
  const chip = $('#user-chip');
  if (chip) chip.innerHTML = `<b>●</b> ${user.name || user.username}`;
}

function renderHeaderPeriod() {
  let txt;
  if (state.month)         txt = `${MESES_FULL[state.month-1]} · ${state.year}`;
  else if (state.semester) txt = `${state.semester}º SEMESTRE · ${state.year}`;
  else                     txt = `ANO ${state.year}`;
  const chEl = state.channel === 'all' ? 'Google + Meta' : (state.channel === 'google' ? 'Google Ads' : 'Meta Ads');
  const label = $('#period-label');
  const print = $('#period-print');
  if (label) label.innerHTML = `<span class="pulse"></span> ${chEl} · ${txt}`;
  if (print) print.textContent = txt;
}

function periodLabel(filename = false) {
  let txt;
  if (state.month)         txt = `${state.year}-${String(state.month).padStart(2,'0')}`;
  else if (state.semester) txt = `${state.year}-S${state.semester}`;
  else                     txt = `${state.year}`;
  return filename ? `${txt}-${state.channel}` : txt;
}

function goalsRelevantToPeriod(goals) {
  if (state.month) return goals.filter(g => g.month === state.month);
  const mStart = state.semester === 1 ? 1 : (state.semester === 2 ? 7 : 1);
  const mEnd   = state.semester === 1 ? 6 : (state.semester === 2 ? 12 : 12);
  const sub = goals.filter(g => !state.semester || (g.month >= mStart && g.month <= mEnd));
  const byKey = new Map();
  sub.forEach(g => {
    const key = g.channel + '::' + g.metric;
    const cur = byKey.get(key) || { ...g, _count: 0, _sum: 0 };
    cur._count++; cur._sum += g.target;
    byKey.set(key, cur);
  });
  return Array.from(byKey.values()).map(g => {
    const isSum = ['spend','conversions','impressions','clicks','revenue'].includes(g.metric);
    return { ...g, target: isSum ? g._sum : (g._sum / g._count) };
  });
}

function buildCsvRows(monthlyRows, notes) {
  return monthlyRows.map(r => ({
    mes:              MESES_FULL[r.month-1],
    canal:            r.channel,
    impressoes:       r.impressions || 0,
    cliques:          r.clicks || 0,
    conversoes:       r.conversions || 0,
    investimento_brl: (r.spend || 0).toFixed(2),
    cpl_brl:          (r.cpl || 0).toFixed(2),
    ctr_pct:          ((r.ctr || 0)*100).toFixed(2),
    roas:             (r.roas || 0).toFixed(2),
    nota:             (notes.find(n => n.month === r.month && (n.channel === r.channel || n.channel === 'all'))?.text) || '',
  }));
}
