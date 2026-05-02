/**
 * app.js — orquestrador principal do dashboard.
 */
import { api }          from './api.js';
import * as charts      from './charts.js';
import { renderCampaignTable, renderDetailTable, renderDemographics, renderAds } from './tables.js';
import { renderKPIs, renderHealthPanel, renderSocialKPIs, renderPacingPanel, renderAIInsights } from './kpis.js';
import {
  mountEntryModal, mountCampaignsModal, mountGoalsModal, mountNotesModal,
  mountUsersModal, mountImportModal, mountAlertsModal, mountBrandingModal,
  mountUTMModal, mountPixelModal, mountAutomationsModal, mountLeadsModal,
  mountDreModal, mountCreativesModal,
  mountKanbanModal, mountWAModal, mountBillingModal
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
let lastSyncTime = null;

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

// ---------------------------------------------------------------
// Boot
// ---------------------------------------------------------------
(async function init() {
  let currentUser = null;
  try { const { user } = await api.me(); currentUser = user; window.currentUser = user; renderUser(user); }
  catch { location.href = '/login'; return; }

  // Monta todos os modais
  const entryModal = mountEntryModal   ({ onSaved:   refresh });
  const campsModal = mountCampaignsModal({ onChanged: refresh });
  const goalsModal = mountGoalsModal   ({ onChanged: refresh });
  const notesModal = mountNotesModal   ({ onChanged: refresh });
  const drillModal = mountDrillModal   ();

  // Armazena drill modal globalmente para o callback de refresh
  window.__drillModal = drillModal;

  const utmModal = mountUTMModal();
  const pixelModal = mountPixelModal();
  const autoModal = mountAutomationsModal();
  const leadsModal = mountLeadsModal();
  const dreModal = mountDreModal(refresh);
  const creativesModal = mountCreativesModal();
  const kanbanModal = mountKanbanModal();
  const waModal = mountWAModal();
  const billingModal = mountBillingModal();

  // Modais admin-only
  let usersModal, importModal, syncModal, alertsModal, brandingModal;
  if (currentUser?.role === 'admin') {
    usersModal  = mountUsersModal ({ onChanged: () => {} });
    importModal = mountImportModal({ onSaved: refresh });
    syncModal   = mountSyncModal  ({ onSaved: refresh });
    alertsModal = mountAlertsModal();
    brandingModal = mountBrandingModal({ onSaved: refresh });
    
    // Configura seletor de workspaces
    const wsSelect = $('#workspace-select');
    if (wsSelect) {
      wsSelect.style.display = 'inline-block';
      const btnNewWs = $('#btn-new-workspace');
      if (btnNewWs) btnNewWs.style.display = 'inline-block';

      try {
        const workspaces = await api.getWorkspaces();
        wsSelect.innerHTML = workspaces.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
        // Seleciona o atual (vem do servidor, podemos ter que adivinhar ou ter api.me() retornando workspace_id)
        if (currentUser.current_workspace_id) wsSelect.value = currentUser.current_workspace_id;
      } catch (e) { console.warn('Erro ao carregar workspaces', e); }

      wsSelect.addEventListener('change', async (e) => {
        try {
          await api.switchWorkspace(e.target.value);
          window.location.reload();
        } catch (err) { toast('Erro ao trocar cliente', { error: true }); }
      });

      if (btnNewWs) {
        btnNewWs.addEventListener('click', async () => {
          const name = prompt('Nome do novo Cliente/Workspace:');
          if (!name) return;
          try {
            const row = await api.createWorkspace({ name });
            toast('Cliente criado com sucesso!');
            await api.switchWorkspace(row.id);
            window.location.reload();
          } catch (e) { toast('Erro ao criar cliente: ' + e.message, { error: true }); }
        });
      }
    }
  }

  // ---- Botões do header ----
  const btnEntry = $('#btn-entry');
  if (btnEntry) btnEntry.addEventListener('click', () => entryModal.open());
  $('#btn-campaigns')?.addEventListener('click', () => campsModal.open());
  $('#btn-goals')?.addEventListener('click', () => goalsModal.open());
  $('#btn-notes')?.addEventListener('click', () => notesModal.open());
  $('#btn-logout')?.addEventListener('click', async () => { await api.logout(); location.href = '/login'; });
  
  // Empire triggers
  $('#btn-kanban')?.addEventListener('click', () => kanbanModal?.open());
  $('#btn-wa')?.addEventListener('click', () => waModal?.open());
  $('#btn-billing')?.addEventListener('click', () => billingModal?.open());
  
  const btnRefresh = $('#btn-refresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      btnRefresh.textContent = '↻ ...';
      await refresh();
      btnRefresh.textContent = '↻ Atualizar';
    });
  }

    // Lógica NEXUS FORGE
  const btnCreateForge = document.getElementById('btn-create-forge');
  
  window.loadForgeList = async function() {
    try {
        const token = localStorage.getItem('nx_token') || '';
        const res = await fetch('/api/forge/list', { headers: { 'Authorization': 'Bearer ' + token }});
        const data = await res.json();
        const tbody = document.querySelector('#forge-list-table tbody');
        if (tbody && data.funnels) {
            tbody.innerHTML = data.funnels.map(f => `
              <tr>
                <td>${f.name}</td>
                <td><a href="/f/${f.slug}" target="_blank" style="color:var(--teal);">/f/${f.slug}</a></td>
                <td>${f.visits || 0}</td>
              </tr>
            `).join('');
        }
    } catch(e) { console.error('Erro ao carregar lista forge:', e); }
  };

  if (btnCreateForge) {
    btnCreateForge.addEventListener('click', async () => {
        const name = document.getElementById('forge-name').value;
        const niche = document.getElementById('forge-niche').value;
        const slug = document.getElementById('forge-slug').value;

        if (!name || !niche || !slug) return toast('Preencha todos os campos!', {error:true});
        
        const oldText = btnCreateForge.innerHTML;
        btnCreateForge.innerHTML = 'Forjando IA... (Pode levar 20s)';
        btnCreateForge.disabled = true;

        try {
            const token = localStorage.getItem('nx_token') || '';
            const res = await fetch('/api/forge/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
              body: JSON.stringify({ name, niche, slug })
            });
            const data = await res.json();
            if (data.ok) {
                toast('Página Forjada com sucesso!');
                window.loadForgeList(); // Recarrega
            } else {
                toast('Erro: ' + (data.error || 'Desconhecido'), {error:true});
            }
        } catch(e) {
            toast('Erro de rede: ' + e.message, {error:true});
        } finally {
            btnCreateForge.innerHTML = oldText;
            btnCreateForge.disabled = false;
        }
    });
  }

  // Botões admin
  const btnUsers  = $('#btn-users');
  const btnImport = $('#btn-import');
  const btnSync   = $('#btn-sync');
  const btnAlerts = $('#btn-alerts');
  const btnViewer = $('#btn-viewer-link');

  if (currentUser?.role !== 'admin') {
    [btnUsers, btnImport, btnSync, btnAlerts, btnViewer, $('#btn-entry'), $('#btn-campaigns'), $('#btn-goals'), $('#btn-notes'), $('#btn-export-json')].forEach(b => b && (b.style.display = 'none'));
    document.body.classList.add('viewer-mode');
  } else {
    btnUsers?.addEventListener ('click', () => usersModal.open());
    btnImport?.addEventListener('click', () => importModal.open());
    btnSync?.addEventListener  ('click', () => syncModal.open());
    btnAlerts?.addEventListener('click', () => alertsModal.open());
    btnViewer?.addEventListener('click', async () => {
      try {
        const { link } = await api.getViewerLink();
        navigator.clipboard.writeText(link);
        toast('Link de Diretoria copiado para a área de transferência!');
      } catch (e) { toast('Erro ao gerar link: ' + e.message, { error: true }); }
    });
  }

  // ---- Exportações ----
  $('#btn-report-magic')?.addEventListener('click', window.generateMagicReport);
  const btnExportCSV = $('#btn-export-csv');
  if (btnExportCSV) btnExportCSV.addEventListener('click', () => exportCSV(state.lastTable, `nexus-${periodLabel(true)}.csv`));
  const btnExportJSON = $('#btn-export-json');
  if (btnExportJSON) btnExportJSON.addEventListener('click', async () => {
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

  const qDemo = { year: state.year };
  if (state.month)             qDemo.month   = state.month;
  if (state.channel !== 'all') qDemo.channel = state.channel;

  try {
    const [kpis, monthly, byCamp, notes, goals, demographics, placements, ads, aiInsights] = await Promise.all([
      api.kpis(qKpi),
      api.monthly(qMonthly),
      api.byCampaign(qByCamp),
      api.notes({ year: state.year }),
      api.goals({ year: state.year, ...(state.month ? { month: state.month } : {}) }),
      api.demographics(qDemo),
      api.placements(qDemo),
      api.ads(qDemo),
      api.aiInsights({ channel: state.channel })
    ]);

    state.lastMonthly = monthly.rows || [];
    state.lastByCamp  = byCamp.rows  || [];
    state.lastGoals   = goals;
    
    // Fetch Financial Settings for Net Profit Calculation
    let financial = null;
    try {
      const wsId = $('#workspace-select')?.value || window.currentUser?.current_workspace_id || 1;
      financial = await api.getFinancial(wsId);
    } catch(e) { }
    state.financial = financial;

    if (financial) {
      const applyDRE = (o) => {
        if (!o) return;
        o.grossRevenue = o.revenue || 0;
        const tax = o.grossRevenue * ((financial.tax_rate || 0) / 100);
        const gw  = o.grossRevenue * ((financial.gateway_rate || 0) / 100);
        // Let's assume agency_fee is monthly. If we are looking at a period, we just subtract it once for simplicity.
        const fixed = financial.agency_fee || 0;
        
        o.revenue = o.grossRevenue - tax - gw - fixed; // Replace revenue with Net Profit in the UI
        o.roas = o.spend > 0 ? (o.revenue / o.spend) : 0; // Recalculate ROAS based on Net Profit
        o.isNetProfit = true;
      };
      applyDRE(kpis.current);
      applyDRE(kpis.past);
    }

    state.lastKpis    = kpis.current;

    renderHeaderPeriod();

    // KPIs com sparklines
    const goalsNorm = goalsRelevantToPeriod(goals);
    // Add isNetProfit flag so the renderer can show "Lucro Líquido" instead of "Receita"
    kpis.isNetProfit = !!financial;
    renderKPIs($('#kpi-grid'), kpis, state.channel, goalsNorm, state.lastMonthly);
    renderSocialKPIs($('#social-grid'), kpis, state.channel);

    // Painel de saúde
    renderHealthPanel($('#health-panel'), state.lastByCamp, goalsNorm);

    // Calculadora de Pacing (apenas visível ao filtrar por Mês)
    renderPacingPanel($('#pacing-panel'), state.lastMonthly, goalsNorm, state.year, state.month, state.channel);

    // Funil de Vendas (CRM)
    renderFunnel($('#sales-funnel'), kpis.current);

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

    // Demographics & Ads
    renderDemographics(demographics);
    charts.renderDemographicCharts(demographics);
    charts.renderPlacementCharts(placements);
    renderAds(ads);
    
    // AI Insights
    renderAIInsights(aiInsights);

    lastSyncTime = new Date();
    updateSyncTime();

  } catch (e) { toast('Erro ao carregar: ' + e.message, { error: true }); }
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
function renderUser(user) {
  const chip = $('#user-chip');
  if (chip) chip.innerHTML = `<b>●</b> ${user.name || user.username}`;

  // White-Label Branding
  const badge = $('.app-header .badge');
  if (badge && user.workspace_name) badge.textContent = user.workspace_name;

  if (user.theme_color) {
    document.documentElement.style.setProperty('--teal', user.theme_color);
    document.documentElement.style.setProperty('--border-strong', user.theme_color);
  }

  const titleContainer = $('.header-left h1');
  if (user.logo_url && titleContainer) {
    titleContainer.innerHTML = `<img src="${user.logo_url}" alt="${user.workspace_name}" style="height: 40px; margin-right: 10px; vertical-align: middle;">`;
  }
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

function updateSyncTime() {
  const el = $('#sync-time b');
  if (!el || !lastSyncTime) return;
  const diff = Math.floor((new Date() - lastSyncTime) / 1000);
  if (diff < 60) el.textContent = 'agora mesmo';
  else if (diff < 3600) el.textContent = `${Math.floor(diff/60)} min atrás`;
  else el.textContent = `${Math.floor(diff/3600)}h atrás`;
  
  const footerUpdate = $('#last-update');
  if (footerUpdate) footerUpdate.textContent = 'Atualizado: ' + lastSyncTime.toLocaleString('pt-BR');
}
setInterval(updateSyncTime, 30000);
// ---------------------------------------------------------------
// AI Copilot Logic
// ---------------------------------------------------------------
(function initCopilot() {
  const fab = $('#copilot-fab');
  const panel = $('#copilot-panel');
  const closeBtn = $('#copilot-close');
  const input = $('#copilot-input');
  const sendBtn = $('#copilot-send');
  const messagesDiv = $('#copilot-messages');

  if (!fab || !panel) return;

  fab.addEventListener('click', () => {
    panel.classList.toggle('active');
    if (panel.classList.contains('active')) input.focus();
  });

  closeBtn.addEventListener('click', () => {
    panel.classList.remove('active');
  });

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    // Append User Message
    const userMsg = document.createElement('div');
    userMsg.className = 'msg-user';
    userMsg.textContent = text;
    messagesDiv.appendChild(userMsg);
    input.value = '';
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    // Append Typing Indicator
    const typingMsg = document.createElement('div');
    typingMsg.className = 'msg-bot';
    typingMsg.style.fontStyle = 'italic';
    typingMsg.style.color = 'var(--muted)';
    typingMsg.textContent = 'Analisando dados...';
    messagesDiv.appendChild(typingMsg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    try {
      // Build context
      const contextData = window.state && window.state.lastKpis ? window.state.lastKpis : {};
      
      const res = await api.aiChat({ message: text, contextData });
      
      typingMsg.remove();

      const botMsg = document.createElement('div');
      botMsg.className = 'msg-bot';
      // simple line break replace
      botMsg.innerHTML = (res.text || 'Desculpe, ocorreu um erro.').replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
      messagesDiv.appendChild(botMsg);
    } catch (e) {
      typingMsg.remove();
      const errorMsg = document.createElement('div');
      errorMsg.className = 'msg-bot';
      errorMsg.style.color = 'var(--laranja)';
      errorMsg.style.borderColor = 'var(--laranja)';
      errorMsg.textContent = e.message || 'Erro ao comunicar com a IA.';
      messagesDiv.appendChild(errorMsg);
    }
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
})();

// Magic Report Generator
window.generateMagicReport = async function() {
  const btn = document.getElementById('btn-report-magic');
  if(btn) { btn.innerHTML = '✨ Gerando (IA)...'; btn.disabled = true; }
  try {
    const kpis = window.lastKpis || { spend: 0, revenue: 0, leads: 0, cpl: 0, clicks: 0, roas: 0 };
    // Get the period label by looking at the UI elements since state might be local
    const dateFilter = document.getElementById('date-filter');
    const title = 'Relatório Executivo - ' + (dateFilter ? dateFilter.options[dateFilter.selectedIndex].text : 'Tráfego');
    
    const res = await api.generateReport({ title, metrics: kpis.current || kpis });
    if(res.ok && res.uuid) {
      window.open('/report/' + res.uuid, '_blank');
      toast('Relatório Mágico Gerado!');
    }
  } catch(e) {
    console.error(e);
    toast('Erro ao gerar relatório', { error: true });
  } finally {
    if(btn) { btn.innerHTML = '✨ Gerar Relatório Mágico'; btn.disabled = false; }
  }
};

window.simulateSwarm = function() {
    const terminal = document.getElementById('swarm-terminal');
    if(!terminal) return;
    
    terminal.innerHTML = '<div style="color:#00ffa3;">[SISTEMA] Iniciando interceptação de frequência da Colmeia...</div>';
    
    const messages = [
        { agent: 'NEXUS Sentinel', color: '#00ffa3', text: 'Analisei a campanha C-19. O CTR caiu para 0.8% e o CPA bateu R$45. Verba cortada.' },
        { agent: 'NEXUS Titan', color: '#ffd700', text: 'Auditoria financeira concluída. Saldo disponível: R$ 15.400. Alocando R$ 2.000 para capital de risco.' },
        { agent: 'NEXUS Titan', color: '#ffd700', text: 'Pesquisando tendências... Nicho de "Nootrópicos Naturais" está com demanda em alta e CPA baixo. Empresa "NeuroBoost" fundada no banco de dados.' },
        { agent: 'NEXUS Venom', color: '#ff0055', text: 'Injetando prompt de espionagem na biblioteca de anúncios do Meta para NeuroBoost. Gerando Copy focada em "alta performance corporativa".' },
        { agent: 'NEXUS Studio', color: '#a855f7', text: 'Copy recebida. Acionando API HeyGen. Renderizando Avatar VSL para o público corporativo...' },
        { agent: 'NEXUS Forge', color: '#3b82f6', text: 'Forjando Landing Page mutante para NeuroBoost. Deploy na Vercel executado com sucesso.' },
        { agent: 'Fechador NLP', color: '#f59e0b', text: 'O cliente João acaba de perguntar o preço no WhatsApp da Clínica. Ativando Doppelgänger...' },
        { agent: 'Doppelgänger', color: '#00ffff', text: 'Carregando persona configurada do workspace... Resposta gerada no tom da marca. Injetando tag [GERAR_PIX] silenciosamente.' },
        { agent: 'Ghost Checkout', color: '#00ff00', text: 'Pagamento PIX de R$ 97,00 interceptado com sucesso via Mercado Pago.' },
        { agent: 'Poltergeist', color: '#ff00ff', text: 'Pedido confirmado. Disparando Payload ZPL para impressora térmica física na cozinha. Nenhuma interação humana foi exigida.' },
        { agent: 'Poltergeist', color: '#ff00ff', text: 'Chamando motorista do Uber Flash via API. O entregador Carlos (ABC-1234) chega em 2 minutos.' },
        { agent: 'NEXUS Corsário', color: '#ff0000', text: 'Enquanto isso, raspei 42 comentários do Instagram do concorrente da NeuroBoost. Enviando DMs com ofertas cruzadas.' },
        { agent: 'SISTEMA', color: '#aaa', text: '[FIM DA VARREDURA] Todos os agentes (Titan, Poltergeist, Doppelgänger, etc) operando em parâmetros nominais. O império opera sozinho.' }
    ];

    let delay = 1000;
    messages.forEach((msg, idx) => {
        setTimeout(() => {
            const div = document.createElement('div');
            div.innerHTML = `<span style="color:${msg.color}; font-weight:bold;">[${msg.agent}]</span> > ${msg.text}`;
            terminal.appendChild(div);
            terminal.scrollTop = terminal.scrollHeight;
        }, delay);
        delay += 1500 + Math.random() * 2000;
    });
};

// -------------------------------------------------------------
// NEXUS Studio & Voice Bindings
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    const btnVsl = document.getElementById('btn-create-vsl');
    if (btnVsl) {
        btnVsl.addEventListener('click', async () => {
            const niche = document.getElementById('studio-niche').value;
            const target = document.getElementById('studio-target').value;
            const resDiv = document.getElementById('studio-result');
            
            if (!niche || !target) return alert("Preencha o nicho e público!");
            
            btnVsl.innerHTML = "Renderizando VSL...";
            try {
                // Ensure apiCall is available globally or use fetch
                const res = await fetch('/api/studio/video', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                    body: JSON.stringify({ niche, target_audience: target })
                });
                const data = await res.json();
                if(data.error) throw new Error(data.error);

                resDiv.innerHTML = `Sucesso! ID: ${data.video_id} <br> <span style="color:#aaa; font-size:11px;">Script IA: ${data.script.substring(0, 50)}...</span>`;
            } catch(e) {
                resDiv.innerHTML = `<span style="color:red">Erro: ${e.message}</span>`;
            }
            btnVsl.innerHTML = "Renderizar Avatar VSL";
        });
    }

    const btnCall = document.getElementById('btn-fire-call');
    if (btnCall) {
        btnCall.addEventListener('click', async () => {
            const name = document.getElementById('call-lead-name').value;
            const phone = document.getElementById('call-lead-phone').value;
            const context = document.getElementById('call-context').value;
            const resDiv = document.getElementById('call-result');
            
            if (!name || !phone) return alert("Preencha nome e telefone!");
            
            btnCall.innerHTML = "Ligando...";
            try {
                const res = await fetch('/api/voice/call', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token') },
                    body: JSON.stringify({ lead_phone: phone, lead_name: name, context_info: context })
                });
                const data = await res.json();
                if(data.error) throw new Error(data.error);

                resDiv.innerHTML = `Ligação Conectada! <br> <span style="color:#aaa; font-size:11px;">I.A: ${data.ai_transcription}</span>`;
            } catch(e) {
                resDiv.innerHTML = `<span style="color:red">Erro: ${e.message}</span>`;
            }
            btnCall.innerHTML = "Disparar Ligação IA";
        });
    }
});
